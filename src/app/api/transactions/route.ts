import { NextRequest, NextResponse } from 'next/server';
import { query, getConnection } from '@/lib/db';
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

async function findOrCreateCategory(categoryName: string, themeId: number): Promise<number> {
  if (!categoryName || !categoryName.trim()) {
    categoryName = 'Autres';
  }
  const existing = await query(
    'SELECT id FROM categories WHERE LOWER(name) = ? AND theme_id = ?',
    [categoryName.toLowerCase(), themeId]
  ) as any[];
  
  if (existing.length > 0) return existing[0].id;
  
  const result = await query(
    'INSERT INTO categories (name, theme_id) VALUES (?, ?)',
    [categoryName.trim(), themeId]
  ) as any;
  
  return result.insertId;
}

async function findOrCreateSubcategory(subcategoryName: string, categoryId: number): Promise<number> {
  if (!subcategoryName || !subcategoryName.trim()) {
    return 0;
  }
  const existing = await query(
    'SELECT id FROM subcategories WHERE LOWER(name) = ? AND category_id = ?',
    [subcategoryName.toLowerCase(), categoryId]
  ) as any[];
  
  if (existing.length > 0) return existing[0].id;
  
  const result = await query(
    'INSERT INTO subcategories (name, category_id) VALUES (?, ?)',
    [subcategoryName.trim(), categoryId]
  ) as any;
  
  return result.insertId;
}

function guessTheme(categoryName: string): number {
  if (!categoryName) return 2;
  const name = categoryName.toLowerCase();
  if (name.includes('epargne') || name.includes('assurance') || name.includes('livret') || name.includes('placement')) return 4;
  if (name.includes('salaire') || name.includes('revenu') || name.includes('allocation') || name.includes('autres revenus')) return 3;
  if (name.includes('impôt') || name.includes('taxe') || name.includes('logement') || name.includes('crédit') || name.includes('loyer')) return 1;
  return 2;
}

async function transactionExists(date: string, libelle: string, amount: number): Promise<boolean> {
  if (!libelle) return false;
  const existing = await query(
    'SELECT id FROM transactions WHERE date = ? AND libelle = ? AND amount = ? LIMIT 1',
    [date, libelle.substring(0, 255), amount]
  ) as any[];
  return existing.length > 0;
}

