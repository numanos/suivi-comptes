'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportData {
  categories: { name: string; value: number; theme: string }[];
  subcategories: { name: string; category_name: string; value: number }[];
  thematic: {
    alimentation: number;
    scolarite: number;
    sante: number;
    assurances: number;
    epargne: number;
    revenus: number;
  };
}

const COLORS = [
  '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#f97316', '#64748b', '#0ea5e9'
];

const monthNames = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export default function ExportsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  const formatAmount = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0,00 €';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
      .format(amount)
      .replace(/\u00a0/g, ' ')
      .replace(/\u202f/g, ' ');
  };

  useEffect(() => {
    fetch('/api/transactions?getYears=true')
      .then(res => res.json())
      .then(data => {
        if (data.years) {
          const years = data.years.sort((a: number, b: number) => b - a);
          setAvailableYears(years);
        }
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    const monthParam = selectedMonth === 'all' ? '' : `&month=${selectedMonth}`;
    fetch(`/api/transactions/summary?type=reports&year=${selectedYear}${monthParam}`)
      .then(res => res.json())
      .then(data => {
        setReportData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Fetch error:', err);
        setLoading(false);
      });
  }, [selectedYear, selectedMonth]);

  const generatePDF = () => {
    if (!reportData) return;

    const doc = new jsPDF();
    const period = selectedMonth === 'all' 
      ? `Année ${selectedYear}` 
      : `${monthNames[parseInt(selectedMonth) - 1]} ${selectedYear}`;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(37, 99, 235);
    doc.text('Bilan Financier Personnel', 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.text(`Période : ${period}`, 14, 32);
    doc.text(`Généré le : ${new Date().toLocaleDateString('fr-FR')}`, 14, 38);

    // Summary Cards
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 45, 182, 30, 3, 3, 'FD');
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('REVENUS', 25, 55);
    doc.text('DÉPENSES', 85, 55);
    doc.text('ÉPARGNE', 145, 55);

    const totalExpenses = reportData.categories.reduce((sum, c) => sum + c.value, 0);
    
    doc.setFontSize(14);
    doc.setTextColor(16, 185, 129); // Green
    doc.text(formatAmount(reportData.thematic.revenus), 25, 65);
    
    doc.setTextColor(239, 68, 68); // Red
    doc.text(formatAmount(totalExpenses), 85, 65);
    
    doc.setTextColor(37, 99, 235); // Blue
    doc.text(formatAmount(reportData.thematic.epargne), 145, 65);

    // Categories Table
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('Répartition par catégorie', 14, 90);

    const categoryRows = reportData.categories.map(c => [
      c.name,
      c.theme,
      formatAmount(c.value),
      `${((c.value / (totalExpenses || 1)) * 100).toFixed(1)}%`
    ]);

    autoTable(doc, {
      startY: 95,
      head: [['Catégorie', 'Thème', 'Montant', '%']],
      body: categoryRows,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] }
    });

    // Thematic Focus
    const currentY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(16);
    doc.text('Focus thématiques', 14, currentY);

    const thematicRows = [
      ['Alimentation (Courses, Repas)', formatAmount(reportData.thematic.alimentation)],
      ['Enfants & Scolarité', formatAmount(reportData.thematic.scolarite)],
      ['Santé', formatAmount(reportData.thematic.sante)],
      ['Assurances (Logement, Auto, etc.)', formatAmount(reportData.thematic.assurances)]
    ];

    autoTable(doc, {
      startY: currentY + 5,
      body: thematicRows,
      theme: 'grid',
      styles: { cellPadding: 5 },
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } }
    });

    // Top Subcategories
    const subY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(16);
    doc.text('Top 15 des dépenses détaillées', 14, subY);

    const subRows = reportData.subcategories.map(s => [
      s.name,
      s.category_name,
      formatAmount(s.value)
    ]);

    autoTable(doc, {
      startY: subY + 5,
      head: [['Sous-catégorie', 'Catégorie parente', 'Montant']],
      body: subRows,
      theme: 'striped',
      headStyles: { fillColor: [100, 116, 139] }
    });

    doc.save(`Bilan_Financier_${period.replace(' ', '_')}.pdf`);
  };

  if (loading && !reportData) {
    return <div className="p-8">Chargement du rapport...</div>;
  }

  const totalExpenses = reportData?.categories.reduce((sum, c) => sum + c.value, 0) || 0;

  return (
    <div className="reports-page">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <h1 className="page-title">Exports & Rapports</h1>
            <p className="page-subtitle">Analysez vos finances et générez vos bilans</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <select 
              className="form-select" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="all">Toute l'année</option>
              {monthNames.map((name, idx) => (
                <option key={idx} value={idx + 1}>{name}</option>
              ))}
            </select>
            <select 
              className="form-select" 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{ width: 'auto' }}
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={generatePDF}>
              Générer PDF
            </button>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Alimentation</div>
          <div className="stat-value" style={{ color: 'var(--text-main)' }}>
            {formatAmount(reportData?.thematic.alimentation)}
          </div>
          <div className="stat-subtitle">Frais de bouche & courses</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Enfants & Scolarité</div>
          <div className="stat-value" style={{ color: 'var(--text-main)' }}>
            {formatAmount(reportData?.thematic.scolarite)}
          </div>
          <div className="stat-subtitle">Cantine, garde, activités</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Santé</div>
          <div className="stat-value" style={{ color: 'var(--text-main)' }}>
            {formatAmount(reportData?.thematic.sante)}
          </div>
          <div className="stat-subtitle">Médecins & pharmacie</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Assurances</div>
          <div className="stat-value" style={{ color: 'var(--text-main)' }}>
            {formatAmount(reportData?.thematic.assurances)}
          </div>
          <div className="stat-subtitle">Habitation, Auto, Prévoyance</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Répartition par catégorie</h2>
          </div>
          <div className="chart-container" style={{ height: '400px' }}>
            {reportData && reportData.categories.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reportData.categories}
                    cx="40%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {reportData.categories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatAmount(v)} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ paddingLeft: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-light)' }}>
                Aucune donnée pour cette période
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Top 10 Sous-catégories</h2>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Sous-catégorie</th>
                  <th style={{ textAlign: 'right' }}>Montant</th>
                  <th style={{ textAlign: 'right' }}>% total</th>
                </tr>
              </thead>
              <tbody>
                {reportData?.subcategories.slice(0, 10).map((s, idx) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{s.category_name}</div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatAmount(s.value)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="badge badge-secondary">
                        {((s.value / totalExpenses) * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
