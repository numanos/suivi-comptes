import { NextRequest, NextResponse } from 'next/server';
import { query, getConnection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const categoryId = searchParams.get('category');
    const subcategoryId = searchParams.get('subcategory');
    const libelle = searchParams.get('libelle');
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const getYears = searchParams.get('getYears');

    // Return available years
    if (getYears === 'true') {
      const years = await query(`
        SELECT DISTINCT YEAR(date) as year FROM transactions ORDER BY year DESC
      `) as any[];
      return NextResponse.json({ years: years.map(y => y.year) });
    }

    // Get total count for pagination
    let countSql = `SELECT COUNT(*) as total FROM transactions t WHERE 1=1`;
    const countParams: any[] = [];

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
      countSql += ' AND MONTH(t.date) = ?';
      params.push(parseInt(month));
      countParams.push(parseInt(month));
    }

    if (categoryId) {
      sql += ' AND t.category_id = ?';
      countSql += ' AND t.category_id = ?';
      params.push(parseInt(categoryId));
      countParams.push(parseInt(categoryId));
    }

    if (subcategoryId) {
      sql += ' AND t.subcategory_id = ?';
      countSql += ' AND t.subcategory_id = ?';
      params.push(parseInt(subcategoryId));
      countParams.push(parseInt(subcategoryId));
    }

    if (libelle) {
      sql += ' AND t.libelle LIKE ?';
      countSql += ' AND t.libelle LIKE ?';
      params.push(`%${libelle}%`);
      countParams.push(`%${libelle}%`);
    }

    // Get total count
    const countResult = await query(countSql, countParams) as any[];
    const total = countResult[0]?.total || 0;

    sql += ' ORDER BY t.date DESC, t.id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const rows = await query(sql, params) as any[];

    return NextResponse.json({ transactions: rows, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// Simple normalize for comparison - lowercase and remove accents
function normalizeForMatch(str: string): string {
  if (!str) return '';
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

async function findOrCreateCategory(categoryName: string, themeId: number): Promise<number> {
  if (!categoryName || !categoryName.trim()) {
    categoryName = 'Autres';
  }
  
  // Try to find existing by exact match first
  const existing = await query(
    'SELECT id FROM categories WHERE name = ?',
    [categoryName.trim()]
  ) as any[];
  
  if (existing.length > 0) return existing[0].id;
  
  // Try to find by normalized match
  const normName = normalizeForMatch(categoryName);
  const allCats = await query('SELECT id, name FROM categories') as any[];
  
  for (const cat of allCats) {
    if (normalizeForMatch(cat.name) === normName) {
      return cat.id;
    }
  }
  
  // Create new
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
  
  // Try exact match
  const existing = await query(
    'SELECT id FROM subcategories WHERE name = ? AND category_id = ?',
    [subcategoryName.trim(), categoryId]
  ) as any[];
  
  if (existing.length > 0) return existing[0].id;
  
  // Try normalized match
  const normName = normalizeForMatch(subcategoryName);
  const allSubs = await query('SELECT id, name, category_id FROM subcategories WHERE category_id = ?', [categoryId]) as any[];
  
  for (const sub of allSubs) {
    if (normalizeForMatch(sub.name) === normName) {
      return sub.id;
    }
  }
  
  // Create new
  const result = await query(
    'INSERT INTO subcategories (name, category_id) VALUES (?, ?)',
    [subcategoryName.trim(), categoryId]
  ) as any;
  
  return result.insertId;
}

function guessTheme(categoryName: string): number {
  if (!categoryName) return 2;
  const name = normalizeForMatch(categoryName);
  if (name.includes('epargne') || name.includes('assurance') || name.includes('livret') || name.includes('placement')) return 4;
  if (name.includes('salaire') || name.includes('revenu') || name.includes('allocation') || name.includes('autresrevenus')) return 3;
  if (name.includes('impot') || name.includes('taxe') || name.includes('logement') || name.includes('credit') || name.includes('loyer')) return 1;
  return 2;
}

function fixEncoding(str: string): string {
  if (!str) return '';
  return str
    .replace(/\xe9/g, 'é')
    .replace(/\xe8/g, 'è')
    .replace(/\xe0/g, 'à')
    .replace(/\xe2/g, 'â')
    .replace(/\xe4/g, 'ä')
    .replace(/\xf9/g, 'ù')
    .replace(/\xfb/g, 'û')
    .replace(/\xfc/g, 'ü')
    .replace(/\xf4/g, 'ô')
    .replace(/\xf6/g, 'ö')
    .replace(/\xe7/g, 'ç')
    .replace(/\xe1/g, 'á')
    .replace(/\xe3/g, 'ã')
    .replace(/\xed/g, 'í')
    .replace(/\xf3/g, 'ó')
    .replace(/\xf1/g, 'ñ')
    .replace(/\xc9/g, 'É')
    .replace(/\xc8/g, 'È')
    .replace(/\xc0/g, 'À')
    .replace(/\xc2/g, 'Â')
    .replace(/\xc7/g, 'Ç');
}

async function transactionExists(date: string, libelle: string, amount: number): Promise<boolean> {
  const trimmedLibelle = libelle.trim();
  const result = await query(
    'SELECT id FROM transactions WHERE date = ? AND TRIM(libelle) = ? AND amount = ? LIMIT 1',
    [date, trimmedLibelle, amount]
  ) as any[];
  return result.length > 0;
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
    const dryRun = formData.get('dryRun') === 'true';
    const skipDuplicates = formData.get('skipDuplicates') !== 'false';

    if (!file) {
      return NextResponse.json({ error: 'Fichier requis' }, { status: 400 });
    }

    // Read as ArrayBuffer and decode as ISO-8859-1
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder('iso-8859-1');
    let text = decoder.decode(buffer);
    
    // Normalize line endings
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'Fichier CSV invalide ou vide' }, { status: 400 });
    }
    
    // Parse header
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().trim());
    
    console.log('Headers:', headers);
    
    // Find column indices - use includes for fuzzy matching
    const dateIdx = headers.findIndex(h => h === 'date');
    const libelleIdx = headers.findIndex(h => h.includes('libell'));
    const noteIdx = headers.findIndex(h => h.includes('note'));
    const montantIdx = headers.findIndex(h => h.includes('montant'));
    const categorieIdx = headers.findIndex(h => h.includes('categor') || h.includes('cat'));
    const sousCatIdx = headers.findIndex(h => h.includes('sous'));
    const soldeIdx = headers.findIndex(h => h.includes('solde'));
    
    console.log('Column indices:', { dateIdx, libelleIdx, noteIdx, montantIdx, categorieIdx, sousCatIdx, soldeIdx });
    
    // Parse data lines
    const data: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length >= 4) {
        data.push(values);
      }
    }
    
    console.log('Data rows:', data.length);
    if (data.length > 0) {
      console.log('First row:', data[0]);
    }

    // Parse all rows first to detect duplicates within the file
    const parsedRows: any[] = [];
    const duplicatesInFile: any[] = [];
    const seenKeys = new Set<string>();
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      const dateStr = dateIdx >= 0 && dateIdx < row.length ? row[dateIdx] : '';
      const libelleRaw = libelleIdx >= 0 && libelleIdx < row.length ? row[libelleIdx] : '';
      const amountStr = montantIdx >= 0 && montantIdx < row.length ? row[montantIdx] : '0';
      
      const libelle = fixEncoding(libelleRaw).trim();
      const amountClean = amountStr.replace(' ', '').replace(',', '.');
      const amount = parseFloat(amountClean);
      
      const dateParts = dateStr.split('/');
      let date = null;
      if (dateParts.length === 3) {
        date = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
      }
      
      if (!date) continue;
      
      const key = `${date}|${libelle}|${amount}`;
      
      if (seenKeys.has(key)) {
        duplicatesInFile.push({ date, libelle, amount, rowIndex: i + 2 });
      } else {
        seenKeys.add(key);
        parsedRows.push({ row, date, libelle, amount, index: i });
      }
    }

    // Dry run - return duplicates info
    if (dryRun) {
      console.log('DRY RUN - returning duplicates info:', { duplicatesCount: duplicatesInFile.length });
      return NextResponse.json({ 
        dryRun: true, 
        totalRows: data.length,
        duplicatesInFile: duplicatesInFile.slice(0, 50),
        duplicatesCount: duplicatesInFile.length,
        uniqueRows: parsedRows.length
      });
    }

    // If user skipped duplicates, use parsedRows (unique rows only)
    // If user wants all rows, add back the duplicates from the file
    console.log('skipDuplicates:', skipDuplicates, 'duplicatesInFile:', duplicatesInFile.length, 'parsedRows:', parsedRows.length);
    
    let rowsToImport = parsedRows;
    if (!skipDuplicates && duplicatesInFile.length > 0) {
      // Add back duplicate rows from the original data
      for (const dup of duplicatesInFile) {
        const rowIdx = dup.rowIndex - 2;
        if (rowIdx >= 0 && rowIdx < data.length) {
          const row = data[rowIdx];
          rowsToImport.push({ row, date: dup.date, libelle: dup.libelle, amount: dup.amount, index: rowIdx });
        }
      }
    }

    console.log('rowsToImport.length:', rowsToImport.length);

    // Create import batch
    const [batchResult] = await connection.query(
      'INSERT INTO import_batches (filename, record_count) VALUES (?, ?)',
      [file.name, rowsToImport.length]
    );
    const batchId = (batchResult as any).insertId;

    // Get existing categories
    const [categories] = await connection.query(`
      SELECT c.id, c.name, c.theme_id
      FROM categories c
    `) as any[];

    // Build lookup maps
    const categoryById = new Map<number, any>();
    const categoryByName = new Map<string, any>();
    const categoryByNormalized = new Map<string, any>();
    
    for (const cat of categories) {
      const fixedName = fixEncoding(cat.name);
      categoryById.set(cat.id, cat);
      categoryByName.set(fixedName.toLowerCase(), cat);
      categoryByNormalized.set(normalizeForMatch(fixedName), cat);
    }

    // Get subcategories
    const [subcategories] = await connection.query(`
      SELECT s.id, s.name, s.category_id
      FROM subcategories s
    `) as any[];
    
    const subByName = new Map<string, any>();
    for (const sub of subcategories) {
      const fixedName = fixEncoding(sub.name);
      subByName.set(`${sub.category_id}|${fixedName.toLowerCase()}`, sub);
      subByName.set(`${sub.category_id}|${normalizeForMatch(fixedName)}`, sub);
    }

    console.log('Categories loaded:', categories.length);

    let imported = 0;
    let skipped = 0;
    let newCategories = 0;
    let newSubcategories = 0;

    console.log('Starting import of', rowsToImport.length, 'rows');

    for (let i = 0; i < rowsToImport.length; i++) {
      try {
        const { row, date, libelle } = rowsToImport[i];
        
        // Get values by index
        const noteRaw = noteIdx >= 0 && noteIdx < row.length ? row[noteIdx] : '';
        const amountStr = montantIdx >= 0 && montantIdx < row.length ? row[montantIdx] : '0';
        const categoryNameRaw = categorieIdx >= 0 && categorieIdx < row.length ? row[categorieIdx] : '';
        const subcategoryNameRaw = sousCatIdx >= 0 && sousCatIdx < row.length ? row[sousCatIdx] : '';
        const balanceStr = soldeIdx >= 0 && soldeIdx < row.length ? row[soldeIdx] : '0';

        // Fix encoding on all text fields
        const note = fixEncoding(noteRaw);
        const categoryName = fixEncoding(categoryNameRaw);
        const subcategoryName = fixEncoding(subcategoryNameRaw);

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

        // Use libelle or category as fallback
        const finalLibelle = libelle || categoryName || 'Transaction sans libellé';

        // Check for duplicate in database only if not skipping duplicates
        if (skipDuplicates && await transactionExists(date, finalLibelle, amount)) {
          console.log(`DUPLICATE DB: date=${date}, libelle=${finalLibelle.trim()}, amount=${amount}`);
          skipped++;
          continue;
        }

        // Find or create category
        let categoryId: number | null = null;
        let subcategoryId: number | null = null;

        if (categoryName && categoryName.trim()) {
          const catLower = categoryName.toLowerCase();
          const catNorm = normalizeForMatch(categoryName);
          
          // Check exact match
          if (categoryByName.has(catLower)) {
            categoryId = categoryByName.get(catLower).id;
          } else if (categoryByNormalized.has(catNorm)) {
            categoryId = categoryByNormalized.get(catNorm).id;
          } else {
            // Create new category
            const themeId = guessTheme(categoryName);
            const [result] = await connection.query(
              'INSERT INTO categories (name, theme_id) VALUES (?, ?)',
              [categoryName.trim(), themeId]
            );
            categoryId = (result as any).insertId;
            newCategories++;
            
            // Add to cache
            categoryByName.set(catLower, { id: categoryId, name: categoryName });
            categoryByNormalized.set(catNorm, { id: categoryId, name: categoryName });
          }
          
          // Find or create subcategory
          if (subcategoryName && subcategoryName.trim() && categoryId) {
            const subKey = `${categoryId}|${subcategoryName.toLowerCase()}`;
            const subKeyNorm = `${categoryId}|${normalizeForMatch(subcategoryName)}`;
            
            if (subByName.has(subKey)) {
              subcategoryId = subByName.get(subKey).id;
            } else if (subByName.has(subKeyNorm)) {
              subcategoryId = subByName.get(subKeyNorm).id;
            } else {
              // Create new subcategory
              const [result] = await connection.query(
                'INSERT INTO subcategories (name, category_id) VALUES (?, ?)',
                [subcategoryName.trim(), categoryId]
              );
              subcategoryId = (result as any).insertId;
              newSubcategories++;
              
              // Add to cache
              subByName.set(subKey, { id: subcategoryId, name: subcategoryName, category_id: categoryId });
            }
          }
        }

        await connection.query(
          `INSERT INTO transactions (date, libelle, note, amount, category_id, subcategory_id, balance, import_batch_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [date, finalLibelle.trim(), note || null, amount, categoryId, subcategoryId || null, balance, batchId]
        );
        imported++;
      } catch (rowError: any) {
        console.error(`Error row ${i}:`, rowError);
      }
    }

    await connection.query('UPDATE import_batches SET record_count = ? WHERE id = ?', [imported, batchId]);

    console.log('Import complete:', { imported, skipped, newCategories, newSubcategories });

    return NextResponse.json({ 
      success: true, 
      imported, 
      skipped, 
      newCategories, 
      newSubcategories, 
      batchId,
      duplicatesInFile: duplicatesInFile.length
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
