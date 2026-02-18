import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const type = searchParams.get('type');

    if (type === 'envelopes') {
      const envelopes = await query(`
        SELECT e.id, e.name, e.type, 
               p.id as placement_id, p.name as placement_name, 
               p.type_placement, p.year, p.versements, p.valorization
        FROM envelopes e
        LEFT JOIN placements p ON p.envelope_id = e.id AND p.year = ?
        ORDER BY e.type, e.name
      `, [year || new Date().getFullYear()]) as any[];

      const envelopeMap = new Map();
      for (const row of envelopes) {
        if (!envelopeMap.has(row.id)) {
          envelopeMap.set(row.id, {
            id: row.id,
            name: row.name,
            type: row.type,
            placements: []
          });
        }
        if (row.placement_id) {
          envelopeMap.get(row.id).placements.push({
            id: row.placement_id,
            name: row.placement_name,
            type_placement: row.type_placement,
            year: row.year,
            versements: row.versements,
            valorization: row.valorization
          });
        }
      }

      return NextResponse.json(Array.from(envelopeMap.values()));
    }

    if (type === 'evolution') {
      const years = await query(`
        SELECT DISTINCT year FROM placements ORDER BY year DESC
      `) as any[];

      const evolution = [];

      for (const yearRow of years) {
        const yr = yearRow.year;
        
        const rows = await query(`
          SELECT 
            e.type,
            SUM(p.valorization) as total
          FROM envelopes e
          JOIN placements p ON p.envelope_id = e.id
          WHERE p.year = ?
          GROUP BY e.type
        `, [yr]) as any[];

        const totals: Record<string, number> = {
          'Action': 0,
          'Immo': 0,
          'Obligations': 0,
          'Liquidités': 0
        };

        for (const row of rows) {
          totals[row.type] = row.total || 0;
        }

        const total = Object.values(totals).reduce((a: number, b: number) => a + b, 0);
        
        const prevYearRows = await query(`
          SELECT SUM(p.valorization) as total
          FROM placements p
          WHERE p.year = ?
        `, [yr - 1]) as any[];

        const prevTotal = prevYearRows[0]?.total || 0;
        const evolutionVal = total - prevTotal;
        const evolutionPercent = prevTotal > 0 ? (evolutionVal / prevTotal) * 100 : null;

        evolution.push({
          year: yr,
          actions: totals['Action'],
          immo: totals['Immo'],
          obligations: totals['Obligations'],
          liquidites: totals['Liquidités'],
          total,
          evolution: prevTotal > 0 ? evolutionVal : null,
          evolution_percent: prevTotal > 0 ? evolutionPercent : null
        });
      }

      return NextResponse.json(evolution);
    }

    return NextResponse.json({ error: 'Type requis' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching patrimoine:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, type, placements } = await request.json();

    if (!name || !type) {
      return NextResponse.json(
        { error: 'Nom et type requis' },
        { status: 400 }
      );
    }

    const result = await query(
      'INSERT INTO envelopes (name, type) VALUES (?, ?)',
      [name, type]
    ) as any;

    const envelopeId = result.insertId;

    if (placements && placements.length > 0) {
      for (const pl of placements) {
        await query(
          'INSERT INTO placements (envelope_id, name, type_placement, year, versements, valorization) VALUES (?, ?, ?, ?, ?, ?)',
          [envelopeId, pl.name, pl.type_placement, pl.year, pl.versements || 0, pl.valorization || 0]
        );
      }
    }

    return NextResponse.json({ success: true, id: envelopeId });
  } catch (error) {
    console.error('Error creating envelope:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
