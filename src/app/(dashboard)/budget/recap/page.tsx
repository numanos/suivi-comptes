'use client';

import { useEffect, useState } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, Sankey, LabelList
} from 'recharts';

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
  sankey: {
    nodes: { name: string; color?: string; amount: number }[];
    links: { source: number; target: number; value: number; color?: string }[];
  };
}

const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

const SankeyNode = ({ x, y, width, height, index, payload, containerWidth }: any) => {
  const isOut = x > containerWidth / 2;
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
  };

  if (height < 2) return null;
  
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={payload.color || "#2563eb"}
        fillOpacity="1"
        rx={3}
      />
      <text
        x={isOut ? x - 15 : x + width + 15}
        y={y + height / 2 - 8}
        textAnchor={isOut ? 'end' : 'start'}
        dominantBaseline="middle"
        fontSize="13"
        fill="#1f2937"
        fontWeight="bold"
      >
        {payload.name}
      </text>
      <text
        x={isOut ? x - 15 : x + width + 15}
        y={y + height / 2 + 10}
        textAnchor={isOut ? 'end' : 'start'}
        dominantBaseline="middle"
        fontSize="12"
        fill={payload.color || "#2563eb"}
        fontWeight="600"
      >
        {formatAmount(payload.amount)}
      </text>
    </g>
  );
};

