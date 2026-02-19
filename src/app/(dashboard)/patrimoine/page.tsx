'use client';

import { useEffect, useState } from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface EvolutionData {
  year: number;
  isHistorical?: boolean;
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
  const [showHistoricalModal, setShowHistoricalModal] = useState(false);
  const [historicalYear, setHistoricalYear] = useState('');
  const [historicalTotal, setHistoricalTotal] = useState('');

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
      
      console.log('Evolution data:', evolution);
      console.log('Historical entries:', evolution.filter((d: any) => d.isHistorical));
      
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

  const formatAmount = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '-';
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

  // Calculate projected data (N-1 + 5% + 12 000€ annual)
  const calculateProjectedData = () => {
    if (evolutionData.length === 0) return [];
    
    // Sort by year ascending
    const sortedData = [...evolutionData].sort((a, b) => a.year - b.year);
    const projected: { year: number; value: number }[] = [];
    
    // Find first year with data
    let baseValue: number | null = null;
    let startYear: number | null = null;
    
    for (const d of sortedData) {
      if (d.total > 0) {
        baseValue = d.total;
        startYear = d.year;
        break;
      }
    }
    
    if (!baseValue || !startYear) return [];
    
    // Calculate projection for each year from start to max year
    const maxYear = Math.max(...sortedData.map(d => d.year));
    let currentValue = baseValue;
    
    for (let yr = startYear; yr <= maxYear; yr++) {
      if (yr === startYear) {
        projected.push({ year: yr, value: currentValue });
      } else {
        currentValue = currentValue * 1.05 + 12000;
        projected.push({ year: yr, value: currentValue });
      }
    }
    
    return projected;
  };

  const projectedData = calculateProjectedData();

  const chartData = evolutionData.map(d => ({
    year: d.year,
    Total: d.total,
    Projected: projectedData.find(p => p.year === d.year)?.value || null,
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

  const saveHistoricalTotal = async () => {
    if (!historicalYear || !historicalTotal) return;
    await fetch('/api/patrimoine?type=post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        historical_year: parseInt(historicalYear),
        historical_total: parseFloat(historicalTotal)
      })
    });
    setShowHistoricalModal(false);
    setHistoricalYear('');
    setHistoricalTotal('');
    fetchData();
  };

  const deleteHistoricalYear = async (yr: number) => {
    await fetch(`/api/patrimoine?historical_year=${yr}`, { method: 'DELETE' });
    fetchData();
  };

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

      {/* Historical totals management */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card-title">Historique pré-diversification</h2>
          <button className="btn btn-primary" onClick={() => setShowHistoricalModal(true)}>
            + Ajouter
          </button>
        </div>
        {evolutionData.filter(d => d.isHistorical).length === 0 ? (
          <p style={{ padding: '1rem', color: 'var(--text-light)' }}>Aucun historique pré-diversification enregistré</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Année</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {evolutionData.filter(d => d.isHistorical).map(d => (
                  <tr key={d.year}>
                    <td>{d.year}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatAmount(d.total)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => deleteHistoricalYear(d.year)}>
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historical modal */}
      {showHistoricalModal && (
        <div className="modal-overlay" onClick={() => setShowHistoricalModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Ajouter un total historique</h3>
              <button className="modal-close" onClick={() => setShowHistoricalModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Année</label>
                <input
                  type="number"
                  className="form-input"
                  value={historicalYear}
                  onChange={e => setHistoricalYear(e.target.value)}
                  placeholder="Ex: 2019"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Total du patrimoine</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={historicalTotal}
                  onChange={e => setHistoricalTotal(e.target.value)}
                  placeholder="Ex: 150000"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowHistoricalModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={saveHistoricalTotal}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

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
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip formatter={(value: number) => formatAmount(value)} />
              <Legend />
              <Area type="monotone" dataKey="Liquidites" stackId="1" stroke={COLORS[3]} fill={COLORS[3]} fillOpacity={0.6} />
              <Area type="monotone" dataKey="Obligations" stackId="1" stroke={COLORS[2]} fill={COLORS[2]} fillOpacity={0.6} />
              <Area type="monotone" dataKey="Immobilier" stackId="1" stroke={COLORS[1]} fill={COLORS[1]} fillOpacity={0.6} />
              <Area type="monotone" dataKey="Actions" stackId="1" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.6} />
              <Line type="monotone" dataKey="Total" stroke="#000" strokeWidth={3} dot={{ r: 5, fill: '#000' }} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="Projected" stroke="#dc2626" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4, fill: '#dc2626' }} name="Prévisionnel (5% + 12k€/an)" />
            </ComposedChart>
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
