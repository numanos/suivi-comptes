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

// Helper to find or create a category
async function findOrCreateCategory(categoryName: string, themeId: number): Promise<number> {
  // Check if category exists
  const existing = await query(
    'SELECT id FROM categories WHERE LOWER(name) = ? AND theme_id = ?',
    [categoryName.toLowerCase(), themeId]
  ) as any[];
  
  if (existing.length > 0) {
    return existing[0].id;
  }
  
  // Create new category
  const result = await query(
    'INSERT INTO categories (name, theme_id) VALUES (?, ?)',
    [categoryName, themeId]
  ) as any;
  
  return result.insertId;
}

// Helper to find or create a subcategory
async function findOrCreateSubcategory(subcategoryName: string, categoryId: number): Promise<number> {
  // Check if subcategory exists
  const existing = await query(
    'SELECT id FROM subcategories WHERE LOWER(name) = ? AND category_id = ?',
    [subcategoryName.toLowerCase(), categoryId]
  ) as any[];
  
  if (existing.length > 0) {
    return existing[0].id;
  }
  
  // Create new subcategory
  const result = await query(
    'INSERT INTO subcategories (name, category_id) VALUES (?, ?)',
    [subcategoryName, categoryId]
  ) as any;
  
  return result.insertId;
}

// Helper to determine theme based on category name keywords
function guessTheme(categoryName: string): number {
  const name = categoryName.toLowerCase();
  
  // Epargne
  if (name.includes('epargne') || name.includes('assurance vie') || name.includes('livret') || name.includes('placement')) {
    return 4; // Epargne
  }
  
  // Revenus
  if (name.includes('salaire') || name.includes('revenu') || name.includes('allocation') || name.includes('remboursement') || name.includes('autres revenus')) {
    return 3; // Revenus
  }
  
  // Dépenses fixes
  if (name.includes('impôt') || name.includes('taxe') || name.includes('logement') || name.includes('crédit') || name.includes('loyer') || name.includes('charges')) {
    return 1; // Dépenses fixes
  }
  
  // Default: Dépenses variables
  return 2;
}

// Check if transaction already exists (duplicate)
async function transactionExists(date: string, libelle: string, amount: number): Promise<boolean> {
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
      const row = data[i];
      try {
        // Parse date (format: DD/MM/YYYY)
        const dateParts = row['Date']?.split('/');
        let date = null;
        if (dateParts && dateParts.length === 3) {
          date = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
        }

        if (!date) {
          continue;
        }

        // Parse amount (format: -14,1 or 55)
        let amount = 0;
        if (row['Montant']) {
          const amountStr = row['Montant'].replace(' ', '').replace(',', '.');
          amount = parseFloat(amountStr);
        }

        const libelle = row['Libellé'] || '';

        // Check for duplicate
        if (await transactionExists(date, libelle, amount)) {
          skipped++;
          continue;
        }

        // Match or create category
        const categoryName = row['Catégorie']?.trim() || 'Autres';
        const subcategoryName = row['Sous-catégorie']?.trim();
        
        let categoryId: number | null = null;
        let subcategoryId: number | null = null;

        // Check if category exists
        if (categoryMap.has(categoryName.toLowerCase())) {
          const catData = categoryMap.get(categoryName.toLowerCase());
          categoryId = catData.id;
          
          // Check if subcategory exists
          if (subcategoryName && categoryId) {
            const subKey = subcategoryName.toLowerCase();
            if (categoryMap.has(subKey)) {
              const subData = categoryMap.get(subKey);
              subcategoryId = subData.categoryId;
            } else {
              // Create new subcategory
              subcategoryId = await findOrCreateSubcategory(subcategoryName, categoryId);
              newSubcategories++;
              categoryMap.set(subKey, { categoryId, subName: subcategoryName });
            }
          }
        } else {
          // Create new category (auto-detect theme)
          const themeId = guessTheme(categoryName);
          categoryId = await findOrCreateCategory(categoryName, themeId);
          newCategories++;
          categoryMap.set(categoryName.toLowerCase(), { id: categoryId, themeId });
          
          // Create subcategory if provided
          if (subcategoryName) {
            subcategoryId = await findOrCreateSubcategory(subcategoryName, categoryId);
            newSubcategories++;
            categoryMap.set(subcategoryName.toLowerCase(), { categoryId, subName: subcategoryName });
          }
        }

        await connection.query(
          `INSERT INTO transactions (date, libelle, note, amount, category_id, subcategory_id, balance, import_batch_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            date,
            libelle,
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
    await connection.query(
      'UPDATE import_batches SET record_count = ? WHERE id = ?',
      [imported, batchId]
    );

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
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  } finally {
    (connection as any).release();
  }
}
