'use client';

import { useEffect, useState } from 'react';

type Placement = { name: string; type_placement: string; valorization: string };
type Envelope = { id: number; name: string };
type Snapshot = {
  id: number;
  envelope_name: string;
  snapshot_date: string;
  net_contributions: number;
  valuation: number;
  gain: number;
  placements: { name: string; type_placement: string; valorization: number }[];
};
type Evolution = { period: string; net_contributions: number; valuation: number; gain: number };

const TYPES = ['Action', 'Immo', 'Obligations', 'Liquidites'];
const emptyPlacement = (): Placement => ({ name: '', type_placement: 'Action', valorization: '' });

export default function RelevesPage() {
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [evolution, setEvolution] = useState<Evolution[]>([]);
  const [grouping, setGrouping] = useState('date');
  const [envelopeId, setEnvelopeId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [contributions, setContributions] = useState('');
  const [placements, setPlacements] = useState<Placement[]>([emptyPlacement()]);
  const [message, setMessage] = useState('');

  const load = async () => {
    const [envelopeResponse, snapshotResponse, evolutionResponse] = await Promise.all([
      fetch(`/api/patrimoine?type=envelopes&year=${new Date().getFullYear()}`),
      fetch('/api/patrimoine/snapshots'),
      fetch(`/api/patrimoine/snapshots?type=evolution&group=${grouping}`),
    ]);
    const envelopeData = await envelopeResponse.json();
    const snapshotData = await snapshotResponse.json();
    const evolutionData = await evolutionResponse.json();
    setEnvelopes(Array.isArray(envelopeData) ? envelopeData.map((e: Envelope) => ({ id: e.id, name: e.name })) : []);
    setSnapshots(Array.isArray(snapshotData) ? snapshotData : []);
    setEvolution(Array.isArray(evolutionData) ? evolutionData : []);
  };

  useEffect(() => { load().catch(() => setMessage('Impossible de charger les relevés')); }, [grouping]);

  const updatePlacement = (index: number, field: keyof Placement, value: string) => {
    setPlacements(current => current.map((placement, i) => i === index ? { ...placement, [field]: value } : placement));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    const response = await fetch('/api/patrimoine/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        envelope_id: Number(envelopeId),
        snapshot_date: date,
        net_contributions: Number(contributions || 0),
        placements: placements.map(p => ({ ...p, valorization: Number(p.valorization || 0) })),
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || 'Le relevé n’a pas été enregistré');
      return;
    }
    setMessage('Relevé enregistré. Les placements absents de ce relevé sont considérés comme clôturés.');
    setPlacements([emptyPlacement()]);
    setContributions('');
    await load();
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Relevés datés</h1>
        <p className="page-subtitle">Conservez l’état d’une enveloppe à chaque date de valorisation</p>
      </div>

      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h2 className="card-title">Nouveau relevé</h2>
        <p style={{ color: 'var(--text-light)' }}>Un relevé ne peut être enregistré qu’une seule fois par enveloppe et par date.</p>
        <form onSubmit={save}>
          <div className="form-group">
            <label className="form-label">Enveloppe</label>
            <select className="form-select" value={envelopeId} onChange={e => setEnvelopeId(e.target.value)} required>
              <option value="">Sélectionner une enveloppe</option>
              {envelopes.map(envelope => <option key={envelope.id} value={envelope.id}>{envelope.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Date du relevé</label>
              <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Versements nets cumulés à cette date (€)</label>
              <input className="form-input" type="number" min="0" step="0.01" value={contributions} onChange={e => setContributions(e.target.value)} required />
            </div>
          </div>
          <h3>Placements présents à cette date</h3>
          {placements.map((placement, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input className="form-input" placeholder="Nom du placement" value={placement.name} onChange={e => updatePlacement(index, 'name', e.target.value)} required />
              <select className="form-select" value={placement.type_placement} onChange={e => updatePlacement(index, 'type_placement', e.target.value)}>
                {TYPES.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
              <input className="form-input" type="number" min="0" step="0.01" placeholder="Valorisation €" value={placement.valorization} onChange={e => updatePlacement(index, 'valorization', e.target.value)} required />
              <button type="button" className="btn btn-danger" onClick={() => setPlacements(current => current.filter((_, i) => i !== index))} disabled={placements.length === 1}>×</button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary" onClick={() => setPlacements(current => [...current, emptyPlacement()])}>+ Placement</button>
          <button type="submit" className="btn btn-primary" style={{ marginLeft: '0.5rem' }}>Enregistrer le relevé</button>
        </form>
        {message && <p style={{ marginTop: '1rem' }}>{message}</p>}
      </div>

      <div className="card" style={{ padding: '1.25rem' }}>
        <h2 className="card-title">Historique des relevés</h2>
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Date</th><th>Enveloppe</th><th style={{ textAlign: 'right' }}>Valorisation</th><th style={{ textAlign: 'right' }}>Versements nets</th><th style={{ textAlign: 'right' }}>Gain global</th><th>Placements</th></tr></thead>
            <tbody>
              {snapshots.map(snapshot => (
                <tr key={snapshot.id}>
                  <td>{new Date(snapshot.snapshot_date).toLocaleDateString('fr-FR')}</td>
                  <td>{snapshot.envelope_name}</td>
                  <td style={{ textAlign: 'right' }}>{snapshot.valuation.toFixed(2)} €</td>
                  <td style={{ textAlign: 'right' }}>{snapshot.net_contributions.toFixed(2)} €</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{snapshot.gain.toFixed(2)} €</td>
                  <td>{snapshot.placements.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {snapshots.length === 0 && <p style={{ color: 'var(--text-light)' }}>Aucun relevé daté.</p>}
        </div>
      </div>

      <div className="card" style={{ padding: '1.25rem', marginTop: '1.5rem' }}>
        <h2 className="card-title">Évolution globale</h2>
        <p style={{ color: 'var(--text-light)' }}>Chaque ligne correspond à une date où un relevé a été enregistré. Les écarts peuvent être comparés entre mois, trimestres ou années selon les dates saisies.</p>
        <select className="form-select" value={grouping} onChange={e => setGrouping(e.target.value)} style={{ maxWidth: '220px', marginBottom: '1rem' }}>
          <option value="date">Date exacte</option>
          <option value="month">Par mois</option>
          <option value="quarter">Par trimestre</option>
          <option value="year">Par année</option>
        </select>
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Date</th><th style={{ textAlign: 'right' }}>Valorisation</th><th style={{ textAlign: 'right' }}>Versements nets</th><th style={{ textAlign: 'right' }}>Gain global</th></tr></thead>
            <tbody>{evolution.map(row => <tr key={row.period}><td>{row.period}</td><td style={{ textAlign: 'right' }}>{row.valuation.toFixed(2)} €</td><td style={{ textAlign: 'right' }}>{row.net_contributions.toFixed(2)} €</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{row.gain.toFixed(2)} €</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
