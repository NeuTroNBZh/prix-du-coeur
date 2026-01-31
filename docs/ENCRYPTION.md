# 🔐 Chiffrement des Transactions

## Vue d'ensemble

Les labels des transactions sont maintenant **chiffrés de bout en bout** dans la base de données. Cette solution offre une sécurité maximale tout en étant complètement transparente pour les utilisateurs.

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Frontend      │ ←──→ │   Backend API    │ ←──→ │   PostgreSQL    │
│  (texte clair)  │      │ (chiffre/        │      │ (données        │
│                 │      │  déchiffre)      │      │  chiffrées)     │
└─────────────────┘      └──────────────────┘      └─────────────────┘
```

## Détails techniques

### Algorithme de chiffrement

- **Algorithme** : AES-256-GCM (chiffrement authentifié)
- **Taille clé** : 256 bits (32 bytes)
- **IV** : 128 bits aléatoire par chiffrement
- **Auth Tag** : 128 bits pour l'intégrité

### Format stocké

Les données chiffrées sont stockées au format :
```
{IV base64}:{AuthTag base64}:{Données chiffrées base64}
```

Exemple :
```
TmtqREU7vBDQUNUSllTJ+g==:4gyUBpdeWasLj7F9X5c/Fw==:MCOe6bgwgR...
```

### Champs chiffrés

| Table | Champ | Chiffré | Hash |
|-------|-------|---------|------|
| transactions | label | ✅ Oui | ✅ label_hash |
| ai_learning | label | ✅ Oui | ❌ |

### Label Hash

Pour permettre les opérations SQL sur les labels (GROUP BY, comparaisons), un hash HMAC-SHA256 est stocké dans `label_hash`. Ce hash est :
- **Déterministe** : même label = même hash
- **Non-réversible** : impossible de retrouver le label depuis le hash
- **Sécurisé** : utilise une clé dérivée pour éviter les rainbow tables

## Configuration

### Clé de chiffrement

La clé est configurée dans le fichier `.env` du backend :

```env
# ATTENTION : NE JAMAIS CHANGER APRÈS LE PREMIER CHIFFREMENT !
# Générez avec: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=votre_cle_64_caracteres_hex_generee_ici
```

⚠️ **CRITIQUE** : Si vous changez cette clé, toutes les données existantes deviendront illisibles !

### Générer une nouvelle clé

Pour un nouveau déploiement, générez une clé sécurisée :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Migration

### Nouvelles installations

Aucune action requise. Les données sont automatiquement chiffrées à l'insertion.

### Migration des données existantes

```bash
# 1. Exécuter la migration SQL
sudo -u postgres psql -d prix_du_coeur -f database/migrations/007_add_label_hash.sql

# 2. Exécuter le script de migration
cd backend && node migrate-encrypt-transactions.js
```

## Service de chiffrement

Le service est situé dans `backend/src/services/encryptionService.js` et expose :

```javascript
const {
  encrypt,           // Chiffre une chaîne
  decrypt,           // Déchiffre une chaîne
  encryptTransaction,   // Chiffre les champs d'une transaction
  decryptTransaction,   // Déchiffre les champs d'une transaction
  decryptTransactions,  // Déchiffre un tableau de transactions
  isEncrypted,       // Vérifie si une valeur est chiffrée
  hashLabel,         // Génère le hash d'un label
} = require('./services/encryptionService');
```

## Sécurité

### Points forts

1. **Chiffrement fort** : AES-256-GCM est considéré comme inviolable
2. **Authentification** : Le tag GCM garantit l'intégrité des données
3. **IV unique** : Chaque chiffrement utilise un IV aléatoire différent
4. **Transparence** : L'utilisateur ne voit aucune différence

### Recommandations

1. **Sauvegarder la clé** : Stockez la clé de chiffrement dans un coffre-fort sécurisé
2. **Rotation de clé** : Prévoir un mécanisme de rotation (re-chiffrement avec nouvelle clé)
3. **Accès limité** : Seul le backend doit avoir accès à la clé
4. **Logs** : Ne jamais logger les données déchiffrées en production

## Dépannage

### Les données ne s'affichent plus

Vérifiez que :
1. La clé `ENCRYPTION_KEY` n'a pas été modifiée
2. Le backend a bien été redémarré après les modifications

### Performances

Le chiffrement/déchiffrement ajoute un léger overhead (~1ms par transaction). Pour les grandes listes, le déchiffrement est fait en batch.

### Données partiellement chiffrées

Si certaines données sont en clair et d'autres chiffrées, le service détecte automatiquement le format et traite chaque cas correctement.