export default function RecapPage() {

  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [distributionData, setDistributionData] = useState<DistributionData | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const formatAmount = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0,00 €';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  useEffect(() => {
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
      fetch(`/api/transactions/summary?type=monthly&year=${selectedYear}`).then(res => res.json()),
      fetch(`/api/transactions/summary?type=distribution&year=${selectedYear}`).then(res => res.json())
    ]).then(([monthly, distribution]) => {
      setMonthlyData(monthly);
      setDistributionData(distribution);
      setLoading(false);
    }).catch((err) => {
      console.error('Fetch error:', err);
      setLoading(false);
    });
  }, [selectedYear]);

  const safeMonthlyData = Array.isArray(monthlyData) ? monthlyData : [];
  
  const lastMonthWithData = safeMonthlyData.reduce((last, d, idx) => {
    const hasData = Number(d.total_expenses) > 0 || Number(d.total_income) > 0;
    if (selectedYear === currentYear) {
      return hasData && (idx + 1) <= currentMonth ? idx + 1 : last;
    }
    return hasData ? idx + 1 : last;
  }, 0);

  const ytdExpenses = safeMonthlyData.reduce((sum, d, idx) => 
    idx + 1 <= lastMonthWithData ? sum + (Number(d.total_expenses) || 0) : sum, 0);
  const ytdIncome = safeMonthlyData.reduce((sum, d, idx) => 
    idx + 1 <= lastMonthWithData ? sum + (Number(d.total_income) || 0) : sum, 0);
  const ytdSavings = safeMonthlyData.reduce((sum, d, idx) => 
    idx + 1 <= lastMonthWithData ? sum + (Number(d.total_savings) || 0) : sum, 0);
  const lastBalance = lastMonthWithData > 0 ? safeMonthlyData[lastMonthWithData - 1].balance : 0;

  const chartData = safeMonthlyData.map((d, idx) => {
    const isFuture = idx + 1 > lastMonthWithData;
    return {
      name: monthNames[d.month - 1],
      Dépenses: isFuture ? null : Number(d.total_expenses) || 0,
      Revenus: isFuture ? null : Number(d.total_income) || 0,
      Épargne: isFuture ? null : Number(d.total_savings) || 0,
      Solde: isFuture ? null : d.balance
    };
  });

  const sankeyData = distributionData?.sankey || { nodes: [], links: [] };

  if (loading && availableYears.length === 0) {
    return <div className="p-8">Chargement...</div>;
  }

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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Soldes fin de mois</h2>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 30, right: 30, left: 60, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} fontSize={11} />
                <YAxis axisLine={false} tickLine={false} hide />
                <Tooltip formatter={(v: number) => formatAmount(v)} />
                <Line type="monotone" dataKey="Solde" stroke="#2563eb" strokeWidth={3} dot={false} connectNulls={false}>
                  <LabelList dataKey="Solde" position="top" offset={12} formatter={(v: number) => v !== null ? `${Math.round(v)}€` : ''} style={{ fontSize: '10px', fontWeight: '600', fill: '#1e40af' }} />
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
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 30, right: 30, left: 60, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} fontSize={11} />
                <YAxis axisLine={false} tickLine={false} hide />
                <Tooltip formatter={(v: number) => formatAmount(v)} />
                <Line type="monotone" dataKey="Revenus" stroke="#10b981" strokeWidth={3} dot={false} connectNulls={false}>
                  <LabelList dataKey="Revenus" position="top" offset={12} formatter={(v: number) => v !== null ? `${Math.round(v)}€` : ''} style={{ fontSize: '10px', fontWeight: '600', fill: '#065f46' }} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Courbe des dépenses</h2>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 30, right: 30, left: 60, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} fontSize={11} />
                <YAxis axisLine={false} tickLine={false} hide />
                <Tooltip formatter={(v: number) => formatAmount(v)} />
                <Line type="monotone" dataKey="Dépenses" stroke="#ef4444" strokeWidth={3} dot={false} connectNulls={false}>
                  <LabelList dataKey="Dépenses" position="top" offset={12} formatter={(v: number) => v !== null ? `${Math.round(v)}€` : ''} style={{ fontSize: '10px', fontWeight: '600', fill: '#991b1b' }} />
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
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 30, right: 30, left: 60, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} fontSize={11} />
                <YAxis axisLine={false} tickLine={false} hide />
                <Tooltip formatter={(v: number) => formatAmount(v)} />
                <Line type="monotone" dataKey="Épargne" stroke="#3b82f6" strokeWidth={3} dot={false} connectNulls={false}>
                  <LabelList dataKey="Épargne" position="top" offset={12} formatter={(v: number) => v !== null ? `${Math.round(v)}€` : ''} style={{ fontSize: '10px', fontWeight: '600', fill: '#1e40af' }} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">Diagramme des flux détaillés (Sankey)</h2>
        </div>
        <div className="chart-container" style={{ height: 600, padding: '2rem' }}>
          {sankeyData.links.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <Sankey
                data={sankeyData}
                node={<SankeyNode containerWidth={1000} />}
                margin={{ top: 40, right: 250, bottom: 40, left: 150 }}
                nodePadding={60}
                nodeWidth={15}
                link={(props: any) => {
                  const { sourceX, sourceY, targetX, targetY, link, payload } = props;
                  const strokeWidth = link?.width || props.width || 0;
                  if (strokeWidth < 0.1) return <path d="" />;
                  
                  const sx = sourceX + 15;
                  return (
                    <path
                      d={`M${sx},${sourceY}C${(sx + targetX) / 2},${sourceY} ${(sx + targetX) / 2},${targetY} ${targetX},${targetY}`}
                      fill="none"
                      stroke={payload?.color || "#cbd5e1"}
                      strokeWidth={strokeWidth}
                      strokeOpacity="0.2"
                    />
                  );
                }}
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

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h2 className="card-title">Répartition des flux (Barres)</h2>
        </div>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} fontSize={11} />
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
              {safeMonthlyData.map((d, idx) => (
                <tr key={d.month} style={{ opacity: idx + 1 > lastMonthWithData ? 0.5 : 1 }}>
                  <td>{monthNames[d.month - 1]}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(d.total_expenses)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(d.total_income)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(d.total_savings)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={d.total_income - d.total_expenses >= 0 ? 'badge badge-success' : 'badge badge-danger'}>
                      {formatAmount(d.total_income - d.total_expenses)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatAmount(d.balance)}</td>
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
