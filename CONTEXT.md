# Projet Suivi Comptes - Contexte complet

## Objectif
Application web de suivi de budget et patrimoine avec :
- Import CSV depuis exports bancaires
- Catégorie/sous-catégorie automatique
- Gestion des transactions (éditer, supprimer, suppression en masse)
- Dashboard avec graphiques
- Suivi heritage/patrimoine

## Instructions générales
- Next.js + Node.js avec MySQL/MariaDB
- Catégories, thèmes, enveloppes évolutifs (non codés en dur)
- Stockage sur GitHub (numanos/suivi-comptes)
- Déploiement sur VM Proxmox (Linux)
- Test avec Sample datas.csv avant push GitHub
- Mapping des colonnes :
  - Date → date
  - Libellé → libellé
  - Note personnelle → note
  - Montant → montant
  - Catégorie → catégorie
  - Sous-catégorie → sous-catégorie
  - Solde → solde

## Découvertes importantes
- Le fichier CSV est encodé en ISO-8859 (pas UTF-8), causant des problèmes comme "ý" au lieu de "é"
- Le CSV a une structure complexe avec plusieurs colonnes de date
- Problèmes courants :
  1. L'encodage n'est pas converti correctement
  2. Fausse détection de doublons
  3. Catégories ne correspondant pas malgré les problèmes d'encodage
- La détection de doublons doit vérifier : date + libellé EXACT + montant
- Les doublons dans le fichier CSV (mêmes date+libellé+montant) ne sont pas necessarily des erreurs - ce sont souvent des vrais paiements effectués 2 fois le même jour

## Structure du projet

```
suivi-comptes/
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── budget/page.tsx      # Page budget avec import CSV
│   │   │   ├── admin/page.tsx       # Page admin pour purger les données
│   │   │   ├── patrimoine/          # Pages patrimoine
│   │   │   └── layout.tsx
│   │   ├── api/
│   │   │   ├── transactions/route.ts # Import/GET/PUT/DELETE transactions
│   │   │   ├── categories/          # API catégories
│   │   │   ├── subcategories/       # API sous-catégories
│   │   │   ├── themes/              # API thèmes
│   │   │   └── envelopes/           # API enveloppes
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── lib/
│       ├── db.ts                    # Connexion MySQL
│       └── db-init.ts               # Initialisation base de données
├── .env.local                       # Variables d'environnement
├── package.json
└── CONTEXT.md                      # Ce fichier
```

## Schéma de base de données

```sql
-- Tables principales
users (id, email, name, created_at)
themes (id, name, type, created_at)
categories (id, name, theme_id, created_at)
subcategories (id, name, category_id, created_at)
transactions (id, date, libelle, note, amount, category_id, subcategory_id, balance, is_pointed, tags, import_batch_id, created_at)
import_batches (id, filename, record_count, created_at)
envelopes (id, name, amount, category_id, year, month, created_at)
placements (id, name, amount, type, date, created_at)
```

## Historique Git complet

```bash
25b46a9 Initial commit - suivi-comptes app
5e62310 Fix import CSV, add admin page, edit categories
42b89cd Add edit/delete/bulk delete for transactions
72c0161 Fix import function was missing
5c80e78 Fix import - correct column mapping and encoding handling
8816843 Fix duplicate detection - case insensitive
e91c1bc Fix import - handle encoding and empty libelle
b2cb3e0 Fix import - position-based column parsing, handle encoding
e44fc74 Fix column mapping - exact match and better logging
a976fa2 Fix import - full encoding fix, better category matching
3303649 Fix syntax error in encoding conversion
30235d1 Fix import - proper category matching, exact duplicate check, no encoding conversion
e5652f0 Fix CSV encoding and duplicate detection
4b21d13 Fix: read CSV as ISO-8859-1
d7767e0 Add conversation context file
39a198d Update context with full history and structure
a21852f Add debug logging for duplicate detection
207ceb3 Fix duplicate detection: add TRIM and progress logging
c426378 Log only duplicates detected
09dcb63 Add node_modules to gitignore
acbc6aa Add duplicate confirmation modal for CSV import
c5698c0 Add debug logging for dryRun
5a5b6b9 Fix: re-add duplicate rows when user chooses to import all
```

## Problèmes et corrections effectuées

### 1. Import CSV - Problèmes d'encodage
- **Problème:** Le fichier CSV est encodé en ISO-8859-1, les caractères accentués apparaissent comme "ý" au lieu de "é"
- **Solution:** Utiliser `TextDecoder('iso-8859-1')` pour lire le fichier

### 2. Détection de doublons
- **Problème:** Les doublons étaient détectés faussement à cause de différences de casse
- **Solution:** Vérification exacte sur date + libellé + montant + TRIM()

### 3. Correspondance des catégories
- **Problème:** Les catégories du CSV ne correspondait pas à celles en base
- **Solution:** Normalisation des noms pour la comparaison + création automatique des catégories manquantes

### 4. Fonction transactionExists manquante
- **Problème:** La fonction était appelée mais non définie
- **Solution:** Ajout de la fonction dans route.ts

### 5. Confirmation de doublons dans le fichier CSV
- **Problème:** Des paiements différents mais avec même libellé et montant étaient détectés comme doublons
- **Solution:** Ajout d'une fenêtre de confirmation qui affiche les doublons détectés et laisse le choix à l'utilisateur d'importer ou non

## Fonctionnalités implémentées

### Import CSV
- Lecture du fichier en ISO-8859-1
- Dry-run pour détecter les doublons dans le fichier
- Fenêtre de confirmation avec liste des doublons
- Trois options :
  1. Importer en ignorant les doublons (lignes uniques uniquement)
  2. Importer quand même (toutes les lignes)
  3. Annuler

### Gestion des transactions
- Liste avec filtres par année/mois
- Édition (libellé, note, catégorie, sous-catégorie)
- Suppression simple et suppression en masse
- Selection multiple avec case à cocher

## Fichiers clés modifiés récemment

### `/src/app/api/transactions/route.ts`
Fonctions principales :
- `normalizeForMatch()` - Normalise pour comparaison
- `findOrCreateCategory()` - Trouve ou crée une catégorie
- `findOrCreateSubcategory()` - Trouve ou crée une sous-catégorie
- `guessTheme()` - Devine le thème d'une catégorie
- `fixEncoding()` - Convertit ISO-8859-1 vers UTF-8
- `parseCSVLine()` - Parse une ligne CSV
- `transactionExists()` - Vérifie si une transaction existe déjà en base

Route POST : Import CSV
- Mode dryRun : retourne les infos de doublons sans importer
- Mode normal : importe avec option skipDuplicates
- Parse toutes les lignes pour détecter les doublons dans le fichier

### `/src/app/(dashboard)/budget/page.tsx`
- Import CSV avec fenêtre de confirmation de doublons
- Liste des transactions avec filtres
- Édition et suppression

## Commandes utiles

```bash
# Pull les derniers changements
git pull

# Lancer le serveur de développement
npm run dev

# Tester l'import avec le fichier CSV
# Aller sur http://localhost:3000/budget

# Builder pour production
npm run build

# Lancer en production
npm start
```

## Environment (.env.local)
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=***
DB_NAME=suivi_comptes
```

## État actuel (2026-02-18)
- Import CSV fonctionnel avec encodage ISO-8859-1
- Fenêtre de confirmation pour les doublons du fichier
- Débogage activé (logs dans la console serveur)
- Purger les transactions avant de tester pour éviter les doublons en base
