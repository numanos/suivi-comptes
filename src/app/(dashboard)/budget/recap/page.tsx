'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, Sankey, LabelList } from 'recharts';

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
  categories: { name: string; value: number }[];
  sankey: {
    nodes: { name: string }[];
    links: { source: number; target: number; value: number }[];
  };
}

const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#64748b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

const SankeyNode = ({ x, y, width, height, index, payload, containerWidth }: any) => {
  const isOut = x > containerWidth / 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="#2563eb"
        fillOpacity="0.8"
      />
      <text
        x={isOut ? x - 6 : x + width + 6}
        y={y + height / 2}
        textAnchor={isOut ? 'end' : 'start'}
        verticalAnchor="middle"
        fontSize="12"
        fill="#333"
      >
        {payload.name}
      </text>
    </g>
  );
};

export default function RecapPage() {
  const [data, setData] = useState<AnnualData[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [distributionData, setDistributionData] = useState<DistributionData | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const formatAmount = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0,00 €';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  useEffect(() => {
    // Get available years
    fetch('/api/transactions?getYears=true')
      .then(res => res.json())
      .then(data => {
        if (data.years) {
          const years = data.years.sort((a: number, b: number) => b - a);
          setAvailableYears(years);
          if (years.length > 0 && !years.includes(selectedYear)) {
            setSelectedYear(years[0]);
          }
        }
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
    }).catch((err) => {
      console.error('Fetch error:', err);
      setLoading(false);
    });
  }, [selectedYear]);

  const safeMonthlyData = Array.isArray(monthlyData) ? monthlyData : [];
  const ytdExpenses = safeMonthlyData.reduce((sum, d) => sum + (Number(d.total_expenses) || 0), 0);
  const ytdIncome = safeMonthlyData.reduce((sum, d) => sum + (Number(d.total_income) || 0), 0);
  const ytdSavings = safeMonthlyData.reduce((sum, d) => sum + (Number(d.total_savings) || 0), 0);
  const lastBalance = safeMonthlyData.length > 0 ? safeMonthlyData[safeMonthlyData.length - 1].balance : 0;

  const chartData = safeMonthlyData.map(d => ({
    name: monthNames[d.month - 1],
    Dépenses: Number(d.total_expenses) || 0,
    Revenus: Number(d.total_income) || 0,
    Épargne: Number(d.total_savings) || 0,
    Solde: d.balance
  }));

  const pieData = distributionData?.categories?.filter(c => c.value > 0).slice(0, 10) || [];
  const sankeyData = distributionData?.sankey || { nodes: [], links: [] };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <h1 className="page-title">Récap annuel</h1>
            <p className="page-subtitle">Analyse complète de l'année {selectedYear}</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-light)' }}>Choisir l'année :</span>
            <select 
              className="form-select" 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{ width: 'auto', minWidth: '120px' }}
            >
              {availableYears.length > 0 ? (
                availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))
              ) : (
                <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
              )}
            </select>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Solde fin de période</div>
          <div className={`stat-value ${lastBalance >= 0 ? 'positive' : 'negative'}`}>
            {formatAmount(lastBalance)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Revenus (période)</div>
          <div className="stat-value positive">
            {formatAmount(ytdIncome)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Épargne (période)</div>
          <div className="stat-value">
            {formatAmount(ytdSavings)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Dépenses (période)</div>
          <div className="stat-value negative">
            {formatAmount(ytdExpenses)}
          </div>
        </div>
      </div>

      {/* Line Charts Row 1: Balance & Income */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Soldes fin de mois</h2>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 25, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} hide />
                <Tooltip formatter={(v: number) => formatAmount(v)} />
                <Line type="monotone" dataKey="Solde" stroke="#2563eb" strokeWidth={3} dot={false}>
                  <LabelList dataKey="Solde" position="top" offset={10} formatter={(v: number) => `${Math.round(v)}€`} style={{ fontSize: '11px', fontWeight: '500' }} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Courbe des revenus</h2>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 25, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} hide />
                <Tooltip formatter={(v: number) => formatAmount(v)} />
                <Line type="monotone" dataKey="Revenus" stroke="#10b981" strokeWidth={3} dot={false}>
                  <LabelList dataKey="Revenus" position="top" offset={10} formatter={(v: number) => `${Math.round(v)}€`} style={{ fontSize: '11px', fontWeight: '500' }} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Line Charts Row 2: Expenses & Savings */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Courbe des dépenses</h2>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 25, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} hide />
                <Tooltip formatter={(v: number) => formatAmount(v)} />
                <Line type="monotone" dataKey="Dépenses" stroke="#ef4444" strokeWidth={3} dot={false}>
                  <LabelList dataKey="Dépenses" position="top" offset={10} formatter={(v: number) => `${Math.round(v)}€`} style={{ fontSize: '11px', fontWeight: '500' }} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Courbe de l'épargne</h2>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 25, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} hide />
                <Tooltip formatter={(v: number) => formatAmount(v)} />
                <Line type="monotone" dataKey="Épargne" stroke="#3b82f6" strokeWidth={3} dot={false}>
                  <LabelList dataKey="Épargne" position="top" offset={10} formatter={(v: number) => `${Math.round(v)}€`} style={{ fontSize: '11px', fontWeight: '500' }} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Pie Chart & Cash Flow */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Répartition des flux</h2>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => formatAmount(v)} />
                <Legend />
                <Bar dataKey="Revenus" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Dépenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Épargne" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Top 10 Dépenses</h2>
          </div>
          <div className="chart-container" style={{ display: 'flex', justifyContent: 'center', minHeight: '300px' }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name ? name.substring(0, 12) : ''} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatAmount(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-light)' }}>
                Aucune donnée de dépense pour cette année
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sankey Diagram for Categories & Subcategories */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">Détail des flux (Catégories & Sous-catégories)</h2>
        </div>
        <div className="chart-container" style={{ height: 500, padding: '1rem' }}>
          {sankeyData.links.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <Sankey
                data={sankeyData}
                node={<SankeyNode containerWidth={1000} />}
                link={{ stroke: '#cbd5e1', strokeWidth: 2, fillOpacity: 0.2 }}
                margin={{ top: 20, right: 160, bottom: 20, left: 20 }}
                nodePadding={50}
              >
                <Tooltip formatter={(v: number) => formatAmount(v)} />
              </Sankey>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-light)' }}>
              Données insuffisantes pour générer le diagramme
            </div>
          )}
        </div>
      </div>

      {/* Monthly Detail Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Détail mensuel</h2>
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
              {chartData.map((d, idx) => (
                <tr key={d.name}>
                  <td>{d.name}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(d.Dépenses)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(d.Revenus)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(d.Épargne)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={d.Revenus - d.Dépenses >= 0 ? 'badge badge-success' : 'badge badge-danger'}>
                      {formatAmount(d.Revenus - d.Dépenses)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatAmount(d.Solde)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700, backgroundColor: 'var(--bg-secondary)' }}>
                <td>TOTAL</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(ytdExpenses)}</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(ytdIncome)}</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(ytdSavings)}</td>
                <td style={{ textAlign: 'right' }}>
                  <span className={ytdIncome - ytdExpenses >= 0 ? 'badge badge-success' : 'badge badge-danger'}>
                    {formatAmount(ytdIncome - ytdExpenses)}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>{formatAmount(lastBalance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
