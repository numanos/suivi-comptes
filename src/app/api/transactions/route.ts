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
  if (!libelle || !date) return false;
  const existing = await query(
    'SELECT id FROM transactions WHERE date = ? AND LOWER(libelle) = LOWER(?) AND amount = ? LIMIT 1',
    [date, libelle.substring(0, 255), amount]
  ) as any[];
  return existing.length > 0;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ';' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
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
    
    // Normalize line endings
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Convert from ISO-8859-1 to UTF-8 if needed
    try {
      text = text.replace(/[\x80-\xff]/g, (c) => {
        const code = c.charCodeAt(0);
        // Simple conversion for common characters
        const isoToUtf8: Record<number, string> = {
          0xe9: 'é', 0xe8: 'è', 0xe0: 'à', 0xe2: 'â', 0xe4: 'ä',
          0xf9: 'ù', 0xfb: 'û', 0xfc: 'ü',
          0xf4: 'ô', 0xf6: 'ö',
          0xe7: 'ç',
          0xe4: 'ä', 0xf6: 'ö', 0xfc: 'ü',
          0xc9: 'É', 0xc8: 'È', 0xc0: 'À', 0xc2: 'Â'
        };
        return isoToUtf8[code] || c;
      });
    } catch (e) {
      // Keep original
    }
    
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'Fichier CSV invalide ou vide' }, { status: 400 });
    }
    
    // Parse header to find column indices
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().trim());
    
    // Map columns by exact name
    const colMap: Record<string, number> = {};
    headers.forEach((h, idx) => {
      colMap[h] = idx;
    });
    
    // Find column indices - exact match preferred
    const dateIdx = colMap['date'] ?? headers.findIndex(h => h === 'date');
    const libelleIdx = colMap['libellé'] ?? colMap['libelle'] ?? headers.findIndex(h => h.includes('libell'));
    const noteIdx = colMap['note personnelle'] ?? headers.findIndex(h => h.includes('note'));
    const montantIdx = colMap['montant'] ?? headers.findIndex(h => h.includes('montant'));
    const categorieIdx = colMap['catégorie'] ?? colMap['categorie'] ?? headers.findIndex(h => h.includes('categor'));
    const sousCatIdx = colMap['sous-catégorie'] ?? colMap['sous categorie'] ?? headers.findIndex(h => h.includes('sous'));
    const soldeIdx = colMap['solde'] ?? headers.findIndex(h => h.includes('solde'));
    
    console.log('Headers found:', headers);
    console.log('Column map:', colMap);
    console.log('Column indices:', { dateIdx, libelleIdx, noteIdx, montantIdx, categorieIdx, sousCatIdx, soldeIdx });
    
    // Parse data lines
    const data: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length >= 2) {
        data.push(values);
      }
    }
    
    console.log('Parsed data rows:', data.length);
    if (data.length > 0) {
      console.log('First data row:', data[0]);
      console.log('Row 2:', data[1]);
    }
    
    // Create import batch
    const [batchResult] = await connection.query(
      'INSERT INTO import_batches (filename, record_count) VALUES (?, ?)',
      [file.name, data.length]
    );
    const batchId = (batchResult as any).insertId;

    // Get existing categories
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
      try {
        const row = data[i];
        
        // Get values by index
        const dateStr = dateIdx >= 0 && dateIdx < row.length ? row[dateIdx] : '';
        const libelle = libelleIdx >= 0 && libelleIdx < row.length ? row[libelleIdx] : '';
        const note = noteIdx >= 0 && noteIdx < row.length ? row[noteIdx] : '';
        const amountStr = montantIdx >= 0 && montantIdx < row.length ? row[montantIdx] : '0';
        const categoryName = categorieIdx >= 0 && categorieIdx < row.length ? row[categorieIdx] : '';
        const subcategoryName = sousCatIdx >= 0 && sousCatIdx < row.length ? row[sousCatIdx] : '';
        const balanceStr = soldeIdx >= 0 && soldeIdx < row.length ? row[soldeIdx] : '0';

        console.log(`Row ${i}: date=${dateStr}, libelle=${libelle.substring(0,40)}, note=${note}, cat=${categoryName}, sous=${subcategoryName}`);

        // Parse date (format: DD/MM/YYYY)
        const dateParts = dateStr.split('/');
        let date = null;
        if (dateParts.length === 3) {
          date = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
        }

        if (!date) {
          console.log(`Skipping row ${i}: no valid date`);
          continue;
        }

        // Parse amount
        let amount = 0;
        const amountClean = amountStr.replace(' ', '').replace(',', '.');
        amount = parseFloat(amountClean);

        // Parse balance
        let balance: number | null = null;
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
