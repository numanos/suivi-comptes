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
      
      // 1. Get totals by theme
      const fluxData = await query(`
        SELECT 
          SUM(CASE WHEN th.name = 'Revenus' AND t.amount > 0 THEN t.amount ELSE 0 END) as income,
          SUM(CASE WHEN th.name = 'Dépenses fixes' AND t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as fixed_expenses,
          SUM(CASE WHEN th.name = 'Dépenses variables' AND t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as var_expenses,
          SUM(CASE WHEN th.name = 'Epargne' AND t.amount < 0 THEN ABS(t.amount) ELSE 0 END) as savings
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN themes th ON c.theme_id = th.id
        WHERE YEAR(t.date) = ?
      `, [targetYear]) as any[];
      
      // 2. Get breakdown of Savings categories
      const savingsCategories = await query(`
        SELECT c.name, SUM(ABS(t.amount)) as value
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        JOIN themes th ON c.theme_id = th.id
        WHERE YEAR(t.date) = ? AND t.amount < 0 AND th.name = 'Epargne'
        GROUP BY c.id
        HAVING value > 0
        ORDER BY value DESC
      `, [targetYear]) as any[];

      // 3. Get Top 10 categories for the Pie chart
      const catRows = await query(`
        SELECT 
          c.name as name,
          SUM(ABS(t.amount)) as value
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        JOIN themes th ON c.theme_id = th.id
        WHERE YEAR(t.date) = ? AND t.amount < 0 AND th.name IN ('Dépenses fixes', 'Dépenses variables')
        GROUP BY c.id
        ORDER BY value DESC
        LIMIT 10
      `, [targetYear]) as any[];

      const f = fluxData[0];
      const income = Number(f.income) || 0;
      const fixed = Number(f.fixed_expenses) || 0;
      const variable = Number(f.var_expenses) || 0;
      const savings = Number(f.savings) || 0;
      const totalExpenses = fixed + variable;
      const remaining = Math.max(0, income - totalExpenses - savings);

      // Define Nodes
      const nodes = [
        { name: 'Revenus', color: '#3b82f6', amount: income },           // 0
        { name: 'Dépenses', color: '#f97316', amount: totalExpenses },   // 1
        { name: 'Épargne', color: '#10b981', amount: savings },          // 2
        { name: 'Solde restant', color: '#6366f1', amount: remaining },  // 3
        { name: 'Dépenses fixes', color: '#ea580c', amount: fixed },     // 4
        { name: 'Dépenses variables', color: '#f59e0b', amount: variable } // 5
      ];

      const links = [];
      
      // Level 1: Revenus -> Mid Nodes
      if (totalExpenses > 0) links.push({ source: 0, target: 1, value: totalExpenses });
      if (savings > 0) links.push({ source: 0, target: 2, value: savings });
      if (remaining > 0) links.push({ source: 0, target: 3, value: remaining });

      // Level 2: Dépenses -> Breakdown
      if (fixed > 0) links.push({ source: 1, target: 4, value: fixed });
      if (variable > 0) links.push({ source: 1, target: 5, value: variable });

      // Level 2: Épargne -> Category breakdown
      savingsCategories.forEach((cat: any) => {
        const nodeIdx = nodes.length;
        nodes.push({ name: cat.name, color: '#059669', amount: Number(cat.value) });
        links.push({ source: 2, target: nodeIdx, value: Number(cat.value) });
      });

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
