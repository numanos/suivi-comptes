import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const rows = await query('SELECT * FROM themes ORDER BY display_order');
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching themes:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, display_order } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Nom requis' }, { status: 400 });
    }

    const result = await query(
      'INSERT INTO themes (name, display_order) VALUES (?, ?)',
      [name, display_order || 0]
    ) as any;

    return NextResponse.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('Error creating theme:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, name, display_order } = await request.json();

    if (!id || !name) {
      return NextResponse.json({ error: 'ID et nom requis' }, { status: 400 });
    }

    await query(
      'UPDATE themes SET name = ?, display_order = ? WHERE id = ?',
      [name, display_order || 0, id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating theme:', error);
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

    await query('DELETE FROM themes WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting theme:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
