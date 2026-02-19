'use client';

import { useState, useRef, useEffect } from 'react';

interface Transaction {
  id: number;
  date: string;
  libelle: string;
  note: string | null;
  amount: number;
  category_id: number | null;
  category_name: string | null;
  subcategory_id: number | null;
  subcategory_name: string | null;
  balance: number | null;
}

interface Category {
  id: number;
  name: string;
  theme_id: number;
  subcategories: { id: number; name: string }[];
}

interface Theme {
  id: number;
  name: string;
  categories: Category[];
}

export default function BudgetPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [month, setMonth] = useState('');
  const [filterLibelle, setFilterLibelle] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubcategory, setFilterSubcategory] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editLibelle, setEditLibelle] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<number | null>(null);
  const [editSubcategoryId, setEditSubcategoryId] = useState<number | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchYears = async () => {
    try {
      const res = await fetch('/api/transactions?getYears=true');
      const data = await res.json();
      if (data.years && data.years.length > 0) {
        setAvailableYears(data.years);
        if (!data.years.includes(parseInt(year))) {
          setYear(data.years[0].toString());
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (year) params.set('year', year);
      if (month) params.set('month', month);
      if (filterLibelle) params.set('libelle', filterLibelle);
      if (filterCategory) params.set('category', filterCategory);
      if (filterSubcategory) params.set('subcategory', filterSubcategory);
      params.set('limit', pagination.limit.toString());
      params.set('offset', pagination.offset.toString());
      
      const res = await fetch(`/api/transactions?${params}`);
      const data = await res.json();
      setTransactions(data.transactions || data || []);
      if (data.total !== undefined) {
        setPagination(prev => ({ ...prev, total: data.total }));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setThemes(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchYears();
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [year, month, pagination.offset, pagination.limit]);

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
    formData.append('dryRun', 'true');

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      console.log('DryRun response:', data);

      if (data.dryRun && data.duplicatesCount > 0) {
        setDuplicateInfo(data);
        setShowDuplicateModal(true);
        setImporting(false);
        return;
      }

      await doImport(file, true);
    } catch (error) {
      setImportResult({ error: 'Erreur lors de l\'import' });
      setImporting(false);
    }
  };

  const doImport = async (file: File, skipDuplicates: boolean) => {
    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('dryRun', 'false');
    formData.append('skipDuplicates', skipDuplicates.toString());

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
      setShowDuplicateModal(false);
    }
  };

  const handleEdit = (t: Transaction) => {
    setEditingTransaction(t);
    setEditLibelle(t.libelle);
    setEditNote(t.note || '');
    setEditCategoryId(t.category_id);
    setEditSubcategoryId(t.subcategory_id);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingTransaction) return;

    try {
      await fetch('/api/transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTransaction.id,
          libelle: editLibelle,
          note: editNote,
          category_id: editCategoryId,
          subcategory_id: editSubcategoryId
        })
      });
      setShowEditModal(false);
      fetchTransactions();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette transaction ?')) return;
    
    try {
      await fetch(`/api/transactions?id=${id}`, { method: 'DELETE' });
      fetchTransactions();
    } catch (error) {
      console.error(error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Supprimer ${selectedIds.length} transactions ?`)) return;
    
    try {
      await fetch(`/api/transactions?ids=${selectedIds.join(',')}`, { method: 'DELETE' });
      setSelectedIds([]);
      fetchTransactions();
    } catch (error) {
      console.error(error);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === transactions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(transactions.map(t => t.id));
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  const currentSubcategories = themes
    .flatMap(t => t.categories)
    .find(c => c.id === editCategoryId)?.subcategories || [];

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
                {importResult.skipped > 0 && ` (${importResult.skipped} doublons ignorés)`}
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
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {selectedIds.length > 0 && (
              <button className="btn btn-danger" onClick={handleBulkDelete}>
                Supprimer ({selectedIds.length})
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Année</label>
            <select className="form-select" value={year} onChange={(e) => { setYear(e.target.value); setPagination(p => ({ ...p, offset: 0 })); }}>
              {availableYears.length > 0 ? availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              )) : [2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Mois</label>
            <select className="form-select" value={month} onChange={(e) => { setMonth(e.target.value); setPagination(p => ({ ...p, offset: 0 })); }}>
              <option value="">Tous</option>
              {['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'].map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Libellé</label>
            <input
              type="text"
              className="form-input"
              placeholder="Rechercher..."
              value={filterLibelle}
              onChange={(e) => setFilterLibelle(e.target.value)}
              style={{ width: '150px' }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Catégorie</label>
            <select className="form-select" value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setFilterSubcategory(''); }}>
              <option value="">Toutes</option>
              {themes.flatMap(t => t.categories).map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Sous-catégorie</label>
            <select className="form-select" value={filterSubcategory} onChange={(e) => setFilterSubcategory(e.target.value)} disabled={!filterCategory}>
              <option value="">Toutes</option>
              {filterCategory && themes.flatMap(t => t.categories).find(c => c.id === Number(filterCategory))?.subcategories.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, alignSelf: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => {
              setFilterLibelle('');
              setFilterCategory('');
              setFilterSubcategory('');
              setPagination(p => ({ ...p, offset: 0 }));
            }}>
              Effacer filtres
            </button>
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
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.length === transactions.length && transactions.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>Date</th>
                    <th>Libellé</th>
                    <th>Catégorie</th>
                    <th>Sous-catégorie</th>
                    <th style={{ textAlign: 'right' }}>Montant</th>
                    <th style={{ textAlign: 'right' }}>Solde</th>
                    <th style={{ width: '150px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(t.id)}
                          onChange={() => toggleSelect(t.id)}
                        />
                      </td>
                      <td>{formatDate(t.date)}</td>
                      <td>
                        <div>{t.libelle}</div>
                        {t.note && <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{t.note}</div>}
                      </td>
                      <td>{t.category_name || '-'}</td>
                      <td>{t.subcategory_name || '-'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={t.amount >= 0 ? 'badge badge-success' : 'badge badge-danger'}>
                          {formatAmount(t.amount)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>{t.balance !== null ? formatAmount(t.balance) : '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => handleEdit(t)}
                          >
                            Modifier
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => handleDelete(t.id)}
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
            
            {pagination.total > pagination.limit ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0.5rem' }}>
                <div style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>
                  Affichage de {pagination.offset + 1} à {Math.min(pagination.offset + pagination.limit, pagination.total)} sur {pagination.total} transactions
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setPagination(p => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))}
                    disabled={pagination.offset === 0}
                  >
                    Précédent
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setPagination(p => ({ ...p, offset: p.offset + p.limit }))}
                    disabled={pagination.offset + pagination.limit >= pagination.total}
                  >
                    Suivant
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Modifier la transaction</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>&times;</button>
            </div>
            <div className="form-group">
              <label className="form-label">Libellé</label>
              <input
                type="text"
                className="form-input"
                value={editLibelle}
                onChange={(e) => setEditLibelle(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Note</label>
              <input
                type="text"
                className="form-input"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Catégorie</label>
              <select
                className="form-select"
                value={editCategoryId || ''}
                onChange={(e) => { setEditCategoryId(e.target.value ? Number(e.target.value) : null); setEditSubcategoryId(null); }}
              >
                <option value="">Sélectionner...</option>
                {themes.flatMap(t => t.categories).map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Sous-catégorie</label>
              <select
                className="form-select"
                value={editSubcategoryId || ''}
                onChange={(e) => setEditSubcategoryId(e.target.value ? Number(e.target.value) : null)}
                disabled={!editCategoryId}
              >
                <option value="">Sélectionner...</option>
                {currentSubcategories.map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" onClick={handleSaveEdit}>Enregistrer</button>
          </div>
        </div>
      )}

      {/* Duplicate Confirmation Modal */}
      {showDuplicateModal && duplicateInfo && (
        <div className="modal-overlay" onClick={() => setShowDuplicateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Doublons détectés</h3>
              <button className="modal-close" onClick={() => setShowDuplicateModal(false)}>&times;</button>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <p><strong>{duplicateInfo.duplicatesCount}</strong> doublon(s) détecté(s) dans le fichier CSV.</p>
              <p>Ces transactions ont le même date + libellé + montant.</p>
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '1rem', border: '1px solid #ddd' }}>
              <table className="table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Libellé</th>
                    <th>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {duplicateInfo.duplicatesInFile?.map((d: any, i: number) => (
                    <tr key={i}>
                      <td>{d.date}</td>
                      <td>{d.libelle}</td>
                      <td>{d.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => doImport(fileInputRef.current?.files?.[0]!, true)}
                disabled={importing}
              >
                Importer en ignorant les doublons
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => doImport(fileInputRef.current?.files?.[0]!, false)}
                disabled={importing}
              >
                Importer quand même (toutes les lignes)
              </button>
              <button 
                className="btn btn-danger" 
                onClick={() => setShowDuplicateModal(false)}
                disabled={importing}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
