import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const envelopeId = searchParams.get('envelope_id');
    const year = searchParams.get('year');

    let sql = 'SELECT * FROM placements WHERE 1=1';
    const params: any[] = [];

    if (envelopeId) {
      sql += ' AND envelope_id = ?';
      params.push(parseInt(envelopeId));
    }

    if (year) {
      sql += ' AND year = ?';
      params.push(parseInt(year));
    }

    sql += ' ORDER BY year DESC, id';

    const rows = await query(sql, params);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching placements:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { envelope_id, name, type_placement, year, versements, valorization } = await request.json();

    if (!envelope_id || !name || !year) {
      return NextResponse.json(
        { error: 'Enveloppe, nom et année requis' },
        { status: 400 }
      );
    }

    const result = await query(
      'INSERT INTO placements (envelope_id, name, type_placement, year, versements, valorization) VALUES (?, ?, ?, ?, ?, ?)',
      [envelope_id, name, type_placement || '', year, versements || 0, valorization || 0]
    ) as any;

    return NextResponse.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('Error creating placement:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, name, type_placement, year, versements, valorization } = await request.json();

    if (!id || !name) {
      return NextResponse.json(
        { error: 'ID et nom requis' },
        { status: 400 }
      );
    }

    await query(
      'UPDATE placements SET name = ?, type_placement = ?, year = ?, versements = ?, valorization = ? WHERE id = ?',
      [name, type_placement || '', year, versements || 0, valorization || 0, id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating placement:', error);
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

    await query('DELETE FROM placements WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting placement:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
