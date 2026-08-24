import { NextRequest, NextResponse } from 'next/server';
import { getConnection, query } from '@/lib/db';
import { requireUser } from '@/lib/auth';

const PLACEMENT_TYPES = new Set(['Action', 'Immo', 'Obligations', 'Liquidites']);

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 9999999999.99;
}

export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('type') === 'evolution') {
      const grouping = searchParams.get('group') || 'date';
      const periodExpression = grouping === 'year'
        ? "DATE_FORMAT(s.snapshot_date, '%Y')"
        : grouping === 'quarter'
          ? "CONCAT(YEAR(s.snapshot_date), '-T', QUARTER(s.snapshot_date))"
          : grouping === 'month'
            ? "DATE_FORMAT(s.snapshot_date, '%Y-%m')"
            : "DATE_FORMAT(s.snapshot_date, '%Y-%m-%d')";
      const evolution = await query(`
        SELECT period,
               SUM(net_contributions) AS net_contributions,
               SUM(valuation) AS valuation
        FROM (
          SELECT ${periodExpression} AS period,
                 s.envelope_id, s.net_contributions, COALESCE(p.valorization, 0) AS valuation,
                 ROW_NUMBER() OVER (
                   PARTITION BY s.envelope_id, ${periodExpression}
                   ORDER BY s.snapshot_date DESC, s.id DESC
                 ) AS row_number
          FROM envelope_snapshots s
          LEFT JOIN (
            SELECT snapshot_id, SUM(valorization) AS valorization
            FROM snapshot_placements GROUP BY snapshot_id
          ) p ON p.snapshot_id = s.id
        ) latest
        WHERE row_number = 1
        GROUP BY period
        ORDER BY period ASC
      `) as any[];
      return NextResponse.json(evolution.map(row => {
        const contributions = Number(row.net_contributions) || 0;
        const valuation = Number(row.valuation) || 0;
        return {
          period: row.period,
          net_contributions: contributions,
          valuation,
          gain: valuation - contributions,
        };
      }));
    }
    const envelopeId = Number(searchParams.get('envelope_id'));
    const params: number[] = [];
    const where = Number.isInteger(envelopeId) && envelopeId > 0 ? 'WHERE s.envelope_id = ?' : '';
    if (where) params.push(envelopeId);

    const rows = await query(
      `SELECT s.id, s.envelope_id, e.name AS envelope_name,
              DATE_FORMAT(s.snapshot_date, '%Y-%m-%d') AS snapshot_date,
              s.net_contributions, p.id AS placement_id, p.name AS placement_name,
              p.type_placement, p.valorization
       FROM envelope_snapshots s
       JOIN envelopes e ON e.id = s.envelope_id
       LEFT JOIN snapshot_placements p ON p.snapshot_id = s.id
       ${where}
       ORDER BY s.snapshot_date DESC, s.id DESC, p.id`,
      params
    ) as any[];

    const snapshots = new Map<number, any>();
    for (const row of rows) {
      if (!snapshots.has(row.id)) {
        snapshots.set(row.id, {
          id: row.id,
          envelope_id: row.envelope_id,
          envelope_name: row.envelope_name,
          snapshot_date: row.snapshot_date,
          net_contributions: Number(row.net_contributions),
          valuation: 0,
          gain: 0,
          placements: [],
        });
      }
      const snapshot = snapshots.get(row.id);
      if (row.placement_id) {
        const valuation = Number(row.valorization) || 0;
        snapshot.placements.push({
          id: row.placement_id,
          name: row.placement_name,
          type_placement: row.type_placement,
          valorization: valuation,
        });
        snapshot.valuation += valuation;
      }
      snapshot.gain = snapshot.valuation - snapshot.net_contributions;
    }
    return NextResponse.json(Array.from(snapshots.values()));
  } catch (error) {
    console.error('Error fetching portfolio snapshots:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const envelopeId = Number(body.envelope_id);
  const snapshotDate = body.snapshot_date;
  const netContributions = Number(body.net_contributions);
  const placements = body.placements;

  if (!Number.isInteger(envelopeId) || envelopeId < 1 || !validDate(snapshotDate) || !validAmount(netContributions)) {
    return NextResponse.json({ error: 'Enveloppe, date ou versements invalides' }, { status: 400 });
  }
  if (!Array.isArray(placements) || placements.length > 500) {
    return NextResponse.json({ error: 'La liste des placements est invalide' }, { status: 400 });
  }

  const normalized = [];
  const names = new Set<string>();
  for (const placement of placements) {
    const name = typeof placement?.name === 'string' ? placement.name.trim() : '';
    const type = placement?.type_placement;
    const valorization = Number(placement?.valorization);
    if (!name || name.length > 255 || names.has(name.toLocaleLowerCase()) || !PLACEMENT_TYPES.has(type) || !validAmount(valorization)) {
      return NextResponse.json({ error: 'Un placement est invalide ou en double' }, { status: 400 });
    }
    names.add(name.toLocaleLowerCase());
    normalized.push({ name, type, valorization });
  }

  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    const [envelopes] = await connection.execute('SELECT id FROM envelopes WHERE id = ?', [envelopeId]) as any;
    if (!envelopes.length) {
      await connection.rollback();
      return NextResponse.json({ error: 'Enveloppe introuvable' }, { status: 404 });
    }
    const [existing] = await connection.execute(
      'SELECT id FROM envelope_snapshots WHERE envelope_id = ? AND snapshot_date = ?',
      [envelopeId, snapshotDate]
    ) as any;
    if (existing.length) {
      await connection.rollback();
      return NextResponse.json({ error: 'Un relevé existe déjà à cette date pour cette enveloppe' }, { status: 409 });
    }
    const [snapshot] = await connection.execute(
      'INSERT INTO envelope_snapshots (envelope_id, snapshot_date, net_contributions) VALUES (?, ?, ?)',
      [envelopeId, snapshotDate, netContributions]
    ) as any;
    for (const placement of normalized) {
      await connection.execute(
        'INSERT INTO snapshot_placements (snapshot_id, name, type_placement, valorization) VALUES (?, ?, ?, ?)',
        [snapshot.insertId, placement.name, placement.type, placement.valorization]
      );
    }
    await connection.commit();
    return NextResponse.json({ success: true, id: snapshot.insertId }, { status: 201 });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error creating portfolio snapshot:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  } finally {
    connection.release();
  }
}
