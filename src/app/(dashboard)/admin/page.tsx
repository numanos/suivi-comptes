'use client';

import { useState, useEffect } from 'react';

export default function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

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
