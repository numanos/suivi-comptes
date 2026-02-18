# Projet Suivi Comptes - Contexte de conversation

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

## Fichiers importants
- `/mnt/c/Users/antie/Desktop/Projet suivi comptes/suivi-comptes/src/app/api/transactions/route.ts` - Fichier principal pour l'import CSV
- `/mnt/c/Users/antie/Desktop/Projet suivi comptes/suivi-comptes/src/app/(dashboard)/budget/page.tsx` - Page budget avec UI d'import
- `/mnt/c/Users/antie/Desktop/Projet suivi comptes/suivi-comptes/src/app/(dashboard)/admin/page.tsx` - Page admin purge
- `/mnt/c/Users/antie/Desktop/Projet suivi comptes/suivi-comptes/` - Répertoire principal du projet
- `/mnt/c/Users/antie/Desktop/Projet suivi comptes/Sample datas.csv` - Fichier CSV de test

## Échanges / Actions réalisées

### 2026-02-18

**Question initiale :** Qu'avons-nous fait jusqu'à présent ?
**Réponse :** Résumé complet des accomplishments et next steps.

**Action 1 :** Lecture du fichier route.ts pour continuer le travail
- Le fichier contenait déjà une fonction `fixEncoding()` mais elle n'était pas utilisée
- La fonction `transactionExists()` était appelée mais non définie

**Action 2 :** Corrections apportées à `/src/app/api/transactions/route.ts` :
1. Ajout de la fonction `transactionExists()` pour détection de doublons exacts
2. Application de `fixEncoding()` aux champs parsés du CSV (libelle, note, category, subcategory)
3. Application de `fixEncoding()` aux catégories/sous-catégories stockées dans les lookup maps

**Action 3 :** Commit et push vers GitHub
- Commit: "Fix CSV encoding and duplicate detection"

**Feedback utilisateur :** "il y a toujours les soucis d'encodage - des doublons sont toujours détectés"

**Action 4 :** Problème identifié - `file.text()` décode le fichier en UTF-8 directement, donc les octets ISO-8859-1 ne sont plus disponibles

**Action 5 :** Correction de la lecture du fichier
- Remplacé `let text = await file.text();` par :
  ```typescript
  const buffer = await file.arrayBuffer();
  const decoder = new TextDecoder('iso-8859-1');
  let text = decoder.decode(buffer);
  ```

**Action 6 :** Commit et push
- Commit: "Fix: read CSV as ISO-8859-1"
- Push vers numanos/suivi-comptes

## Prochaines étapes
1. L'utilisateur doit pull les changements et tester l'import
2. Vérifier que l'encodage est maintenant correct
3. Vérifier que les doublons ne sont plus faussement détectés

## Commandes utiles
```bash
# Pull les derniers changements
git pull

# Lancer le serveur de développement
npm run dev

# Tester l'import avec le fichier CSV
# Aller sur http://localhost:3000/budget
```
