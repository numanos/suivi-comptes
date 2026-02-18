import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const type = searchParams.get('type');

    if (type === 'envelopes') {
      const targetYear = year || new Date().getFullYear();
      
      const envelopes = await query(`
        SELECT e.id, e.name, e.exclude_from_gains,
               ev.versements as year_versements,
               p.id as placement_id, p.name as placement_name, 
               p.type_placement, p.year, p.valorization
        FROM envelopes e
        LEFT JOIN envelope_versements ev ON ev.envelope_id = e.id AND ev.year = ?
        LEFT JOIN placements p ON p.envelope_id = e.id AND p.year = ?
        ORDER BY e.name
      `, [targetYear, targetYear]) as any[];

      const envelopeMap = new Map();
      for (const row of envelopes) {
        if (!envelopeMap.has(row.id)) {
          envelopeMap.set(row.id, {
            id: row.id,
            name: row.name,
            exclude_from_gains: Boolean(row.exclude_from_gains),
            year_versements: row.year_versements || 0,
            placements: []
          });
        }
        if (row.placement_id) {
          envelopeMap.get(row.id).placements.push({
            id: row.placement_id,
            name: row.placement_name,
            type_placement: row.type_placement,
            year: row.year,
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
            p.type_placement as type,
            SUM(p.valorization) as total
          FROM placements p
          WHERE p.year = ?
          GROUP BY p.type_placement
        `, [yr]) as any[];

        const totals: Record<string, number> = {
          'Action': 0,
          'Immo': 0,
          'Obligations': 0,
          'Liquidites': 0
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
          liquidites: totals['Liquidites'],
          total,
          evolution: prevTotal > 0 ? evolutionVal : null,
          evolution_percent: prevTotal > 0 ? evolutionPercent : null
        });
      }

      return NextResponse.json(evolution);
    }

    if (type === 'summary') {
      const targetYear = year ? parseInt(year) : new Date().getFullYear();
      
      const rows = await query(`
        SELECT 
          p.type_placement as type,
          SUM(p.valorization) as total
        FROM placements p
        WHERE p.year = ?
        GROUP BY p.type_placement
      `, [targetYear]) as any[];

      const totals: Record<string, number> = {
        'Action': 0,
        'Immo': 0,
        'Obligations': 0,
        'Liquidites': 0
      };

      for (const row of rows) {
        totals[row.type] = row.total || 0;
      }

      const total = Object.values(totals).reduce((a: number, b: number) => a + b, 0);

      const prevYearRows = await query(`
        SELECT p.type_placement as type, SUM(p.valorization) as total
        FROM placements p
        WHERE p.year = ?
        GROUP BY p.type_placement
      `, [targetYear - 1]) as any[];

      const prevTotals: Record<string, number> = {
        'Action': 0,
        'Immo': 0,
        'Obligations': 0,
        'Liquidites': 0
      };

      for (const row of prevYearRows) {
        prevTotals[row.type] = row.total || 0;
      }

      const prevTotal = Object.values(prevTotals).reduce((a: number, b: number) => a + b, 0);

      const summary = {
        year: targetYear,
        totals,
        total,
        prevTotals,
        prevTotal,
        evolution: {
          Action: totals['Action'] - prevTotals['Action'],
          Immo: totals['Immo'] - prevTotals['Immo'],
          Obligations: totals['Obligations'] - prevTotals['Obligations'],
          Liquidites: totals['Liquidites'] - prevTotals['Liquidites'],
          total: total - prevTotal
        },
        evolutionPercent: {
          Action: prevTotals['Action'] > 0 ? ((totals['Action'] - prevTotals['Action']) / prevTotals['Action']) * 100 : null,
          Immo: prevTotals['Immo'] > 0 ? ((totals['Immo'] - prevTotals['Immo']) / prevTotals['Immo']) * 100 : null,
          Obligations: prevTotals['Obligations'] > 0 ? ((totals['Obligations'] - prevTotals['Obligations']) / prevTotals['Obligations']) * 100 : null,
          Liquidites: prevTotals['Liquidites'] > 0 ? ((totals['Liquidites'] - prevTotals['Liquidites']) / prevTotals['Liquidites']) * 100 : null,
          total: prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null
        }
      };

      return NextResponse.json(summary);
    }

    return NextResponse.json({ error: 'Type requis' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching patrimoine:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, versements, year, exclude_from_gains } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Nom requis' },
        { status: 400 }
      );
    }

    const result = await query(
      'INSERT INTO envelopes (name, exclude_from_gains) VALUES (?, ?)',
      [name, exclude_from_gains ? true : false]
    ) as any;

    const envelopeId = result.insertId;

    if (versements && year) {
      await query(
        'INSERT INTO envelope_versements (envelope_id, year, versements) VALUES (?, ?, ?)',
        [envelopeId, year, versements]
      );
    }

    return NextResponse.json({ success: true, id: envelopeId });
  } catch (error) {
    console.error('Error creating envelope:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, name, exclude_from_gains, year, versements } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    await query(
      'UPDATE envelopes SET name = ?, exclude_from_gains = ? WHERE id = ?',
      [name || '', exclude_from_gains ? true : false, id]
    );

    if (year && versements !== undefined) {
      await query(
        `INSERT INTO envelope_versements (envelope_id, year, versements) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE versements = ?`,
        [id, year, versements, versements]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating envelope:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    await query('DELETE FROM envelopes WHERE id = ?', [parseInt(id)]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting envelope:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
