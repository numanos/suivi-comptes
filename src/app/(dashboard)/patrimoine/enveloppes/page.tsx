'use client';

import { useEffect, useState } from 'react';

interface Placement {
  id: number;
  envelope_id: number;
  name: string;
  type_placement: string;
  year: number;
  versements: number;
  valorization: number;
}

interface Envelope {
  id: number;
  name: string;
  type: string;
  placements: Placement[];
}

export default function EnveloppesPage() {
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [showAddEnvelope, setShowAddEnvelope] = useState(false);
  const [showAddPlacement, setShowAddPlacement] = useState(false);
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState<number | null>(null);
  
  // Form states
  const [newEnvelopeName, setNewEnvelopeName] = useState('');
  const [newEnvelopeType, setNewEnvelopeType] = useState('Action');
  const [newPlacementName, setNewPlacementName] = useState('');
  const [newPlacementType, setNewPlacementType] = useState('');
  const [newPlacementVersements, setNewPlacementVersements] = useState('');
  const [newPlacementValorization, setNewPlacementValorization] = useState('');

  useEffect(() => {
    fetchEnvelopes();
  }, [year]);

  const fetchEnvelopes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/patrimoine?type=envelopes&year=${year}`);
      const data = await res.json();
      setEnvelopes(data);
    } catch (error) {
      console.error(error);
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
          type: newEnvelopeType
        })
      });
      setNewEnvelopeName('');
      setShowAddEnvelope(false);
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
          versements: parseFloat(newPlacementVersements) || 0,
          valorization: parseFloat(newPlacementValorization) || 0
        })
      });
      setNewPlacementName('');
      setNewPlacementType('');
      setNewPlacementVersements('');
      setNewPlacementValorization('');
      setShowAddPlacement(false);
      fetchEnvelopes();
    } catch (error) {
      console.error(error);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Action': return 'badge-primary';
      case 'Immo': return 'badge-success';
      case 'Obligations': return 'badge-warning';
      case 'Liquidités': return 'badge-danger';
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

      {/* Add Envelope Modal */}
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
                <label className="form-label">Type</label>
                <select
                  className="form-select"
                  value={newEnvelopeType}
                  onChange={(e) => setNewEnvelopeType(e.target.value)}
                >
                  <option value="Action">Actions</option>
                  <option value="Immo">Immobilier</option>
                  <option value="Obligations">Obligations</option>
                  <option value="Liquidités">Liquidités</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary">Créer</button>
            </form>
          </div>
        </div>
      )}

      {/* Add Placement Modal */}
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
                  <option value="">Sélectionner...</option>
                  <option value="Action">Action</option>
                  <option value="Immo">Immobilier</option>
                  <option value="Obligations">Obligations</option>
                  <option value="liquidité">Liquidité</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Versements</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={newPlacementVersements}
                  onChange={(e) => setNewPlacementVersements(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Valorisation</label>
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
          {envelopes.map((envelope) => (
            <div key={envelope.id} className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <h2 className="card-title">{envelope.name}</h2>
                  <span className={`badge ${getTypeColor(envelope.type)}`}>{envelope.type}</span>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setSelectedEnvelopeId(envelope.id);
                    setShowAddPlacement(true);
                  }}
                >
                  + Placement
                </button>
              </div>

              {envelope.placements.length === 0 ? (
                <p style={{ color: 'var(--text-light)' }}>Aucun placement</p>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th>Type</th>
                        <th style={{ textAlign: 'right' }}>Versements</th>
                        <th style={{ textAlign: 'right' }}>Valorisation</th>
                        <th style={{ textAlign: 'right' }}>Gain</th>
                      </tr>
                    </thead>
                    <tbody>
                      {envelope.placements.map((p) => (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td>{p.type_placement}</td>
                          <td style={{ textAlign: 'right' }}>{formatAmount(p.versements)}</td>
                          <td style={{ textAlign: 'right' }}>{formatAmount(p.valorization)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <span className={(p.valorization - p.versements) >= 0 ? 'badge badge-success' : 'badge badge-danger'}>
                              {formatAmount(p.valorization - p.versements)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
