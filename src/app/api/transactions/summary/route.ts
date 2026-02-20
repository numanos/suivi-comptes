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

      const summary = rows.map(row => ({
        month: row.month,
        year: row.year,
        total_expenses: row.total_expenses || 0,
        total_income: row.total_income || 0,
        total_savings: row.total_savings || 0,
        net: (row.total_income || 0) - (row.total_expenses || 0),
        balance: null as number | null
      }));

      // Get balance for each month (last transaction with balance for that month)
      const balanceRows = await query(`
        SELECT 
          MONTH(t.date) as month,
          YEAR(t.date) as year,
          t.balance
        FROM transactions t
        WHERE YEAR(t.date) = ? AND t.balance IS NOT NULL
        ORDER BY year, month, t.date DESC
      `, [targetYear]) as any[];

      // Get the last balance for each month
      const lastBalanceByMonth = new Map<string, number>();
      for (const row of balanceRows) {
        const key = `${row.year}-${row.month}`;
        if (!lastBalanceByMonth.has(key)) {
          lastBalanceByMonth.set(key, row.balance);
        }
      }

      // Merge balance into summary
      for (const row of summary) {
        const key = `${row.year}-${row.month}`;
        row.balance = lastBalanceByMonth.get(key) || null;
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
      const rows = await query(`
        SELECT 
          c.name as name,
          th.name as theme,
          SUM(ABS(t.amount)) as value
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        JOIN themes th ON c.theme_id = th.id
        WHERE YEAR(t.date) = ? AND t.amount < 0 AND th.name IN ('Dépenses fixes', 'Dépenses variables')
        GROUP BY c.id, th.id
        ORDER BY value DESC
      `, [targetYear]) as any[];
      return NextResponse.json(rows);
    }

    return NextResponse.json({ error: 'Type requis' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
