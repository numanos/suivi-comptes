import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { name, category_id } = await request.json();

    if (!name || !category_id) {
      return NextResponse.json({ error: 'Nom et catégorie requis' }, { status: 400 });
    }

    const result = await query(
      'INSERT INTO subcategories (name, category_id) VALUES (?, ?)',
      [name, category_id]
    ) as any;

    return NextResponse.json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('Error creating subcategory:', error);
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

    await query('DELETE FROM subcategories WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting subcategory:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
