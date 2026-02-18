'use client';

import { useState, useRef } from 'react';

export default function BudgetPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (year) params.set('year', year);
      if (month) params.set('month', month);
      
      const res = await fetch(`/api/transactions?${params}`);
      const data = await res.json();
      setTransactions(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImporting(true);
    setImportResult(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setImporting(false);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      setImportResult(data);
      if (data.success) {
        fetchTransactions();
      }
    } catch (error) {
      setImportResult({ error: 'Erreur lors de l\'import' });
    } finally {
      setImporting(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Budget</h1>
        <p className="page-subtitle">Suivi des dépenses et revenus</p>
      </div>

      {/* Import CSV */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Importer un fichier CSV</h2>
        </div>
        
        <form onSubmit={handleImport}>
          <div className="form-group">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="form-input"
              style={{ padding: '0.5rem' }}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={importing}>
            {importing ? 'Import en cours...' : 'Importer'}
          </button>
        </form>

        {importResult && (
          <div style={{ marginTop: '1rem' }}>
            {importResult.success ? (
              <div className="badge badge-success">
                {importResult.imported} transactions importées
              </div>
            ) : (
              <div className="badge badge-danger">
                {importResult.error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Transactions</h2>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Année</label>
            <select className="form-select" value={year} onChange={(e) => setYear(e.target.value)}>
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Mois</label>
            <select className="form-select" value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">Tous</option>
              {['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'].map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, alignSelf: 'flex-end' }}>
            <button className="btn btn-primary" onClick={fetchTransactions}>
              Filtrer
            </button>
          </div>
        </div>

        {loading ? (
          <div>Chargement...</div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <p>Aucune transaction trouvée</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Libellé</th>
                  <th>Catégorie</th>
                  <th>Sous-catégorie</th>
                  <th style={{ textAlign: 'right' }}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{formatDate(t.date)}</td>
                    <td>{t.libelle}</td>
                    <td>{t.category_name || '-'}</td>
                    <td>{t.subcategory_name || '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={t.amount >= 0 ? 'badge badge-success' : 'badge badge-danger'}>
                        {formatAmount(t.amount)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
