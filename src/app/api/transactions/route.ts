import { NextRequest, NextResponse } from 'next/server';
import { query, getConnection } from '@/lib/db';

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

// Convert ISO-8859-1 to UTF-8
function convertToUtf8(text: string): string {
  return text.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code >= 0x80 && code <= 0xFF) {
      const isoToUtf8: Record<number, string> = {
        0x80: '€', 0x81: '�', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡',
        0x88: 'ˆ', 0x89: '‰', 0x8A: 'Š', 0x8B: '‹', 0x8C: 'Œ', 0x8D: '�', 0x8E: 'Ž', 0x8F: '�',
        0x90: '�', 0x91: '‘', 0x92: ''', 0x93: '"', 0x94: '"', 0x95: '•', 0x96: '–', 0x97: '—',
        0x98: '˜', 0x99: '™', 0x9A: 'š', 0x9B: '›', 0x9C: 'œ', 0x9D: '�', 0x9E: 'ž', 0x9F: 'Ÿ',
        0xA0: ' ', 0xA1: '¡', 0xA2: '¢', 0xA3: '£', 0xA4: '¤', 0xA5: '¥', 0xA6: '¦', 0xA7: '§',
        0xA8: '¨', 0xA9: '©', 0xAA: 'ª', 0xAB: '«', 0xAC: '¬', 0xAD: '­', 0xAE: '®', 0xAF: '¯',
        0xB0: '°', 0xB1: '±', 0xB2: '²', 0xB3: '³', 0xB4: '´', 0xB5: 'µ', 0xB6: '¶', 0xB7: '·',
        0xB8: '¸', 0xB9: '¹', 0xBA: 'º', 0xBB: '»', 0xBC: '¼', 0xBD: '½', 0xBE: '¾', 0xBF: '¿',
        0xC0: 'À', 0xC1: 'Á', 0xC2: 'Â', 0xC3: 'Ã', 0xC4: 'Ä', 0xC5: 'Å', 0xC6: 'Æ', 0xC7: 'Ç',
        0xC8: 'È', 0xC9: 'É', 0xCA: 'Ê', 0xCB: 'Ë', 0xCC: 'Ì', 0xCD: 'Í', 0xCE: 'Î', 0xCF: 'Ï',
        0xD0: 'Ð', 0xD1: 'Ñ', 0xD2: 'Ò', 0xD3: 'Ó', 0xD4: 'Ô', 0xD5: 'Õ', 0xD6: 'Ö', 0xD7: '×',
        0xD8: 'Ø', 0xD9: 'Ù', 0xDA: 'Ú', 0xDB: 'Û', 0xDC: 'Ü', 0xDD: 'Ý', 0xDE: 'Þ', 0xDF: 'ß',
        0xE0: 'à', 0xE1: 'á', 0xE2: 'â', 0xE3: 'ã', 0xE4: 'ä', 0xE5: 'å', 0xE6: 'æ', 0xE7: 'ç',
        0xE8: 'è', 0xE9: 'é', 0xEA: 'ê', 0xEB: 'ë', 0xEC: 'ì', 0xED: 'í', 0xEE: 'î', 0xEF: 'ï',
        0xF0: 'ð', 0xF1: 'ñ', 0xF2: 'ò', 0xF3: 'ó', 0xF4: 'ô', 0xF5: 'õ', 0xF6: 'ö', 0xF7: '÷',
        0xF8: 'ø', 0xF9: 'ù', 0xFA: 'ú', 0xFB: 'û', 0xFC: 'ü', 0xFD: 'ý', 0xFE: 'þ', 0xFF: 'ÿ',
      };
      return isoToUtf8[code] || char;
    }
    return char;
  }).join('');
}

// Normalize string for comparison (remove accents, lowercase)
function normalizeStr(str: string): string {
  if (!str) return '';
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]/g, ''); // Remove special chars
}

async function findOrCreateCategory(categoryName: string, themeId: number): Promise<number> {
  if (!categoryName || !categoryName.trim()) {
    categoryName = 'Autres';
  }
  const normName = normalizeStr(categoryName);
  const existing = await query(
    'SELECT id FROM categories WHERE REPLACE(LOWER(name), "é", "e") = ? OR REPLACE(LOWER(name), "è", "e") = ? OR LOWER(name) = ?',
    [normName, normName, categoryName.toLowerCase()]
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
  const normName = normalizeStr(subcategoryName);
  const existing = await query(
    'SELECT id FROM subcategories WHERE LOWER(name) = ?',
    [subcategoryName.toLowerCase()]
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
  const name = normalizeStr(categoryName);
  if (name.includes('epargne') || name.includes('assurance') || name.includes('livret') || name.includes('placement')) return 4;
  if (name.includes('salaire') || name.includes('revenu') || name.includes('allocation') || name.includes('autresrevenus')) return 3;
  if (name.includes('impot') || name.includes('taxe') || name.includes('logement') || name.includes('credit') || name.includes('loyer')) return 1;
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
    
    // Normalize line endings first
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Convert encoding BEFORE parsing
    text = convertToUtf8(text);
    
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'Fichier CSV invalide ou vide' }, { status: 400 });
    }
    
    // Parse header
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().trim());
    
    console.log('Headers after encoding:', headers);
    
    // Find column indices - check multiple patterns
    const dateIdx = headers.findIndex(h => h === 'date');
    const libelleIdx = headers.findIndex(h => h.includes('libell'));
    const noteIdx = headers.findIndex(h => h.includes('note'));
    const montantIdx = headers.findIndex(h => h.includes('montant'));
    const categorieIdx = headers.findIndex(h => h.includes('categor'));
    const sousCatIdx = headers.findIndex(h => h.includes('sous'));
    const soldeIdx = headers.findIndex(h => h.includes('solde'));
    
    console.log('Column indices:', { dateIdx, libelleIdx, noteIdx, montantIdx, categorieIdx, sousCatIdx, soldeIdx });
    
    // Parse data lines
    const data: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length >= 4) { // At least date, libelle, amount, category
        data.push(values);
      }
    }
    
    console.log('Data rows:', data.length);
    if (data.length > 0) {
      console.log('First row:', data[0]);
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
    const categoryIdMap = new Map<number, string>(); // category ID -> name for lookup
    
    for (const cat of categories) {
      const normName = normalizeStr(cat.name);
      categoryMap.set(normName, { id: cat.id, themeId: cat.theme_id });
      categoryMap.set(cat.name.toLowerCase(), { id: cat.id, themeId: cat.theme_id });
      categoryIdMap.set(cat.id, cat.name);
      
      if (cat.subcategory_names) {
        const subs = cat.subcategory_names.split(',');
        for (const sub of subs) {
          categoryMap.set(normalizeStr(sub), { categoryId: cat.id, subName: sub });
          categoryMap.set(sub.toLowerCase(), { categoryId: cat.id, subName: sub });
        }
      }
    }

    console.log('Category map:', Array.from(categoryMap.keys()).slice(0, 10));

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

        // Parse date
        const dateParts = dateStr.split('/');
        let date = null;
        if (dateParts.length === 3) {
          date = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
        }

        if (!date) continue;

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

        // Use libelle or category
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
          const normCat = normalizeStr(categoryName);
          const catKey = categoryName.toLowerCase().trim();
          
          // Try to find existing category
          if (categoryMap.has(normCat) || categoryMap.has(catKey)) {
            const catData = categoryMap.get(normCat) || categoryMap.get(catKey);
            categoryId = catData.id;
          } else {
            // Create new category
            const themeId = guessTheme(categoryName);
            categoryId = await findOrCreateCategory(categoryName.trim(), themeId);
            newCategories++;
            categoryMap.set(normCat, { id: categoryId, themeId });
            categoryIdMap.set(categoryId, categoryName);
          }
          
          // Find or create subcategory
          if (subcategoryName && subcategoryName.trim() && categoryId) {
            const normSub = normalizeStr(subcategoryName);
            const subKey = subcategoryName.toLowerCase().trim();
            
            if (categoryMap.has(normSub) || categoryMap.has(subKey)) {
              const subData = categoryMap.get(normSub) || categoryMap.get(subKey);
              subcategoryId = subData.categoryId;
            } else {
              subcategoryId = await findOrCreateSubcategory(subcategoryName.trim(), categoryId);
              if (subcategoryId > 0) {
                newSubcategories++;
                categoryMap.set(normSub, { categoryId, subName: subcategoryName });
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
      errors: errors.slice(0, 10), 
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