export async function POST(request: NextRequest) {
  const connection = await getConnection();
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Fichier requis' }, { status: 400 });
    }

    let text = await file.text();
    
    // Handle different encodings
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Try to detect and fix encoding
    try {
      text = new TextDecoder('utf-8', { fatal: false }).decode(new TextEncoder().encode(text));
    } catch (e) {
      // Keep original if UTF-8 decode fails
    }
    
    // Try with ; first, then ,
    let result = Papa.parse(text, {
      header: true,
      delimiter: ';',
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim().toLowerCase()
    });

    // If no data, try with comma
    if (result.data.length === 0 || !result.data[0] || Object.keys(result.data[0]).length < 3) {
      result = Papa.parse(text, {
        header: true,
        delimiter: ',',
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim().toLowerCase()
      });
    }

    if (result.errors.length > 0) {
      console.log('Parse errors:', result.errors);
    }

    const data = result.data as any[];
    console.log('Parsed rows:', data.length);
    if (data.length > 0) {
      console.log('First row keys:', Object.keys(data[0]));
      console.log('First row sample:', JSON.stringify(data[0]));
    }
    
    const [batchResult] = await connection.query(
      'INSERT INTO import_batches (filename, record_count) VALUES (?, ?)',
      [file.name, data.length]
    );
    const batchId = (batchResult as any).insertId;

    const [categories] = await connection.query(`
      SELECT c.id, c.name, c.theme_id, GROUP_CONCAT(s.name) as subcategory_names
      FROM categories c
      LEFT JOIN subcategories s ON s.category_id = c.id
      GROUP BY c.id
    `) as any[];

    const categoryMap = new Map();
    for (const cat of categories) {
      categoryMap.set(cat.name.toLowerCase(), { id: cat.id, themeId: cat.theme_id });
      if (cat.subcategory_names) {
        const subs = cat.subcategory_names.split(',');
        for (const sub of subs) {
          categoryMap.set(sub.toLowerCase(), { categoryId: cat.id, subName: sub });
        }
      }
    }

    let imported = 0;
    let skipped = 0;
    let newCategories = 0;
    let newSubcategories = 0;
    const errors: string[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        // Map the columns (headers are now lowercase)
        const dateStr = row['date'] || '';
        const libelle = row['libellé'] || row['libelle'] || '';
        const note = row['note personnelle'] || row['note'] || '';
        const amountStr = row['montant'] || '0';
        const categoryName = row['catégorie'] || row['categorie'] || '';
        const subcategoryName = row['sous-catégorie'] || row['sous categorie'] || '';
        const balanceStr = row['solde'] || '0';

        console.log(`Row ${i}:`, { dateStr, libelle, categoryName });

        // Parse date (format: DD/MM/YYYY)
        const dateParts = dateStr?.split('/');
        let date = null;
        if (dateParts && dateParts.length === 3) {
          date = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
        }

        if (!date) {
          console.log(`Skipping row ${i}: no date`);
          continue;
        }

        // Use category as libelle if empty

        // Parse amount
        let amount = 0;
        const amountClean = amountStr.replace(' ', '').replace(',', '.');
        amount = parseFloat(amountClean);

        // Parse balance
        let balance = null;
        const balanceClean = balanceStr.replace(' ', '').replace(',', '.');
        if (balanceClean) {
          balance = parseFloat(balanceClean);
        }

        // Use category as libelle if empty
        const finalLibelle = libelle || categoryName || 'Transaction sans libellé';

        // Check for duplicate
        if (await transactionExists(date, finalLibelle, amount)) {
          skipped++;
          continue;
        }

        // Find or create category
        let categoryId: number | null = null;
        let subcategoryId: number | null = null;

        if (categoryName && categoryName.trim()) {
          const catKey = categoryName.toLowerCase().trim();
          if (categoryMap.has(catKey)) {
            const catData = categoryMap.get(catKey);
            categoryId = catData.id;
          } else {
            const themeId = guessTheme(categoryName);
            categoryId = await findOrCreateCategory(categoryName.trim(), themeId);
            newCategories++;
            categoryMap.set(catKey, { id: categoryId, themeId });
          }
          
          // Find or create subcategory
          if (subcategoryName && subcategoryName.trim() && categoryId) {
            const subKey = subcategoryName.toLowerCase().trim();
            if (categoryMap.has(subKey)) {
              const subData = categoryMap.get(subKey);
              subcategoryId = subData.categoryId;
            } else {
              subcategoryId = await findOrCreateSubcategory(subcategoryName.trim(), categoryId);
              if (subcategoryId > 0) {
                newSubcategories++;
                categoryMap.set(subKey, { categoryId, subName: subcategoryName.trim() });
              }
            }
          }
        }

        await connection.query(
          `INSERT INTO transactions (date, libelle, note, amount, category_id, subcategory_id, balance, import_batch_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [date, finalLibelle, note || null, amount, categoryId, subcategoryId || null, balance, batchId]
        );
        imported++;
      } catch (rowError: any) {
        console.error(`Error row ${i}:`, rowError);
        errors.push(`Ligne ${i + 1}: ${rowError.message}`);
      }
    }

    await connection.query('UPDATE import_batches SET record_count = ? WHERE id = ?', [imported, batchId]);

    return NextResponse.json({ 
      success: true, 
      imported, 
      skipped, 
      newCategories, 
      newSubcategories, 
      errors, 
      batchId 
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Erreur serveur: ' + String(error) }, { status: 500 });
  } finally {
    (connection as any).release();
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, libelle, note, category_id, subcategory_id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    await query(
      'UPDATE transactions SET libelle = ?, note = ?, category_id = ?, subcategory_id = ? WHERE id = ?',
      [libelle || '', note || null, category_id || null, subcategory_id || null, id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const ids = searchParams.get('ids');

    if (ids) {
      const idArray = ids.split(',').map((i: string) => parseInt(i)).filter((i: number) => !isNaN(i));
      if (idArray.length > 0) {
        await query(`DELETE FROM transactions WHERE id IN (${idArray.join(',')})`);
        return NextResponse.json({ success: true, deleted: idArray.length });
      }
    } else if (id) {
      await query('DELETE FROM transactions WHERE id = ?', [parseInt(id)]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'ID requis' }, { status: 400 });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
