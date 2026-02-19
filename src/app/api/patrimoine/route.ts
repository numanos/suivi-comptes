import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const type = searchParams.get('type');

    if (type === 'envelopes') {
      const targetYear = parseInt(year || new Date().getFullYear().toString());
      const prevYear = targetYear - 1;
      
      // Try query with all columns, fallback to queries without new columns
      let envelopes: any[];
      try {
        envelopes = await query(`
          SELECT e.id, e.name, e.exclude_from_gains, e.closed_year, e.annual_versement, e.open_year, e.initial_amount,
                 ev.versements as year_versements,
                 ev_prev.versements as prev_year_versements,
                 p.id as placement_id, p.name as placement_name, 
                 p.type_placement, p.year, p.valorization
          FROM envelopes e
          LEFT JOIN envelope_versements ev ON ev.envelope_id = e.id AND ev.year = ?
          LEFT JOIN envelope_versements ev_prev ON ev_prev.envelope_id = e.id AND ev_prev.year = ?
          LEFT JOIN placements p ON p.envelope_id = e.id AND p.year = ?
          WHERE e.closed_year IS NULL OR e.closed_year > ?
          ORDER BY e.name
        `, [targetYear, prevYear, targetYear, targetYear]) as any[];
      } catch (error: any) {
        // ... existing fallback code ...
        console.error("Query failed with full columns, check DB schema", error);
        
        // Simplified fallback for just getting the envelopes if schema mismatch
        if (error.code === 'ER_BAD_FIELD_ERROR') {
          try {
             // Fallback to basic query without prev_year join if it fails (simplified for robustness)
             envelopes = await query(`
              SELECT e.id, e.name, e.exclude_from_gains, e.closed_year,
                     ev.versements as year_versements,
                     p.id as placement_id, p.name as placement_name, 
                     p.type_placement, p.year, p.valorization
              FROM envelopes e
              LEFT JOIN envelope_versements ev ON ev.envelope_id = e.id AND ev.year = ?
              LEFT JOIN placements p ON p.envelope_id = e.id AND p.year = ?
              WHERE e.closed_year IS NULL OR e.closed_year > ?
              ORDER BY e.name
            `, [targetYear, targetYear, targetYear]) as any[];
          } catch (e) {
             // Ultimate fallback
             envelopes = await query(`
              SELECT e.id, e.name, e.exclude_from_gains,
                     ev.versements as year_versements,
                     p.id as placement_id, p.name as placement_name, 
                     p.type_placement, p.year, p.valorization
              FROM envelopes e
              LEFT JOIN envelope_versements ev ON ev.envelope_id = e.id AND ev.year = ?
              LEFT JOIN placements p ON p.envelope_id = e.id AND p.year = ?
              ORDER BY e.name
            `, [targetYear, targetYear]) as any[];
          }
        } else {
            throw error;
        }
      }

      const envelopeMap = new Map();
      for (const row of envelopes) {
        if (!envelopeMap.has(row.id)) {
          envelopeMap.set(row.id, {
            id: row.id,
            name: row.name,
            exclude_from_gains: Boolean(row.exclude_from_gains),
            year_versements: row.year_versements || 0,
            prev_year_versements: row.prev_year_versements || 0,
            annual_versement: row.annual_versement,
            open_year: row.open_year,
            initial_amount: row.initial_amount || 0,
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

      // Try to get historical totals, but handle case where table doesn't exist
      let historicalTotals: any[] = [];
      try {
        historicalTotals = await query('SELECT * FROM historical_totals') as any[];
        console.log('Historical totals from DB:', historicalTotals);
      } catch (error: any) {
        // Table doesn't exist, skip historical data
        if (error.code !== 'ER_NO_SUCH_TABLE') {
          throw error;
        }
        console.log('historical_totals table does not exist');
      }
      const historicalMap = new Map(historicalTotals.map(h => [h.year, h.total]));
      console.log('Historical map:', Array.from(historicalMap.entries()));

      const allYears = new Set([...years.map(y => y.year), ...historicalTotals.map(h => h.year)]);
      const sortedYears = Array.from(allYears).sort((a, b) => b - a);

      const evolution = [];

      for (const yr of sortedYears) {
        const isHistorical = historicalMap.has(yr);
        
        let totals: Record<string, number>;
        let total: number;

        if (isHistorical) {
          totals = {
            'Action': 0,
            'Immo': 0,
            'Obligations': 0,
            'Liquidites': 0
          };
          total = Number(historicalMap.get(yr)) || 0;
        } else {
          const rows = await query(`
            SELECT 
              p.type_placement as type,
              SUM(p.valorization) as total
            FROM placements p
            WHERE p.year = ?
            GROUP BY p.type_placement
          `, [yr]) as any[];

          totals = {
            'Action': 0,
            'Immo': 0,
            'Obligations': 0,
            'Liquidites': 0
          };

          for (const row of rows) {
            totals[row.type] = Number(row.total) || 0;
          }

          total = Object.values(totals).reduce((a: number, b: number) => a + b, 0);
        }
        
        let prevTotal = 0;
        
        if (yr > 1) {
          if (historicalMap.has(yr - 1)) {
            prevTotal = Number(historicalMap.get(yr - 1)) || 0;
          } else {
            const prevYearRows = await query(`
              SELECT SUM(p.valorization) as total
              FROM placements p
              WHERE p.year = ?
            `, [yr - 1]) as any[];
            prevTotal = Number(prevYearRows[0]?.total) || 0;
          }
        }

        const evolutionVal = total - prevTotal;
        const evolutionPercent = prevTotal > 0 ? (evolutionVal / prevTotal) * 100 : null;

        evolution.push({
          year: yr,
          isHistorical,
          actions: totals['Action'],
          immo: totals['Immo'],
          obligations: totals['Obligations'],
          liquidites: totals['Liquidites'],
          total,
          evolution: prevTotal > 0 ? evolutionVal : null,
          evolution_percent: prevTotal > 0 ? evolutionPercent : null
        });
      }

      console.log('Evolution data to return:', evolution);
      return NextResponse.json(evolution);
    }

    if (type === 'summary') {
      const targetYear = year ? parseInt(year) : new Date().getFullYear();
      const prevYear = targetYear - 1;
      
      const rows = await query(`
        SELECT 
          p.type_placement as type,
          SUM(p.valorization) as total
        FROM placements p
        WHERE p.year = ?
        GROUP BY p.type_placement
      `, [targetYear]) as any[];

      const hasDataForYear = rows.length > 0 && rows.some(r => r.total > 0);

      const totals: Record<string, number> = {
        'Action': 0,
        'Immo': 0,
        'Obligations': 0,
        'Liquidites': 0
      };

      for (const row of rows) {
        totals[row.type] = Number(row.total) || 0;
      }

      const total = Object.values(totals).reduce((a: number, b: number) => a + b, 0);

      const prevYearRows = await query(`
        SELECT p.type_placement as type, SUM(p.valorization) as total
        FROM placements p
        WHERE p.year = ?
        GROUP BY p.type_placement
      `, [prevYear]) as any[];

      const prevTotals: Record<string, number> = {
        'Action': 0,
        'Immo': 0,
        'Obligations': 0,
        'Liquidites': 0
      };

      for (const row of prevYearRows) {
        prevTotals[row.type] = Number(row.total) || 0;
      }

      const prevTotal = Object.values(prevTotals).reduce((a: number, b: number) => a + b, 0);

      const versementsResult = await query(`
        SELECT SUM(versements) as total FROM envelope_versements WHERE year = ?
      `, [targetYear]) as any[];
      const yearVersements = Number(versementsResult[0]?.total) || 0;

      const prevVersementsResult = await query(`
        SELECT SUM(versements) as total FROM envelope_versements WHERE year = ?
      `, [prevYear]) as any[];
      const prevYearVersements = Number(prevVersementsResult[0]?.total) || 0;

      const summary = {
        year: targetYear,
        prevYear,
        hasData: hasDataForYear,
        totals,
        total,
        prevTotals,
        prevTotal,
        yearVersements,
        prevYearVersements,
        evolution: hasDataForYear ? {
          Action: totals['Action'] - prevTotals['Action'],
          Immo: totals['Immo'] - prevTotals['Immo'],
          Obligations: totals['Obligations'] - prevTotals['Obligations'],
          Liquidites: totals['Liquidites'] - prevTotals['Liquidites'],
          total: total - prevTotal
        } : null,
        evolutionPercent: hasDataForYear ? {
          Action: prevTotals['Action'] > 0 ? ((totals['Action'] - prevTotals['Action']) / prevTotals['Action']) * 100 : null,
          Immo: prevTotals['Immo'] > 0 ? ((totals['Immo'] - prevTotals['Immo']) / prevTotals['Immo']) * 100 : null,
          Obligations: prevTotals['Obligations'] > 0 ? ((totals['Obligations'] - prevTotals['Obligations']) / prevTotals['Obligations']) * 100 : null,
          Liquidites: prevTotals['Liquidites'] > 0 ? ((totals['Liquidites'] - prevTotals['Liquidites']) / prevTotals['Liquidites']) * 100 : null,
          total: prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null
        } : null
      };

      return NextResponse.json(summary);
    }

    if (type === 'historical') {
      try {
        const historical = await query('SELECT * FROM historical_totals ORDER BY year DESC');
        return NextResponse.json(historical);
      } catch (error: any) {
        if (error.code === 'ER_NO_SUCH_TABLE') {
          return NextResponse.json([]);
        }
        throw error;
      }
    }

    return NextResponse.json({ error: 'Type requis' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching patrimoine:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, versements, year, exclude_from_gains, historical_year, historical_total, open_year } = body;

    if (historical_year !== undefined && historical_total !== undefined) {
      console.log('Saving historical data:', { historical_year, historical_total });
      try {
        const result = await query(
          `INSERT INTO historical_totals (year, total) VALUES (?, ?) ON DUPLICATE KEY UPDATE total = ?`,
          [parseInt(historical_year), parseFloat(historical_total), parseFloat(historical_total)]
        );
        console.log('Historical data saved:', result);
        return NextResponse.json({ success: true });
      } catch (error: any) {
        console.error('Error saving historical data:', error);
        if (error.code === 'ER_NO_SUCH_TABLE') {
          return NextResponse.json({ error: 'La table historical_totals n\'existe pas. Veuillez exécuter npm run db:init pour créer les tables manquantes.' }, { status: 400 });
        }
        throw error;
      }
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Nom requis' },
        { status: 400 }
      );
    }

    const result = await query(
      'INSERT INTO envelopes (name, exclude_from_gains, open_year) VALUES (?, ?, ?)',
      [name, exclude_from_gains ? true : false, open_year ? parseInt(open_year) : null]
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
    const { id, name, exclude_from_gains, year, versements, close_envelope, annual_versement, open_year, initial_amount } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    try {
      await query(
        'UPDATE envelopes SET name = ?, exclude_from_gains = ?, closed_year = ?, annual_versement = ?, open_year = ?, initial_amount = ? WHERE id = ?',
        [name || '', exclude_from_gains ? true : false, close_envelope ? parseInt(year) : null, annual_versement !== undefined ? annual_versement : null, open_year ? parseInt(open_year) : null, initial_amount !== undefined ? parseFloat(initial_amount) : 0, id]
      );
    } catch (error: any) {
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        // Try without initial_amount
        try {
          await query(
            'UPDATE envelopes SET name = ?, exclude_from_gains = ?, closed_year = ?, annual_versement = ?, open_year = ? WHERE id = ?',
            [name || '', exclude_from_gains ? true : false, close_envelope ? parseInt(year) : null, annual_versement !== undefined ? annual_versement : null, open_year ? parseInt(open_year) : null, id]
          );
        } catch (error2: any) {
            // ... existing fallbacks ...
             if (error2.code === 'ER_BAD_FIELD_ERROR') {
               // Try without open_year
               try {
                 await query(
                   'UPDATE envelopes SET name = ?, exclude_from_gains = ?, closed_year = ?, annual_versement = ? WHERE id = ?',
                   [name || '', exclude_from_gains ? true : false, close_envelope ? parseInt(year) : null, annual_versement !== undefined ? annual_versement : null, id]
                 );
               } catch (error3: any) {
                 if (error3.code === 'ER_BAD_FIELD_ERROR' && error3.sqlMessage?.includes('closed_year')) {
                   // Fallback: update without closed_year column
                   try {
                     await query(
                       'UPDATE envelopes SET name = ?, exclude_from_gains = ?, annual_versement = ? WHERE id = ?',
                       [name || '', exclude_from_gains ? true : false, annual_versement !== undefined ? annual_versement : null, id]
                     );
                   } catch (error4: any) {
                      if (error4.code === 'ER_BAD_FIELD_ERROR' && error4.sqlMessage?.includes('annual_versement')) {
                        // Fallback: update without annual_versement column
                        await query(
                          'UPDATE envelopes SET name = ?, exclude_from_gains = ? WHERE id = ?',
                          [name || '', exclude_from_gains ? true : false, id]
                        );
                      } else {
                        throw error4;
                      }
                   }
                 } else if (error3.code === 'ER_BAD_FIELD_ERROR' && error3.sqlMessage?.includes('annual_versement')) {
                   // Fallback: update without annual_versement column
                   await query(
                     'UPDATE envelopes SET name = ?, exclude_from_gains = ?, closed_year = ? WHERE id = ?',
                     [name || '', exclude_from_gains ? true : false, close_envelope ? parseInt(year) : null, id]
                   );
                 } else {
                   throw error3;
                 }
               }
             } else {
               throw error2;
             }
        }
      } else {
        throw error;
      }
    }

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
    const envelopeId = searchParams.get('envelope_id');
    const year = searchParams.get('year');
    const historical_year = searchParams.get('historical_year');

    if (historical_year) {
      try {
        await query('DELETE FROM historical_totals WHERE year = ?', [parseInt(historical_year)]);
        return NextResponse.json({ success: true });
      } catch (error: any) {
        if (error.code === 'ER_NO_SUCH_TABLE') {
          return NextResponse.json({ error: 'La table historical_totals n\'existe pas.' }, { status: 400 });
        }
        throw error;
      }
    }

    if (envelopeId && year) {
      await query('DELETE FROM placements WHERE envelope_id = ? AND year = ?', [parseInt(envelopeId), parseInt(year)]);
      return NextResponse.json({ success: true });
    }

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
