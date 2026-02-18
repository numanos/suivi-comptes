import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import Papa from 'papaparse';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const categoryId = searchParams.get('category');
    const limit = searchParams.get('limit') || '100';
    const offset = searchParams.get('offset') || '0';

    let sql = `
      SELECT t.id, t.date, t.libelle, t.note, t.amount, 
             t.category_id, c.name as category_name,
             t.subcategory_id, s.name as subcategory_name,
             t.balance, t.is_pointed, t.tags, t.created_at
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN subcategories s ON t.subcategory_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (year) {
      sql += ' AND YEAR(t.date) = ?';
      params.push(parseInt(year));
    }

    if (month) {
      sql += ' AND MONTH(t.date) = ?';
      params.push(parseInt(month));
    }

    if (categoryId) {
      sql += ' AND t.category_id = ?';
      params.push(parseInt(categoryId));
    }

    sql += ' ORDER BY t.date DESC, t.id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const rows = await query(sql, params) as any[];

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Fichier requis' }, { status: 400 });
    }

    const text = await file.text();
    
    // Parse CSV
    const result = Papa.parse(text, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim()
    });

    if (result.errors.length > 0) {
      return NextResponse.json(
        { error: 'Erreur parsing CSV', details: result.errors },
        { status: 400 }
      );
    }

    const data = result.data as any[];
    
    // Create import batch
    const batchResult = await query(
      'INSERT INTO import_batches (filename, record_count) VALUES (?, ?)',
      [file.name, data.length]
    ) as any;
    const batchId = batchResult.insertId;

    // Get all categories for matching
    const categories = await query(`
      SELECT c.id, c.name, GROUP_CONCAT(s.name) as subcategory_names
      FROM categories c
      LEFT JOIN subcategories s ON s.category_id = c.id
      GROUP BY c.id
    `) as any[];

    const categoryMap = new Map();
    for (const cat of categories) {
      categoryMap.set(cat.name.toLowerCase(), cat.id);
      if (cat.subcategory_names) {
        const subs = cat.subcategory_names.split(',');
        for (const sub of subs) {
          categoryMap.set(sub.toLowerCase(), { categoryId: cat.id, subName: sub });
        }
      }
    }

    let imported = 0;
    const errors: string[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        // Parse date (format: DD/MM/YYYY)
        const dateParts = row['Date']?.split('/');
        let date = null;
        if (dateParts && dateParts.length === 3) {
          date = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
        }

        // Parse amount (format: -14,1 or 55)
        let amount = 0;
        if (row['Montant']) {
          const amountStr = row['Montant'].replace(' ', '').replace(',', '.');
          amount = parseFloat(amountStr);
        }

        // Match category
        const categoryName = row['Catégorie']?.trim();
        let categoryId = null;
        let subcategoryId = null;

        if (categoryName && categoryMap.has(categoryName.toLowerCase())) {
          const match = categoryMap.get(categoryName.toLowerCase());
          if (typeof match === 'number') {
            categoryId = match;
          } else if (match && match.categoryId) {
            categoryId = match.categoryId;
            // Try to find subcategory
            const subName = row['Sous-catégorie']?.trim();
            if (subName) {
              const subs = await query(
                'SELECT id FROM subcategories WHERE category_id = ? AND LOWER(name) = ?',
                [categoryId, subName.toLowerCase()]
              ) as any[];
              if (subs.length > 0) {
                subcategoryId = subs[0].id;
              }
            }
          }
        }

        await query(
          `INSERT INTO transactions (date, libelle, note, amount, category_id, subcategory_id, balance, import_batch_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            date,
            row['Libellé'] || '',
            row['Note personnelle'] || null,
            amount,
            categoryId,
            subcategoryId,
            row['Solde'] ? parseFloat(row['Solde'].replace(',', '.')) : null,
            batchId
          ]
        );
        imported++;
      } catch (rowError: any) {
        errors.push(`Ligne ${i + 1}: ${rowError.message}`);
      }
    }

    // Update batch count
    await query(
      'UPDATE import_batches SET record_count = ? WHERE id = ?',
      [imported, batchId]
    );

    return NextResponse.json({
      success: true,
      imported,
      errors,
      batchId
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
