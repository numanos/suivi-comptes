import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'monthly' or 'annual'
    const year = searchParams.get('year');

    if (type === 'monthly') {
      // Get monthly summary for current year or specified year
      const targetYear = year || new Date().getFullYear();
      console.log('Monthly summary for year:', targetYear);
      
      const rows = await query(`
        SELECT 
          MONTH(t.date) as month,
          YEAR(t.date) as year,
          SUM(CASE WHEN th.name IN ('Dépenses fixes', 'Dépenses variables') AND t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as total_expenses,
          SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) as total_income,
          SUM(CASE WHEN th.name = 'Epargne' AND t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as total_savings
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN themes th ON c.theme_id = th.id
        WHERE YEAR(t.date) = ?
        GROUP BY YEAR(t.date), MONTH(t.date)
        ORDER BY year, month
      `, [targetYear]) as any[];

      console.log('Monthly rows:', rows);

      // 1. Get initial balance (last known balance before this year)
      const initialBalanceRows = await query(`
        SELECT balance FROM transactions 
        WHERE date < ? AND balance IS NOT NULL 
        ORDER BY date DESC, id DESC LIMIT 1
      `, [`${targetYear}-01-01`]) as any[];
      
      let runningBalance = initialBalanceRows.length > 0 ? Number(initialBalanceRows[0].balance) : 0;

      // 2. Get last balance of each month for the target year
      const balanceRows = await query(`
        SELECT 
          MONTH(t.date) as month,
          t.balance
        FROM transactions t
        WHERE YEAR(t.date) = ? AND t.balance IS NOT NULL
        ORDER BY t.date ASC, t.id ASC
      `, [targetYear]) as any[];

      const lastBalanceByMonth = new Map<number, number>();
      for (const row of balanceRows) {
        lastBalanceByMonth.set(row.month, Number(row.balance));
      }

      // 3. Merge and fill gaps in summary
      const summary = [];
      for (let m = 1; m <= 12; m++) {
        const row = rows.find(r => r.month === m);
        const monthBalance = lastBalanceByMonth.get(m);
        
        if (monthBalance !== undefined) {
          runningBalance = monthBalance;
        }

        summary.push({
          month: m,
          year: Number(targetYear),
          total_expenses: row ? (Number(row.total_expenses) || 0) : 0,
          total_income: row ? (Number(row.total_income) || 0) : 0,
          total_savings: row ? (Number(row.total_savings) || 0) : 0,
          net: row ? (Number(row.total_income) || 0) - (Number(row.total_expenses) || 0) : 0,
          balance: runningBalance
        });
      }

      return NextResponse.json(summary);
    }

    if (type === 'annual') {
      // Get annual summary - dynamic based on current month
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      
      const rows = await query(`
        SELECT 
          YEAR(t.date) as year,
          SUM(CASE WHEN th.name IN ('Dépenses fixes', 'Dépenses variables') AND t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as total_expenses,
          SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) as total_income,
          SUM(CASE WHEN th.name = 'Epargne' AND t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as total_savings
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN themes th ON c.theme_id = th.id
        WHERE YEAR(t.date) <= ?
        GROUP BY YEAR(t.date)
        ORDER BY year DESC
        LIMIT 5
      `, [currentYear]) as any[];

      // Calculate YTD (Year to Date) for current year
      const ytdRows = await query(`
        SELECT 
          SUM(CASE WHEN th.name IN ('Dépenses fixes', 'Dépenses variables') AND t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as total_expenses,
          SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) as total_income,
          SUM(CASE WHEN th.name = 'Epargne' AND t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as total_savings
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN themes th ON c.theme_id = th.id
        WHERE YEAR(t.date) = ? AND MONTH(t.date) <= ?
      `, [currentYear, currentMonth]) as any[];

      const summary = rows.map(row => ({
        year: row.year,
        total_expenses: row.total_expenses || 0,
        total_income: row.total_income || 0,
        total_savings: row.total_savings || 0,
        isCurrentYear: row.year === currentYear,
        ytd: row.year === currentYear ? {
          total_expenses: ytdRows[0]?.total_expenses || 0,
          total_income: ytdRows[0]?.total_income || 0,
          total_savings: ytdRows[0]?.total_savings || 0
        } : null
      }));

      return NextResponse.json(summary);
    }

    if (type === 'distribution') {
      const targetYear = year || new Date().getFullYear();
      
      // First, find theme IDs for expenses to be more robust
      const expenseThemes = await query(`
        SELECT id FROM themes 
        WHERE name LIKE '%Dépense%' OR name LIKE '%Depense%'
      `) as any[];
      
      const themeIds = expenseThemes.map(t => t.id);
      
      if (themeIds.length === 0) {
        return NextResponse.json({ categories: [], sankey: { nodes: [], links: [] } });
      }

      const themePlaceholders = themeIds.map(() => '?').join(',');

      // Get category totals for Pie Chart
      const catRows = await query(`
        SELECT 
          c.name as name,
          SUM(ABS(t.amount)) as value
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE YEAR(t.date) = ? AND t.amount < 0 AND c.theme_id IN (${themePlaceholders})
        GROUP BY c.id
        ORDER BY value DESC
      `, [targetYear, ...themeIds]) as any[];

      // Get category -> subcategory links for Sankey
      const sankeyRows = await query(`
        SELECT 
          c.name as source,
          COALESCE(s.name, 'Autres') as target,
          SUM(ABS(t.amount)) as value
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        LEFT JOIN subcategories s ON t.subcategory_id = s.id
        WHERE YEAR(t.date) = ? AND t.amount < 0 AND c.theme_id IN (${themePlaceholders})
        GROUP BY c.id, s.id
        HAVING value > 0
        ORDER BY value DESC
      `, [targetYear, ...themeIds]) as any[];

      // Format for Sankey (nodes and links)
      const nodesMap = new Map();
      const links: any[] = [];
      
      sankeyRows.forEach((row: any) => {
        if (!nodesMap.has(row.source)) nodesMap.set(row.source, nodesMap.size);
        if (!nodesMap.has(row.target)) nodesMap.set(row.target, nodesMap.size);
        
        links.push({
          source: nodesMap.get(row.source),
          target: nodesMap.get(row.target),
          value: Number(row.value)
        });
      });

      const nodes = Array.from(nodesMap.keys()).map(name => ({ name }));

      return NextResponse.json({
        categories: catRows,
        sankey: { nodes, links }
      });
    }

    return NextResponse.json({ error: 'Type requis' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
