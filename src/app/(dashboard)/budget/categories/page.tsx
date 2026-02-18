'use client';

import { useEffect, useState } from 'react';

interface Theme {
  id: number;
  name: string;
  display_order: number;
  categories: Category[];
}

interface Category {
  id: number;
  name: string;
  subcategories: Subcategory[];
}

interface Subcategory {
  id: number;
  name: string;
}

export default function CategoriesPage() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTheme, setShowAddTheme] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState<number | null>(null);
  const [newThemeName, setNewThemeName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubcategories, setNewSubcategories] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setThemes(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThemeName.trim()) return;

    try {
      await fetch('/api/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newThemeName })
      });
      setNewThemeName('');
      setShowAddTheme(false);
      fetchCategories();
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim() || !selectedThemeId) return;

    const subcategories = newSubcategories.split(',').map(s => s.trim()).filter(s => s);

    try {
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName,
          theme_id: selectedThemeId,
          subcategories
        })
      });
      setNewCategoryName('');
      setNewSubcategories('');
      setShowAddCategory(false);
      fetchCategories();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteTheme = async (id: number) => {
    if (!confirm('Supprimer ce thème ?')) return;
    try {
      await fetch(`/api/themes?id=${id}`, { method: 'DELETE' });
      fetchCategories();
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return <div>Chargement...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Catégories</h1>
            <p className="page-subtitle">Gestion des catégories et sous-catégories</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAddTheme(true)}>
            + Nouveau thème
          </button>
        </div>
      </div>

      {/* Add Theme Modal */}
      {showAddTheme && (
        <div className="modal-overlay" onClick={() => setShowAddTheme(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Nouveau thème</h3>
              <button className="modal-close" onClick={() => setShowAddTheme(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddTheme}>
              <div className="form-group">
                <label className="form-label">Nom du thème</label>
                <input
                  type="text"
                  className="form-input"
                  value={newThemeName}
                  onChange={(e) => setNewThemeName(e.target.value)}
                  placeholder="Ex: Dépenses exceptionnelles"
                />
              </div>
              <button type="submit" className="btn btn-primary">Créer</button>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCategory && (
        <div className="modal-overlay" onClick={() => setShowAddCategory(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Nouvelle catégorie</h3>
              <button className="modal-close" onClick={() => setShowAddCategory(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddCategory}>
              <div className="form-group">
                <label className="form-label">Thème</label>
                <select
                  className="form-select"
                  value={selectedThemeId || ''}
                  onChange={(e) => setSelectedThemeId(Number(e.target.value))}
                >
                  <option value="">Sélectionner...</option>
                  {themes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Nom de la catégorie</label>
                <input
                  type="text"
                  className="form-input"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Ex: Supermarché"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Sous-catégories (séparées par virgule)</label>
                <input
                  type="text"
                  className="form-input"
                  value={newSubcategories}
                  onChange={(e) => setNewSubcategories(e.target.value)}
                  placeholder="Ex: Leclerc, Carrefour, Auchan"
                />
              </div>
              <button type="submit" className="btn btn-primary">Créer</button>
            </form>
          </div>
        </div>
      )}

      {/* Categories by theme */}
      {themes.map((theme) => (
        <div key={theme.id} className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <h2 className="card-title">{theme.name}</h2>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                onClick={() => {
                  setSelectedThemeId(theme.id);
                  setShowAddCategory(true);
                }}
              >
                + Catégorie
              </button>
            </div>
          </div>

          {theme.categories.length === 0 ? (
            <p style={{ color: 'var(--text-light)' }}>Aucune catégorie</p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Catégorie</th>
                    <th>Sous-catégories</th>
                  </tr>
                </thead>
                <tbody>
                  {theme.categories.map((cat) => (
                    <tr key={cat.id}>
                      <td>{cat.name}</td>
                      <td>
                        {cat.subcategories.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {cat.subcategories.map((sub) => (
                              <span key={sub.id} className="badge badge-primary">
                                {sub.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-light)' }}>-</span>
                        )}
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
  );
}
