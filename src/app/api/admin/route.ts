import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === 'purge_transactions') {
      await query('DELETE FROM transactions');
      await query('DELETE FROM import_batches');
      await query('ALTER TABLE transactions AUTO_INCREMENT = 1');
      await query('ALTER TABLE import_batches AUTO_INCREMENT = 1');
      return NextResponse.json({ success: true, message: 'Transactions purgées' });
    }

    if (action === 'purge_categories') {
      await query('DELETE FROM subcategories');
      await query('DELETE FROM categories');
      await query('ALTER TABLE subcategories AUTO_INCREMENT = 1');
      await query('ALTER TABLE categories AUTO_INCREMENT = 1');
      return NextResponse.json({ success: true, message: 'Catégories purgées' });
    }

    if (action === 'purge_all') {
      await query('DELETE FROM transactions');
      await query('DELETE FROM import_batches');
      await query('DELETE FROM placements');
      await query('DELETE FROM envelopes');
      await query('DELETE FROM subcategories');
      await query('DELETE FROM categories');
      await query('ALTER TABLE transactions AUTO_INCREMENT = 1');
      await query('ALTER TABLE import_batches AUTO_INCREMENT = 1');
      await query('ALTER TABLE placements AUTO_INCREMENT = 1');
      await query('ALTER TABLE envelopes AUTO_INCREMENT = 1');
      await query('ALTER TABLE subcategories AUTO_INCREMENT = 1');
      await query('ALTER TABLE categories AUTO_INCREMENT = 1');
      return NextResponse.json({ success: true, message: 'Tout purgé' });
    }

    if (action === 'reset_categories') {
      // Delete custom categories (keep defaults)
      await query('DELETE FROM subcategories');
      await query('DELETE FROM categories WHERE is_default = 0');
      
      // Re-insert defaults
      await query(`
        INSERT INTO themes (name, is_default, display_order) VALUES
        ('Dépenses fixes', TRUE, 1),
        ('Dépenses variables', TRUE, 2),
        ('Revenus', TRUE, 3),
        ('Epargne', TRUE, 4)
      `);
      
      const themes = await query('SELECT id, name FROM themes') as any[];
      const themesMap: Record<string, number> = {};
      themes.forEach((t: any) => { themesMap[t.name] = t.id; });
      
      const categories = [
        { name: 'Impôts / taxes', theme: 'Dépenses fixes' },
        { name: 'Logement / maison', theme: 'Dépenses fixes' },
        { name: 'Loisirs', theme: 'Dépenses variables' },
        { name: 'Véhicule', theme: 'Dépenses variables' },
        { name: 'Alimentation', theme: 'Dépenses variables' },
        { name: 'Autres dépenses', theme: 'Dépenses variables' },
        { name: 'Vie quotidienne', theme: 'Dépenses variables' },
        { name: 'Enfants & Scolarité', theme: 'Dépenses variables' },
        { name: 'Numérique', theme: 'Dépenses variables' },
        { name: 'Famille', theme: 'Dépenses variables' },
        { name: 'Vacances / weekend', theme: 'Dépenses variables' },
        { name: 'Autres revenus', theme: 'Revenus' },
        { name: 'Revenus professionnels', theme: 'Revenus' },
        { name: 'Epargne', theme: 'Epargne' },
      ];
      
      for (const cat of categories) {
        await query('INSERT INTO categories (name, theme_id) VALUES (?, ?)', [cat.name, themesMap[cat.theme]]);
      }
      
      return NextResponse.json({ success: true, message: 'Catégories réinitialisées' });
    }

    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
  } catch (error) {
    console.error('Admin action error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
