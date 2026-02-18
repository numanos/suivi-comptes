import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'cookie';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const rows = await query(`
      SELECT t.id as theme_id, t.name as theme_name, t.display_order,
             c.id as category_id, c.name as category_name,
             s.id as subcategory_id, s.name as subcategory_name
      FROM themes t
      LEFT JOIN categories c ON c.theme_id = t.id
      LEFT JOIN subcategories s ON s.category_id = c.id
      ORDER BY t.display_order, c.id, s.id
    `) as any[];

    // Group by theme -> category -> subcategory
    const themesMap = new Map();
    
    for (const row of rows) {
      if (!themesMap.has(row.theme_id)) {
        themesMap.set(row.theme_id, {
          id: row.theme_id,
          name: row.theme_name,
          display_order: row.display_order,
          categories: []
        });
      }
      
      const theme = themesMap.get(row.theme_id);
      
      if (row.category_id) {
        let category = theme.categories.find((c: any) => c.id === row.category_id);
        if (!category) {
          category = { id: row.category_id, name: row.category_name, subcategories: [] };
          theme.categories.push(category);
        }
        
        if (row.subcategory_id) {
          category.subcategories.push({ id: row.subcategory_id, name: row.subcategory_name });
        }
      }
    }

    const themes = Array.from(themesMap.values()).sort((a, b) => a.display_order - b.display_order);

    return NextResponse.json(themes);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, theme_id, subcategories } = await request.json();

    if (!name || !theme_id) {
      return NextResponse.json(
        { error: 'Nom et thème requis' },
        { status: 400 }
      );
    }

    const result = await query(
      'INSERT INTO categories (name, theme_id) VALUES (?, ?)',
      [name, theme_id]
    ) as any;

    const categoryId = result.insertId;

    // Add subcategories if provided
    if (subcategories && subcategories.length > 0) {
      for (const subName of subcategories) {
        if (subName && subName.trim()) {
          await query(
            'INSERT INTO subcategories (name, category_id) VALUES (?, ?)',
            [subName.trim(), categoryId]
          );
        }
      }
    }

    return NextResponse.json({ success: true, id: categoryId });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
