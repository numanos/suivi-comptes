# Suivi Comptes - Application de gestion budget et patrimoine

## Prérequis

- Node.js 18+
- MySQL ou MariaDB
- npm ou yarn

## Installation

1. **Cloner le projet** sur votre VM Proxmox :
   ```bash
   git clone <votre-repo-github> suivi-comptes
   cd suivi-comptes
   ```

2. **Installer les dépendances** :
   ```bash
   npm install
   ```

3. **Configurer les variables d'environnement** :
   ```bash
   cp .env.example .env
   # Modifier .env avec vos paramètres MySQL
   ```

4. **Initialiser la base de données** :
   ```bash
   npm run db:init
   ```
   Cela crée les tables et insère les données par défaut (thèmes, catégories, utilisateur admin).

5. **Démarrer le serveur** :
   ```bash
   npm run dev
   ```

## Identifiants par défaut

- Email : `admin@local`
- Le premier mot de passe est défini par `ADMIN_INITIAL_PASSWORD` lors de l'initialisation.
- Après connexion, modifier le mot de passe depuis la page Admin.

## Fonctionnalités

### Budget
- Import de fichiers CSV bancaires
- Catégories hiérarchiques (thèmes > catégories > sous-catégories)
- Graphiques mensuels et annuels
- Récap annuel dynamique (YTD)

### Patrimoine
- Gestion des enveloppes (Actions, Immobilier, Obligations, Liquidités)
- Suivi des placements par année
- Tableau d'évolution annuel
- Graphiques de répartition
- Relevés d'enveloppe à date libre, conservés dans l'historique
- Gain global calculé par enveloppe: valorisation totale moins versements nets cumulés

## Structure du projet

```
suivi-comptes/
├── src/
│   ├── app/              # Pages Next.js (App Router)
│   │   ├── api/         # Routes API
│   │   └── (dashboard)/ # Pages authentifiées
│   ├── components/      # Composants React
│   ├── lib/            # Utilitaires (DB, init)
│   ├── styles/         # CSS global
│   └── types/          # Types TypeScript
├── package.json
├── tsconfig.json
└── next.config.js
```

## Déploiement production

1. Builder l'application :
   ```bash
   npm run build
   ```

2. Démarrer en production :
   ```bash
   npm start
   ```

3. Configuration serveur (Nginx) à ajouter pour proxifier vers le port 3000.
