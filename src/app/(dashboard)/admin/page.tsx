'use client';

import { useState, useEffect } from 'react';

interface Envelope {
  id: number;
  name: string;
}

export default function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [loadingEnvelopes, setLoadingEnvelopes] = useState(false);

  useEffect(() => {
    fetchEnvelopes();
  }, []);

  const fetchEnvelopes = async () => {
    setLoadingEnvelopes(true);
    try {
      const res = await fetch('/api/patrimoine?type=envelopes');
      const data = await res.json();
      if (Array.isArray(data)) {
        setEnvelopes(data.map((e: any) => ({ id: e.id, name: e.name })));
      }
    } catch (error) {
      console.error('Error fetching envelopes:', error);
    } finally {
      setLoadingEnvelopes(false);
    }
  };

  const handleDeleteEnvelope = async (id: number, name: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer définitivement l'enveloppe "${name}" ?\n\nCette action supprimera:\n- L'enveloppe elle-même\n- Tous ses placements (toutes années)\n- Tous ses versements\n\nCette action est irréversible.`)) return;
    
    setLoading(true);
    setMessage('');
    
    try {
      const res = await fetch(`/api/patrimoine?id=${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      
      if (data.success) {
        setMessage(`Enveloppe "${name}" supprimée avec succès`);
        fetchEnvelopes();
      } else {
        setMessage('Erreur: ' + (data.error || 'Inconnue'));
      }
    } catch (error) {
      setMessage('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string) => {
    if (!confirm('Êtes-vous sûr ? Cette action est irréversible.')) return;
    
    setLoading(true);
    setMessage('');
    
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      
      if (data.success) {
        setMessage(data.message);
      } else {
        setMessage('Erreur: ' + (data.error || 'Inconnue'));
      }
    } catch (error) {
      setMessage('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Administration</h1>
        <p className="page-subtitle">Gestion avancée de l'application</p>
      </div>

      {message && (
        <div className="card" style={{ background: '#dcfce7', borderColor: '#22c55e' }}>
          <p style={{ color: '#166534', fontWeight: 500 }}>{message}</p>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Données - Transactions</h2>
        </div>
        <p style={{ marginBottom: '1rem', color: 'var(--text-light)' }}>
          Ces actions vont supprimer définitivement les données de la base.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-danger" 
            onClick={() => handleAction('purge_transactions')}
            disabled={loading}
          >
            Purger les transactions
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Données - Catégories</h2>
        </div>
        <p style={{ marginBottom: '1rem', color: 'var(--text-light)' }}>
          Supprimer ou réinitialiser les catégories et sous-catégories.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-danger" 
            onClick={() => handleAction('purge_categories')}
            disabled={loading}
          >
            Supprimer toutes les catégories
          </button>
          <button 
            className="btn btn-warning" 
            style={{ background: '#f59e0b', color: 'white' }}
            onClick={() => handleAction('reset_categories')}
            disabled={loading}
          >
            Réinitialiser catégories par défaut
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Patrimoine - Enveloppes</h2>
        </div>
        <p style={{ marginBottom: '1rem', color: 'var(--text-light)' }}>
          Gestion des enveloppes de patrimoine. La suppression est irréversible.
        </p>
        
        {/* Liste des enveloppes avec suppression individuelle */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-light)' }}>
            Supprimer une enveloppe spécifique
          </h3>
          {loadingEnvelopes ? (
            <p>Chargement des enveloppes...</p>
          ) : envelopes.length === 0 ? (
            <p style={{ color: 'var(--text-light)' }}>Aucune enveloppe trouvée</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {envelopes.map((envelope) => (
                <div 
                  key={envelope.id} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '0.75rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: '4px'
                  }}
                >
                  <span>{envelope.name}</span>
                  <button
                    className="btn btn-danger"
                    style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                    onClick={() => handleDeleteEnvelope(envelope.id, envelope.name)}
                    disabled={loading}
                  >
                    Supprimer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-light)' }}>
            Actions globales
          </h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-danger" 
              onClick={() => handleAction('purge_envelopes')}
              disabled={loading}
            >
              Supprimer toutes les enveloppes
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title" style={{ color: '#dc2626' }}>⚠️ Zone dangereuse</h2>
        </div>
        <p style={{ marginBottom: '1rem', color: 'var(--text-light)' }}>
          Cette action va supprimer TOUTES les données (transactions, catégories, patrimoine).
        </p>
        <button 
          className="btn btn-danger" 
          onClick={() => handleAction('purge_all')}
          disabled={loading}
          style={{ background: '#991b1b' }}
        >
          Tout purger
        </button>
      </div>
    </div>
  );
}
