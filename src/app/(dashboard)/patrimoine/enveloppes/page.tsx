'use client';

import { useEffect, useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface Placement {
  id: number;
  envelope_id: number;
  name: string;
  type_placement: string;
  year: number;
  valorization: number;
}

interface Envelope {
  id: number;
  name: string;
  exclude_from_gains: boolean;
  year_versements: number;
  prev_year_versements: number;
  placements: Placement[];
}

const TYPES = ['Action', 'Immo', 'Obligations', 'Liquidites'];

export default function EnveloppesPage() {
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [showAddEnvelope, setShowAddEnvelope] = useState(false);
  const [showAddPlacement, setShowAddPlacement] = useState(false);
  const [showEditEnvelope, setShowEditEnvelope] = useState(false);
  const [showEditPlacement, setShowEditPlacement] = useState(false);
  const [editingEnvelope, setEditingEnvelope] = useState<Envelope | null>(null);
  const [editingPlacement, setEditingPlacement] = useState<Placement | null>(null);
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState<number | null>(null);
  
  const [newEnvelopeName, setNewEnvelopeName] = useState('');
  const [newEnvelopeVersements, setNewEnvelopeVersements] = useState('');
  const [editExcludeFromGains, setEditExcludeFromGains] = useState(false);
  const [editEnvelopeVersements, setEditEnvelopeVersements] = useState('');
  const [editAnnualVersement, setEditAnnualVersement] = useState('');
  const [prevYearVersements, setPrevYearVersements] = useState(0);
  
  const [newPlacementName, setNewPlacementName] = useState('');
  const [newPlacementType, setNewPlacementType] = useState('Action');
  const [newPlacementValorization, setNewPlacementValorization] = useState('');
  
  const [editPlacementName, setEditPlacementName] = useState('');
  const [editPlacementType, setEditPlacementType] = useState('Action');
  const [editPlacementValorization, setEditPlacementValorization] = useState('');

  useEffect(() => {
    fetchEnvelopes();
  }, [year]);

  const fetchEnvelopes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/patrimoine?type=envelopes&year=${year}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setEnvelopes(data);
      } else {
        console.error('API returned error:', data);
        setEnvelopes([]);
      }
    } catch (error) {
      console.error(error);
      setEnvelopes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEnvelope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEnvelopeName.trim()) return;

    try {
      await fetch('/api/patrimoine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newEnvelopeName,
          year: parseInt(year),
          versements: parseFloat(newEnvelopeVersements) || 0
        })
      });
      setNewEnvelopeName('');
      setNewEnvelopeVersements('');
      setShowAddEnvelope(false);
      fetchEnvelopes();
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditEnvelope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEnvelope) return;

    // If annual versements field is empty, don't update versements
    const annualVersement = editAnnualVersement.trim() === '' ? null : parseFloat(editAnnualVersement);

    try {
      await fetch('/api/patrimoine', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingEnvelope.id,
          name: editingEnvelope.name,
          exclude_from_gains: editExcludeFromGains,
          year: parseInt(year),
          versements: annualVersement
        })
      });
      setShowEditEnvelope(false);
      setEditingEnvelope(null);
      fetchEnvelopes();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteEnvelope = async (id: number) => {
    const currentYear = parseInt(year);
    if (!confirm(`Supprimer les placements de ${currentYear} pour cette enveloppe ? L\'historique des autres années sera préservé.`)) return;
    
    try {
      await fetch(`/api/patrimoine?envelope_id=${id}&year=${currentYear}`, { method: 'DELETE' });
      fetchEnvelopes();
    } catch (error) {
      console.error(error);
    }
  };

  const handleCloseEnvelope = async (id: number, envelopeName: string) => {
    const currentYear = parseInt(year);
    if (!confirm(`Fermer l\'enveloppe "${envelopeName}" à partir de ${currentYear} ? Elle ne sera plus disponible pour ${currentYear} et les années suivantes, mais l'historique sera préservé.`)) return;
    
    try {
      await fetch('/api/patrimoine', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          close_envelope: true,
          year: currentYear
        })
      });
      fetchEnvelopes();
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddPlacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlacementName.trim() || !selectedEnvelopeId) return;

    try {
      await fetch('/api/patrimoine/placements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          envelope_id: selectedEnvelopeId,
          name: newPlacementName,
          type_placement: newPlacementType,
          year: parseInt(year),
          valorization: parseFloat(newPlacementValorization) || 0
        })
      });
      setNewPlacementName('');
      setNewPlacementType('Action');
      setNewPlacementValorization('');
      setShowAddPlacement(false);
      fetchEnvelopes();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeletePlacement = async (id: number) => {
    if (!confirm('Supprimer ce placement ?')) return;
    
    try {
      await fetch(`/api/patrimoine/placements?id=${id}`, { method: 'DELETE' });
      fetchEnvelopes();
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditPlacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlacement) return;

    try {
      await fetch('/api/patrimoine/placements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPlacement.id,
          name: editPlacementName,
          type_placement: editPlacementType,
          year: editingPlacement.year,
          valorization: parseFloat(editPlacementValorization) || 0
        })
      });
      setShowEditPlacement(false);
      setEditingPlacement(null);
      fetchEnvelopes();
    } catch (error) {
      console.error(error);
    }
  };

  const handleCopyFromPreviousYear = async (envelopeId: number) => {
    if (!confirm('Copier les placements de l\'année précédente ? Les valorisations seront à mettre à jour.')) return;
    
    try {
      const res = await fetch(`/api/patrimoine/placements?envelope_id=${envelopeId}&year=${parseInt(year) - 1}`);
      const previousPlacements = await res.json();
      
      for (const p of previousPlacements) {
        await fetch('/api/patrimoine/placements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            envelope_id: envelopeId,
            name: p.name,
            type_placement: p.type_placement,
            year: parseInt(year),
            valorization: 0
          })
        });
      }
      fetchEnvelopes();
    } catch (error) {
      console.error(error);
    }
  };

  const openEditPlacement = (placement: Placement) => {
    setEditingPlacement(placement);
    setEditPlacementName(placement.name);
    setEditPlacementType(placement.type_placement);
    setEditPlacementValorization(placement.valorization?.toString() || '0');
    setShowEditPlacement(true);
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#64748b'];

  const pieData = useMemo(() => {
    const totals: Record<string, number> = { Action: 0, Immo: 0, Obligations: 0, Liquidites: 0 };
    let total = 0;
    for (const env of envelopes) {
      for (const p of env.placements) {
        if (p.type_placement && p.valorization) {
          totals[p.type_placement] = (totals[p.type_placement] || 0) + Number(p.valorization);
          total += Number(p.valorization);
        }
      }
    }
    return Object.entries(totals)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({
        name,
        value,
        percent: total > 0 ? (value / total) * 100 : 0
      }));
  }, [envelopes]);

  const TYPE_LABELS: Record<string, string> = {
    Action: 'Actions',
    Immo: 'Immobilier',
    Obligations: 'Obligations',
    Liquidites: 'Liquidités'
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Action': return 'badge-primary';
      case 'Immo': return 'badge-success';
      case 'Obligations': return 'badge-warning';
      case 'Liquidites': return 'badge-danger';
      default: return 'badge-primary';
    }
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Enveloppes</h1>
            <p className="page-subtitle">Gestion des produits de placement</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <select className="form-select" value={year} onChange={(e) => setYear(e.target.value)}>
              {[2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={() => setShowAddEnvelope(true)}>
              + Nouvelle enveloppe
            </button>
          </div>
        </div>
      </div>

      {pieData.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Répartition du patrimoine {year}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ width: 600, height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="40%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percent }) => `${percent.toFixed(1)}%`}
                    labelLine={{ stroke: '#666', strokeWidth: 1, length: 15, length2: 10 }}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatAmount(value)} />
                  <Legend 
                    layout="vertical" 
                    verticalAlign="middle" 
                    align="right"
                    formatter={(value, entry: any) => `${TYPE_LABELS[value] || value}: ${formatAmount(entry.payload.value)}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {showAddEnvelope && (
        <div className="modal-overlay" onClick={() => setShowAddEnvelope(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Nouvelle enveloppe</h3>
              <button className="modal-close" onClick={() => setShowAddEnvelope(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddEnvelope}>
              <div className="form-group">
                <label className="form-label">Nom de l'enveloppe</label>
                <input
                  type="text"
                  className="form-input"
                  value={newEnvelopeName}
                  onChange={(e) => setNewEnvelopeName(e.target.value)}
                  placeholder="Ex: Assurance Vie Linxea"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Versements totaux</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={newEnvelopeVersements}
                  onChange={(e) => setNewEnvelopeVersements(e.target.value)}
                  placeholder="Montant total des versements"
                />
              </div>
              <button type="submit" className="btn btn-primary">Créer</button>
            </form>
          </div>
        </div>
      )}

      {showEditEnvelope && editingEnvelope && (
        <div className="modal-overlay" onClick={() => setShowEditEnvelope(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Modifier l'enveloppe</h3>
              <button className="modal-close" onClick={() => setShowEditEnvelope(false)}>&times;</button>
            </div>
            <form onSubmit={handleEditEnvelope}>
              <div className="form-group">
                <label className="form-label">Nom de l'enveloppe</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingEnvelope.name}
                  onChange={(e) => setEditingEnvelope({ ...editingEnvelope, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Total versé à fin {year}</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={editEnvelopeVersements}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditEnvelopeVersements(val);
                    // Auto-calculate annual: total - prev_year
                    const totalValue = val === '' ? 0 : (parseFloat(val) || 0);
                    const annual = totalValue - prevYearVersements;
                    setEditAnnualVersement(annual >= 0 ? annual.toString() : '');
                  }}
                />
                <small style={{ color: 'var(--text-light)' }}>Saisissez le total des versements cumulés</small>
              </div>
              <div className="form-group">
                <label className="form-label">dont versement {year}</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={editAnnualVersement}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditAnnualVersement(val);
                    // Auto-calculate total: prev_year + annual
                    const annualValue = val === '' ? 0 : (parseFloat(val) || 0);
                    const newTotal = prevYearVersements + annualValue;
                    setEditEnvelopeVersements(newTotal.toString());
                  }}
                  placeholder={prevYearVersements > 0 ? `Calculé: ${prevYearVersements} + ...` : "Laissez vide"}
                />
                <small style={{ color: 'var(--text-light)' }}>
                  {prevYearVersements > 0 
                    ? `Sera ajouté au ${formatAmount(prevYearVersements)} de l'année précédente`
                    : 'Année d\'ouverture = total'}
                </small>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editExcludeFromGains}
                    onChange={(e) => setEditExcludeFromGains(e.target.checked)}
                  />
                  Exclure du calcul des gains
                </label>
                <small style={{ color: 'var(--text-light)' }}>Cochez pour les livrets bancaires (liquidités de secours)</small>
              </div>
              <button type="submit" className="btn btn-primary">Enregistrer</button>
            </form>
          </div>
        </div>
      )}

      {showAddPlacement && (
        <div className="modal-overlay" onClick={() => setShowAddPlacement(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Nouveau placement</h3>
              <button className="modal-close" onClick={() => setShowAddPlacement(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddPlacement}>
              <div className="form-group">
                <label className="form-label">Nom du placement</label>
                <input
                  type="text"
                  className="form-input"
                  value={newPlacementName}
                  onChange={(e) => setNewPlacementName(e.target.value)}
                  placeholder="Ex: ETF MSCI World"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Type de placement</label>
                <select
                  className="form-select"
                  value={newPlacementType}
                  onChange={(e) => setNewPlacementType(e.target.value)}
                >
                  {TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Valorisation {year}</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={newPlacementValorization}
                  onChange={(e) => setNewPlacementValorization(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary">Créer</button>
            </form>
          </div>
        </div>
      )}

      {showEditPlacement && editingPlacement && (
        <div className="modal-overlay" onClick={() => setShowEditPlacement(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Modifier le placement</h3>
              <button className="modal-close" onClick={() => setShowEditPlacement(false)}>&times;</button>
            </div>
            <form onSubmit={handleEditPlacement}>
              <div className="form-group">
                <label className="form-label">Nom du placement</label>
                <input
                  type="text"
                  className="form-input"
                  value={editPlacementName}
                  onChange={(e) => setEditPlacementName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Type de placement</label>
                <select
                  className="form-select"
                  value={editPlacementType}
                  onChange={(e) => setEditPlacementType(e.target.value)}
                >
                  {TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Valorisation {editingPlacement.year}</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={editPlacementValorization}
                  onChange={(e) => setEditPlacementValorization(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary">Enregistrer</button>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div>Chargement...</div>
      ) : envelopes.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <p>Aucune enveloppe pour {year}</p>
            <button className="btn btn-primary" onClick={() => setShowAddEnvelope(true)}>
              Créer une enveloppe
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {envelopes.map((envelope) => {
            const totalValorization = envelope.placements.reduce((sum, p) => sum + (Number(p.valorization) || 0), 0);
            const versements = Number(envelope.year_versements) || 0;
            const gain = envelope.exclude_from_gains ? null : totalValorization - versements;
            
            return (
              <div key={envelope.id} className="card">
                <div className="card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h2 className="card-title">{envelope.name}</h2>
                    <span className="badge badge-secondary">
                      {formatAmount(versements)} versés
                    </span>
                    {envelope.exclude_from_gains && <span className="badge badge-warning">Gain désactivé</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setEditingEnvelope(envelope);
                        const currentYearVersements = Number(envelope.year_versements) || 0;
                        const prevVersements = Number(envelope.prev_year_versements) || 0;
                        // If no entry for current year, use previous year's total as current
                        const displayTotal = currentYearVersements > 0 || envelope.year_versements === 0 
                          ? currentYearVersements 
                          : prevVersements;
                        setEditEnvelopeVersements(String(displayTotal));
                        setPrevYearVersements(prevVersements);
                        // Calculate annual: display total - previous total
                        const annual = displayTotal - prevVersements;
                        setEditAnnualVersement(annual !== 0 || displayTotal > 0 ? annual.toString() : '');
                        setEditExcludeFromGains(envelope.exclude_from_gains || false);
                        setShowEditEnvelope(true);
                      }}
                    >
                      Modifier
                    </button>
                    {parseInt(year) > 2020 && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleCopyFromPreviousYear(envelope.id)}
                        title="Copier les placements de l'année précédente"
                      >
                        ↻ Année N-1
                      </button>
                    )}
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleCloseEnvelope(envelope.id, envelope.name)}
                      title={`Fermer l'enveloppe à partir de ${year}`}
                    >
                      Fermer
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDeleteEnvelope(envelope.id)}
                    >
                      Supprimer
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setSelectedEnvelopeId(envelope.id);
                        setShowAddPlacement(true);
                      }}
                    >
                      + Placement
                    </button>
                  </div>
                </div>

                {envelope.placements.length === 0 ? (
                  <p style={{ color: 'var(--text-light)' }}>Aucun placement pour {year}</p>
                ) : (
                  <>
                    <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
                      <span>Valorisation {year}: <strong>{formatAmount(totalValorization)}</strong></span>
                      {envelope.exclude_from_gains ? (
                        <span style={{ marginLeft: '1rem', color: 'var(--text-light)' }}>
                          <em>(Calcul des gains désactivé)</em>
                        </span>
                      ) : (
                        <span style={{ marginLeft: '1rem' }}>
                          Gain: <span className={gain !== null && gain >= 0 ? 'badge badge-success' : 'badge badge-danger'}>
                            {gain !== null ? formatAmount(gain) : '-'} ({versements > 0 ? (gain! / versements * 100).toFixed(1) : '0'}%)
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="table-container">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Produit</th>
                            <th>Type</th>
                            <th style={{ textAlign: 'right' }}>Valorisation</th>
                            <th style={{ width: '100px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {envelope.placements.map((p) => (
                            <tr key={p.id}>
                              <td>{p.name}</td>
                              <td><span className={`badge ${getTypeColor(p.type_placement)}`}>{p.type_placement}</span></td>
                              <td style={{ textAlign: 'right' }}>{formatAmount(p.valorization)}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                  <button
                                    className="btn btn-secondary"
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                    onClick={() => openEditPlacement(p)}
                                  >
                                    Éditer
                                  </button>
                                  <button
                                    className="btn btn-danger"
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                    onClick={() => handleDeletePlacement(p.id)}
                                  >
                                    ×
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
