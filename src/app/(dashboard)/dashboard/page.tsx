'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

interface MonthlyData {
  month: number;
  year: number;
  total_expenses: number;
  total_income: number;
  total_savings: number;
  net: number;
}

const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export default function DashboardPage() {
  const [data, setData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/transactions/summary?type=monthly')
      .then(res => res.json())
      .then(data => {
        // Ensure numeric values
        const normalizedData = data.map((d: any) => ({
          ...d,
          total_expenses: Number(d.total_expenses) || 0,
          total_income: Number(d.total_income) || 0,
          total_savings: Number(d.total_savings) || 0,
          net: Number(d.net) || 0
        }));
        setData(normalizedData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  console.log('Dashboard: looking for month', currentMonth, 'year', currentYear);
  console.log('Dashboard data:', data);
  const currentData = data.find(d => Number(d.month) === currentMonth && Number(d.year) === currentYear);
  console.log('Current data found:', currentData);
  const ytdData = data.filter(d => d.year === currentYear);

  const ytdExpenses = ytdData.reduce((sum, d) => sum + d.total_expenses, 0);
  const ytdIncome = ytdData.reduce((sum, d) => sum + d.total_income, 0);
  const ytdSavings = ytdData.reduce((sum, d) => sum + d.total_savings, 0);

  const chartData = data.map(d => ({
    name: monthNames[d.month - 1],
    Dépenses: d.total_expenses,
    Revenus: d.total_income,
    Épargne: d.total_savings
  }));

  if (loading) {
    return <div>Chargement...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Vue d'ensemble de vos finances</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Dépenses (Mois en cours)</div>
          <div className="stat-value negative">
            {currentData ? Number(currentData.total_expenses).toFixed(2) : '0.00'} €
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Revenus (Mois en cours)</div>
          <div className="stat-value positive">
            {currentData ? Number(currentData.total_income).toFixed(2) : '0.00'} €
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Épargne (Mois en cours)</div>
          <div className="stat-value">
            {currentData ? Number(currentData.total_savings).toFixed(2) : '0.00'} €
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cumul annuel (YTD)</div>
          <div className={`stat-value ${ytdIncome - ytdExpenses >= 0 ? 'positive' : 'negative'}`}>
            {(ytdIncome - ytdExpenses).toFixed(2)} €
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Évolution mensuelle {currentYear}</h2>
        </div>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: number) => `${value.toFixed(2)} €`} />
              <Legend />
              <Bar dataKey="Dépenses" fill="#ef4444" />
              <Bar dataKey="Revenus" fill="#10b981" />
              <Bar dataKey="Épargne" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Évolution de l'épargne</h2>
        </div>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: number) => `${value.toFixed(2)} €`} />
              <Legend />
              <Line type="monotone" dataKey="Épargne" stroke="#2563eb" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
