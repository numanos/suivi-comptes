'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface EvolutionData {
  year: number;
  actions: number;
  immo: number;
  obligations: number;
  liquidites: number;
  total: number;
  evolution: number | null;
  evolution_percent: number | null;
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#64748b'];

export default function PatrimoinePage() {
  const [data, setData] = useState<EvolutionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/patrimoine?type=evolution')
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  if (loading) {
    return <div>Chargement...</div>;
  }

  const latestData = data[0];
  const previousData = data[1];

  const pieData = latestData ? [
    { name: 'Actions', value: latestData.actions },
    { name: 'Immobilier', value: latestData.immo },
    { name: 'Obligations', value: latestData.obligations },
    { name: 'Liquidités', value: latestData.liquidites }
  ] : [];

  const barData = data.map(d => ({
    year: d.year,
    Actions: d.actions,
    Immobilier: d.immo,
    Obligations: d.obligations,
    Liquidités: d.liquidites
  }));

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Patrimoine</h1>
        <p className="page-subtitle">Évolution de votre patrimoine</p>
      </div>

      {/* Current year summary */}
      {latestData && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total {latestData.year}</div>
            <div className="stat-value">{formatAmount(latestData.total)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Évolution vs {latestData.year - 1}</div>
            <div className={`stat-value ${(latestData.evolution || 0) >= 0 ? 'positive' : 'negative'}`}>
              {latestData.evolution !== null ? formatAmount(latestData.evolution) : '-'}
            </div>
            {latestData.evolution_percent !== null && (
              <span className={`badge ${latestData.evolution_percent >= 0 ? 'badge-success' : 'badge-danger'}`}>
                {latestData.evolution_percent >= 0 ? '+' : ''}{latestData.evolution_percent.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      )}

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Répartition {latestData?.year}</h2>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatAmount(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Évolution par catégorie</h2>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatAmount(value)} />
                <Legend />
                <Bar dataKey="Actions" fill={COLORS[0]} />
                <Bar dataKey="Immobilier" fill={COLORS[1]} />
                <Bar dataKey="Obligations" fill={COLORS[2]} />
                <Bar dataKey="Liquidités" fill={COLORS[3]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Evolution table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Tableau d'évolution</h2>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Année</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
                <th style={{ textAlign: 'right' }}>Immobilier</th>
                <th style={{ textAlign: 'right' }}>Obligations</th>
                <th style={{ textAlign: 'right' }}>Liquidités</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'right' }}>Évolution</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.year}>
                  <td>{d.year}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(d.actions)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(d.immo)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(d.obligations)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(d.liquidites)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatAmount(d.total)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {d.evolution !== null ? (
                      <span className={d.evolution >= 0 ? 'badge badge-success' : 'badge badge-danger'}>
                        {d.evolution >= 0 ? '+' : ''}{d.evolution_percent?.toFixed(1)}%
                      </span>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
