'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface AnnualData {
  year: number;
  total_expenses: number;
  total_income: number;
  total_savings: number;
  isCurrentYear: boolean;
  ytd?: {
    total_expenses: number;
    total_income: number;
    total_savings: number;
  };
}

const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export default function RecapPage() {
  const [data, setData] = useState<AnnualData[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  useEffect(() => {
    Promise.all([
      fetch('/api/transactions/summary?type=annual').then(res => res.json()),
      fetch(`/api/transactions/summary?type=monthly&year=${currentYear}`).then(res => res.json())
    ]).then(([annual, monthly]) => {
      setData(annual);
      setMonthlyData(monthly);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const formatAmount = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '0,00 €';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  if (loading) {
    return <div>Chargement...</div>;
  }

  // Ensure monthlyData is an array
  const safeMonthlyData = Array.isArray(monthlyData) ? monthlyData : [];

  const chartData = safeMonthlyData.map(d => ({
    name: monthNames[d.month - 1],
    Dépenses: Number(d.total_expenses) || 0,
    Revenus: Number(d.total_income) || 0,
    Épargne: Number(d.total_savings) || 0,
    Solde: d.balance
  }));

  // Calculate YTD totals for current year
  const ytdExpenses = safeMonthlyData.reduce((sum, d) => sum + (Number(d.total_expenses) || 0), 0);
  const ytdIncome = safeMonthlyData.reduce((sum, d) => sum + (Number(d.total_income) || 0), 0);
  const ytdSavings = safeMonthlyData.reduce((sum, d) => sum + (Number(d.total_savings) || 0), 0);

  // Previous year data
  const prevYearData = data.find(d => d.year === currentYear - 1);
  const prevYearExpenses = prevYearData?.total_expenses || 0;
  const prevYearIncome = prevYearData?.total_income || 0;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Récap annuel</h1>
        <p className="page-subtitle">Bilan de l'année en cours (à ce jour)</p>
      </div>

      {/* YTD Summary */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Dépenses YTD ({currentMonth} mois)</div>
          <div className="stat-value negative">{formatAmount(ytdExpenses)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Revenus YTD ({currentMonth} mois)</div>
          <div className="stat-value positive">{formatAmount(ytdIncome)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Épargne YTD ({currentMonth} mois)</div>
          <div className="stat-value">{formatAmount(ytdSavings)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Solde YTD</div>
          <div className={`stat-value ${ytdIncome - ytdExpenses >= 0 ? 'positive' : 'negative'}`}>
            {formatAmount(ytdIncome - ytdExpenses)}
          </div>
        </div>
      </div>

      {/* Comparison with previous year */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Comparaison vs {currentYear - 1}</h2>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th></th>
                <th style={{ textAlign: 'right' }}>{currentYear} (YTD)</th>
                <th style={{ textAlign: 'right' }}>{currentYear - 1}</th>
                <th style={{ textAlign: 'right' }}>Évolution</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Dépenses</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(ytdExpenses)}</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(prevYearExpenses)}</td>
                <td style={{ textAlign: 'right' }}>
                  {prevYearExpenses > 0 ? (
                    <span className={ytdExpenses - prevYearExpenses <= 0 ? 'badge badge-success' : 'badge badge-danger'}>
                      {((ytdExpenses - prevYearExpenses) / prevYearExpenses * 100).toFixed(1)}%
                    </span>
                  ) : '-'}
                </td>
              </tr>
              <tr>
                <td>Revenus</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(ytdIncome)}</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(prevYearIncome)}</td>
                <td style={{ textAlign: 'right' }}>
                  {prevYearIncome > 0 ? (
                    <span className={ytdIncome - prevYearIncome >= 0 ? 'badge badge-success' : 'badge badge-danger'}>
                      {((ytdIncome - prevYearIncome) / prevYearIncome * 100).toFixed(1)}%
                    </span>
                  ) : '-'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly breakdown chart */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Répartition mensuelle {currentYear}</h2>
        </div>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: number) => formatAmount(value)} />
              <Legend />
              <Bar dataKey="Dépenses" stackId="a" fill="#ef4444" />
              <Bar dataKey="Revenus" stackId="a" fill="#10b981" />
              <Bar dataKey="Épargne" stackId="a" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly balance chart */}
      {monthlyData.some(d => d.balance !== null) && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Solde mensuel {currentYear}</h2>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.filter(d => d.Solde !== null)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatAmount(value)} />
                <Legend />
                <Line type="monotone" dataKey="Solde" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Monthly detail table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Détail mensuel {currentYear}</h2>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Mois</th>
                <th style={{ textAlign: 'right' }}>Dépenses</th>
                <th style={{ textAlign: 'right' }}>Revenus</th>
                <th style={{ textAlign: 'right' }}>Épargne</th>
                <th style={{ textAlign: 'right' }}>Solde net</th>
                <th style={{ textAlign: 'right' }}>Solde compte</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((d) => (
                <tr key={d.month}>
                  <td>{monthNames[d.month - 1]}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(d.total_expenses)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(d.total_income)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(d.total_savings)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={d.net >= 0 ? 'badge badge-success' : 'badge badge-danger'}>
                      {formatAmount(d.net)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>
                    {d.balance !== null ? formatAmount(d.balance) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 600 }}>
                <td>Total</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(ytdExpenses)}</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(ytdIncome)}</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(ytdSavings)}</td>
                <td style={{ textAlign: 'right' }}>
                  <span className={ytdIncome - ytdExpenses >= 0 ? 'badge badge-success' : 'badge badge-danger'}>
                    {formatAmount(ytdIncome - ytdExpenses)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
