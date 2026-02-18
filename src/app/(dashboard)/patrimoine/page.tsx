'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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

interface SummaryData {
  year: number;
  prevYear: number;
  hasData: boolean;
  totals: {
    Action: number;
    Immo: number;
    Obligations: number;
    Liquidites: number;
  };
  total: number;
  prevTotals: {
    Action: number;
    Immo: number;
    Obligations: number;
    Liquidites: number;
  };
  prevTotal: number;
  yearVersements: number;
  prevYearVersements: number;
  evolution: {
    Action: number;
    Immo: number;
    Obligations: number;
    Liquidites: number;
    total: number;
  } | null;
  evolutionPercent: {
    Action: number | null;
    Immo: number | null;
    Obligations: number | null;
    Liquidites: number | null;
    total: number | null;
  } | null;
}

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#64748b'];

export default function PatrimoinePage() {
  const [evolutionData, setEvolutionData] = useState<EvolutionData[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [evolutionRes, summaryRes] = await Promise.all([
        fetch('/api/patrimoine?type=evolution'),
        fetch(`/api/patrimoine?type=summary&year=${year}`)
      ]);
      
      const evolution = await evolutionRes.json();
      const summary = await summaryRes.json();
      
      setEvolutionData(evolution);
      setSummaryData(summary);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [year]);

  const fetchSummary = async () => {
    try {
      const res = await fetch(`/api/patrimoine?type=summary&year=${year}`);
      const data = await res.json();
      setSummaryData(data);
    } catch (error) {
      console.error(error);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatPercent = (percent: number | null | undefined) => {
    if (percent === null || percent === undefined) return '-';
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;
  };

  if (loading) {
    return <div>Chargement...</div>;
  }

  const latestData = evolutionData[0];
  const previousData = evolutionData[1];

  const chartData = evolutionData.map(d => ({
    year: d.year,
    Total: d.total,
    Actions: d.actions,
    Immobilier: d.immo,
    Obligations: d.obligations,
    Liquidites: d.liquidites
  })).reverse();

  const TYPE_LABELS: Record<string, string> = {
    Action: 'Actions',
    Immo: 'Immobilier',
    Obligations: 'Obligations',
    Liquidites: 'Liquidites'
  };

  const TYPES = ['Action', 'Immo', 'Obligations', 'Liquidites'];

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Patrimoine</h1>
            <p className="page-subtitle">Évolution de votre patrimoine</p>
          </div>
          <select className="form-select" value={year} onChange={(e) => setYear(e.target.value)} style={{ width: 'auto' }}>
            {[2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats for selected year */}
      {summaryData && (
        <>
          {!summaryData.hasData && (
            <div className="card" style={{ borderLeft: '4px solid #f59e0b', backgroundColor: '#fffbeb' }}>
              <p style={{ color: '#92400e', margin: 0 }}>
                <strong>Pas de données pour {summaryData.year}</strong>. Veuillez sélectionner une année avec des données saisies.
              </p>
            </div>
          )}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total {summaryData.year}</div>
              <div className="stat-value">{formatAmount(summaryData.total)}</div>
            </div>
            {summaryData.evolution ? (
              <div className="stat-card">
                <div className="stat-label">Évolution vs {summaryData.prevYear}</div>
                <div className={`stat-value ${(summaryData.evolution.total || 0) >= 0 ? 'positive' : 'negative'}`}>
                  {formatAmount(summaryData.evolution.total)}
                </div>
                {summaryData.evolutionPercent && summaryData.evolutionPercent.total !== null && (
                  <span className={`badge ${summaryData.evolutionPercent.total >= 0 ? 'badge-success' : 'badge-danger'}`}>
                    {formatPercent(summaryData.evolutionPercent.total)}
                  </span>
                )}
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-light)' }}>
                  Versements: {formatAmount(summaryData.yearVersements - summaryData.prevYearVersements)}
                </div>
              </div>
            ) : (
              <div className="stat-card">
                <div className="stat-label">Évolution vs {summaryData.prevYear}</div>
                <div className="stat-value" style={{ color: 'var(--text-light)' }}>-</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Evolution chart */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Évolution du patrimoine</h2>
        </div>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip formatter={(value: number) => formatAmount(value)} />
              <Legend />
              <Line type="monotone" dataKey="Total" stroke="#000" strokeWidth={3} dot={{ r: 5, fill: '#000' }} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="Actions" stroke={COLORS[0]} strokeWidth={2} dot={{ r: 4, fill: COLORS[0] }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Immobilier" stroke={COLORS[1]} strokeWidth={2} dot={{ r: 4, fill: COLORS[1] }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Obligations" stroke={COLORS[2]} strokeWidth={2} dot={{ r: 4, fill: COLORS[2] }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Liquidites" stroke={COLORS[3]} strokeWidth={2} dot={{ r: 4, fill: COLORS[3] }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary table for selected year */}
      {summaryData && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Répartition {summaryData.year}</h2>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Montant {summaryData.year}</th>
                  <th style={{ textAlign: 'right' }}>Montant {summaryData.prevYear}</th>
                  <th style={{ textAlign: 'right' }}>Évolution</th>
                  <th style={{ textAlign: 'right' }}>Évolution %</th>
                </tr>
              </thead>
              <tbody>
                {TYPES.map((type, idx) => {
                  const typeKey = type as keyof typeof summaryData.totals;
                  const current = summaryData.totals[typeKey] || 0;
                  const prev = summaryData.prevTotals[typeKey] || 0;
                  const evol = summaryData.evolution ? summaryData.evolution[typeKey] : null;
                  const evolPercent = summaryData.evolutionPercent ? summaryData.evolutionPercent[typeKey] : null;
                  
                  return (
                    <tr key={type}>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: COLORS[idx] }}></span>
                          {TYPE_LABELS[type]}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatAmount(current)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(prev)}</td>
                      <td style={{ textAlign: 'right' }}>
                        {evol !== null ? (
                          <span className={evol >= 0 ? 'badge badge-success' : 'badge badge-danger'}>
                            {evol >= 0 ? '+' : ''}{formatAmount(evol)}
                          </span>
                        ) : '-'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {evolPercent !== null ? (
                          <span className={evolPercent >= 0 ? 'badge badge-success' : 'badge badge-danger'}>
                            {formatPercent(evolPercent)}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ fontWeight: 'bold', backgroundColor: 'var(--bg-secondary)' }}>
                  <td>Total</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(summaryData.total)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(summaryData.prevTotal)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {summaryData.evolution ? (
                      <span className={summaryData.evolution.total >= 0 ? 'badge badge-success' : 'badge badge-danger'}>
                        {summaryData.evolution.total >= 0 ? '+' : ''}{formatAmount(summaryData.evolution.total)}
                      </span>
                    ) : '-'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {summaryData.evolutionPercent && summaryData.evolutionPercent.total !== null ? (
                      <span className={summaryData.evolutionPercent.total >= 0 ? 'badge badge-success' : 'badge badge-danger'}>
                        {formatPercent(summaryData.evolutionPercent.total)}
                      </span>
                    ) : '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full evolution table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Historique complet</h2>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Année</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
                <th style={{ textAlign: 'right' }}>Immobilier</th>
                <th style={{ textAlign: 'right' }}>Obligations</th>
                <th style={{ textAlign: 'right' }}>Liquidites</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'right' }}>Évolution</th>
              </tr>
            </thead>
            <tbody>
              {evolutionData.map((d) => (
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
                        {formatPercent(d.evolution_percent)}
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
