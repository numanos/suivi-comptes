'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

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

interface DistributionData {
  name: string;
  theme: string;
  value: number;
}

const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#64748b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function RecapPage() {
  const [data, setData] = useState<AnnualData[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [distributionData, setDistributionData] = useState<DistributionData[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const formatAmount = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0,00 €';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  useEffect(() => {
    // Get available years
    fetch('/api/transactions?getYears=true')
      .then(res => res.json())
      .then(data => {
        if (data.years) setAvailableYears(data.years);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/transactions/summary?type=annual').then(res => res.json()),
      fetch(`/api/transactions/summary?type=monthly&year=${selectedYear}`).then(res => res.json()),
      fetch(`/api/transactions/summary?type=distribution&year=${selectedYear}`).then(res => res.json())
    ]).then(([annual, monthly, distribution]) => {
      setData(annual);
      setMonthlyData(monthly);
      setDistributionData(distribution);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [selectedYear]);

  // Filters for period
  const filteredMonthlyData = selectedMonth 
    ? monthlyData.filter(d => d.month === selectedMonth)
    : monthlyData;

  const ytdExpenses = filteredMonthlyData.reduce((sum, d) => sum + (Number(d.total_expenses) || 0), 0);
  const ytdIncome = filteredMonthlyData.reduce((sum, d) => sum + (Number(d.total_income) || 0), 0);
  const ytdSavings = filteredMonthlyData.reduce((sum, d) => sum + (Number(d.total_savings) || 0), 0);
  const lastBalance = filteredMonthlyData.length > 0 ? filteredMonthlyData[filteredMonthlyData.length - 1].balance : 0;

  const chartData = (Array.isArray(monthlyData) ? monthlyData : []).map(d => ({
    name: monthNames[d.month - 1],
    Dépenses: Number(d.total_expenses) || 0,
    Revenus: Number(d.total_income) || 0,
    Épargne: Number(d.total_savings) || 0,
    Solde: d.balance
  }));

  const pieData = Array.isArray(distributionData) ? distributionData.slice(0, 8) : [];

  return (
    <div style={{ backgroundColor: '#4a69bd', minHeight: '100vh', padding: '1.5rem', color: 'white', borderRadius: '1rem' }}>
      <style jsx>{`
        .blue-card {
          background-color: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(5px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }
        .blue-stat-card {
          padding: 1rem;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .year-btn {
          padding: 0.5rem 1rem;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          background: transparent;
          color: white;
          cursor: pointer;
          font-size: 0.9rem;
        }
        .year-btn.active {
          background: white;
          color: #4a69bd;
          font-weight: bold;
        }
        .month-btn {
          padding: 0.4rem 0.8rem;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          background: transparent;
          color: white;
          cursor: pointer;
          font-size: 0.8rem;
          min-width: 60px;
        }
        .month-btn.active {
          background: white;
          color: #4a69bd;
          font-weight: bold;
        }
        .chart-label {
          font-size: 0.9rem;
          margin-bottom: 0.5rem;
        }
      `}</style>

      {/* Top Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1.5rem' }}>
        {/* Left column: Suivi Budget Selector */}
        <div className="blue-card">
          <h2 style={{ fontSize: '1.4rem', marginBottom: '1.5rem', fontWeight: 'bold' }}>Suivi Budget</h2>
          
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {availableYears.map(y => (
                <button 
                  key={y} 
                  className={`year-btn ${selectedYear === y ? 'active' : ''}`}
                  onClick={() => setSelectedYear(y)}
                >
                  {y}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {monthNames.map((m, idx) => (
                <button 
                  key={m} 
                  className={`month-btn ${selectedMonth === idx + 1 ? 'active' : ''}`}
                  onClick={() => setSelectedMonth(selectedMonth === idx + 1 ? null : idx + 1)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: Main Chart */}
        <div className="blue-card">
          <h3 className="chart-label">Soldes fin de mois</h3>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.filter(d => d.Solde !== null)}>
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.7)" />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e3799', border: 'none', borderRadius: '8px', color: 'white' }}
                  formatter={(value: number) => formatAmount(value)} 
                />
                <Line 
                  type="monotone" 
                  dataKey="Solde" 
                  stroke="#fff" 
                  strokeWidth={4} 
                  dot={{ r: 6, fill: '#fff', strokeWidth: 2, stroke: '#1e3799' }}
                  label={{ 
                    position: 'top', 
                    fill: '#fff', 
                    fontSize: 12, 
                    formatter: (v: number) => `${Math.round(v)} €` 
                  }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Middle Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1.5rem' }}>
        {/* Left column: Summary Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="blue-card" style={{ marginBottom: 0 }}>
            <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Solde fin de période :</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', textAlign: 'right', marginTop: '0.5rem' }}>
              {formatAmount(lastBalance || (ytdIncome - ytdExpenses))}
            </div>
          </div>
          <div className="blue-card" style={{ marginBottom: 0 }}>
            <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Revenus sur la période :</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', textAlign: 'right', marginTop: '0.5rem' }}>
              {formatAmount(ytdIncome)}
            </div>
          </div>
          <div className="blue-card" style={{ marginBottom: 0 }}>
            <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Epargne sur la période :</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', textAlign: 'right', marginTop: '0.5rem' }}>
              {formatAmount(ytdSavings)}
            </div>
          </div>
          <div className="blue-card" style={{ marginBottom: 0 }}>
            <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Dépenses sur la Période :</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', textAlign: 'right', marginTop: '0.5rem' }}>
              {formatAmount(ytdExpenses)}
            </div>
          </div>
        </div>

        {/* Right column: Revenues Chart & Distribution */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="blue-card" style={{ marginBottom: 0 }}>
            <h3 className="chart-label">Revenus</h3>
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.7)" />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e3799', border: 'none', borderRadius: '8px', color: 'white' }}
                    formatter={(value: number) => formatAmount(value)} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Revenus" 
                    stroke="#fff" 
                    strokeWidth={4} 
                    dot={{ r: 6, fill: '#fff', strokeWidth: 2, stroke: '#1e3799' }}
                    label={{ 
                      position: 'top', 
                      fill: '#fff', 
                      fontSize: 12, 
                      formatter: (v: number) => `${Math.round(v)} €` 
                    }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="blue-card" style={{ marginBottom: 0 }}>
              <h3 className="chart-label">Répartition Dépenses</h3>
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e3799', border: 'none', borderRadius: '8px', color: 'white' }}
                      formatter={(value: number) => formatAmount(value)} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="blue-card" style={{ marginBottom: 0 }}>
              <h3 className="chart-label">Flux de trésorerie</h3>
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.7)" />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e3799', border: 'none', borderRadius: '8px', color: 'white' }}
                      formatter={(value: number) => formatAmount(value)} 
                    />
                    <Bar dataKey="Revenus" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Dépenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Épargne" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table Section (Lowered visibility but still there) */}
      <div className="card" style={{ marginTop: '2rem', backgroundColor: 'white', color: '#333' }}>
        <div className="card-header">
          <h2 className="card-title">Détail mensuel {selectedYear} {selectedMonth ? ` - ${monthNames[selectedMonth-1]}` : ''}</h2>
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
              {filteredMonthlyData.map((d) => (
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
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
