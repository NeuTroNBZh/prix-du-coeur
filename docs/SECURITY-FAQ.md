# 🔐 Sécurité du Chiffrement - Questions & Réponses

## ❓ Question 1 : Si quelqu'un vole la base de données, peut-il déchiffrer les labels ?

### Réponse courte : **NON**, mais avec des nuances importantes

### Scénario de vol de base de données seule

Si un attaquant réussit à extraire **uniquement** la base de données PostgreSQL :

```
❌ Il ne peut PAS déchiffrer les données car :
   - La clé de chiffrement n'est PAS stockée dans la base de données
   - La clé est dans le fichier .env du backend
   - Sans la clé, les données sont cryptographiquement sécurisées
   - AES-256-GCM est considéré comme inviolable sans la clé
```

**Ce que l'attaquant voit** :
```
label: "TmtqREU7vBDQUNUSllTJ+g==:4gyUBpdeWasLj7F9X5c/Fw==:MCOe6bgwgR..."
```
→ Impossible à déchiffrer sans la clé de 256 bits

### ⚠️ Mais attention : Scénario de vol complet

Si l'attaquant vole **À LA FOIS** :
- ✅ La base de données PostgreSQL
- ✅ Le serveur backend (avec le fichier .env)

```
❌ Alors OUI, il peut déchiffrer TOUTES les données
   - Il a la clé dans /var/www/html/prix-du-coeur/backend/.env
   - Il peut utiliser le même code encryptionService.js
   - Toutes les protections tombent
```

---

## ❓ Question 2 : Comment nous, on peut déchiffrer les labels ?

### Architecture du chiffrement symétrique

```
┌─────────────────────────────────────────────────────┐
│  BASE DE DONNÉES                                    │
│  ┌──────────────────────────────────────┐          │
│  │ Label chiffré:                       │          │
│  │ "iv:authTag:encryptedData"           │          │
│  └──────────────────────────────────────┘          │
└─────────────────────────────────────────────────────┘
                    ↓
                    ↓ Lecture par le backend
                    ↓
┌─────────────────────────────────────────────────────┐
│  BACKEND (Node.js)                                  │
│  ┌──────────────────────────────────────┐          │
│  │ .env file:                           │          │
│  │ ENCRYPTION_KEY=<votre_cle_ici>       │ ← CLÉ   │
│  └──────────────────────────────────────┘          │
│                   ↓                                 │
│  ┌──────────────────────────────────────┐          │
│  │ encryptionService.js                 │          │
│  │ - Lit la clé de .env                 │          │
│  │ - Utilise crypto.createDecipheriv()  │          │
│  │ - Déchiffre avec AES-256-GCM         │          │
│  └──────────────────────────────────────┘          │
│                   ↓                                 │
│  ┌──────────────────────────────────────┐          │
│  │ Label déchiffré:                     │          │
│  │ "CB SEPHORA 114 BREST"               │          │
│  └──────────────────────────────────────┘          │
└─────────────────────────────────────────────────────┘
                    ↓
                    ↓ Envoi JSON au frontend
                    ↓
┌─────────────────────────────────────────────────────┐
│  FRONTEND (React)                                   │
│  Affiche: "CB SEPHORA 114 BREST"                    │
└─────────────────────────────────────────────────────┘
```

### Pourquoi ça fonctionne ?

1. **Chiffrement symétrique** : Même clé pour chiffrer ET déchiffrer
2. **Clé accessible au backend** : Stockée dans `.env`
3. **Déchiffrement à la volée** : Fait automatiquement avant d'envoyer au frontend
4. **Frontend ne voit jamais les données chiffrées** : Il reçoit du texte clair

### Le code en détail

```javascript
// Dans encryptionService.js
function decrypt(encryptedText) {
  const [ivBase64, authTagBase64, encrypted] = encryptedText.split(':');
  
  const key = getEncryptionKey();  // ← Lit ENCRYPTION_KEY depuis .env
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;  // ← Retourne le texte en clair
}
```

---

## 🛡️ Question 3 : Comment mieux sécuriser ?

### Niveau actuel de sécurité : ⭐⭐⭐☆☆ (Bon, mais améliorable)

#### ✅ Ce qui est déjà bien protégé

1. **Chiffrement fort** : AES-256-GCM (standard militaire)
2. **Données illisibles en BDD** : Protection contre SQL injection + dump DB
3. **Intégrité garantie** : Le tag GCM empêche la modification des données
4. **Pas de clé en dur dans le code** : Utilise .env

#### ❌ Faiblesses actuelles

| Faiblesse | Impact | Probabilité |
|-----------|--------|-------------|
| Clé dans .env sur le serveur | Si accès serveur → tout déchiffré | Moyenne |
| Pas de rotation de clé | Vieille clé = plus de risques | Faible |
| Logs pourraient contenir du clair | Fuite de données via logs | Faible |
| Pas d'audit trail | Qui a accédé à quoi ? | Moyenne |

---

## 🚀 Recommandations d'amélioration (par priorité)

### 🔴 PRIORITÉ HAUTE (À faire rapidement)

#### 1. Utiliser un gestionnaire de secrets externe

**Actuellement** :
```bash
# .env
# Générez avec: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=votre_cle_64_caracteres_hex_generee
```

**Recommandé** :
```javascript
// Utiliser AWS Secrets Manager, HashiCorp Vault, ou Azure Key Vault
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

async function getEncryptionKey() {
  const secret = await secretsManager.getSecretValue({
    SecretId: 'prix-du-coeur/encryption-key'
  }).promise();
  
  return JSON.parse(secret.SecretString).key;
}
```

**Avantages** :
- La clé n'est JAMAIS stockée sur le serveur
- Rotation automatique possible
- Audit complet des accès
- Permissions granulaires (IAM)

**Coût** : ~1€/mois sur AWS Secrets Manager

#### 2. Chiffrement des sauvegardes de base de données

```bash
# Actuel : Sauvegardes en clair
pg_dump prix_du_coeur > backup.sql

# Recommandé : Chiffrer les sauvegardes
pg_dump prix_du_coeur | gpg --encrypt --recipient admin@prix-du-coeur.fr > backup.sql.gpg
```

#### 3. Permissions strictes sur .env

```bash
# Actuellement
-rw-rw-r-- 1 debian debian .env  # ← Lisible par le groupe !

# Recommandé
chmod 600 /var/www/html/prix-du-coeur/backend/.env
chown debian:debian /var/www/html/prix-du-coeur/backend/.env
```

### 🟡 PRIORITÉ MOYENNE (À planifier)

#### 4. Rotation régulière de la clé

Créer un mécanisme pour re-chiffrer toutes les données avec une nouvelle clé :

```javascript
// rotate-encryption-key.js
async function rotateKey(oldKey, newKey) {
  const transactions = await pool.query('SELECT id, label FROM transactions');
  
  for (const tx of transactions.rows) {
    const decrypted = decrypt(tx.label, oldKey);  // Ancienne clé
    const encrypted = encrypt(decrypted, newKey);  // Nouvelle clé
    
    await pool.query(
      'UPDATE transactions SET label = $1 WHERE id = $2',
      [encrypted, tx.id]
    );
  }
}
```

**Fréquence recommandée** : Tous les 6-12 mois

#### 5. Audit logging

Logger tous les accès aux données sensibles :

```javascript
async function decryptWithAudit(encryptedLabel, userId, reason) {
  // Log l'accès
  await pool.query(
    `INSERT INTO security_audit_log 
     (user_id, action, timestamp, reason) 
     VALUES ($1, 'DECRYPT_LABEL', NOW(), $2)`,
    [userId, reason]
  );
  
  return decrypt(encryptedLabel);
}
```

#### 6. Chiffrement en transit (HTTPS uniquement)

```nginx
# Forcer HTTPS partout
server {
    listen 80;
    server_name prixducoeur.fr;
    return 301 https://$server_name$request_uri;
}
```

### 🟢 PRIORITÉ BASSE (Nice to have)

#### 7. Chiffrement côté client (End-to-End)

Le chiffrement se ferait DANS le navigateur, avant même d'envoyer au backend :

```javascript
// Dans le frontend React
import CryptoJS from 'crypto-js';

// L'utilisateur a une clé personnelle dérivée de son mot de passe
const userKey = await deriveKeyFromPassword(userPassword);

// Chiffrer AVANT d'envoyer au backend
const encrypted = CryptoJS.AES.encrypt(label, userKey).toString();

// Le backend stocke sans pouvoir déchiffrer
await api.post('/transactions', { label: encrypted });
```

**Avantages** :
- Même le backend ne peut pas lire les données
- Protection maximale (Zero-Knowledge)

**Inconvénients** :
- Plus complexe à implémenter
- Impossible de faire des requêtes SQL sur les labels
- Si l'utilisateur perd son mot de passe → données perdues à jamais

#### 8. Hardware Security Module (HSM)

Pour les environnements ultra-sécurisés :

```
┌─────────────────┐
│   HSM Device    │  ← Clé ne peut JAMAIS être extraite
│   (YubiKey,     │  ← Chiffrement fait dans le hardware
│    AWS CloudHSM)│  ← Coût: 1000€+/mois
└─────────────────┘
```

---

## 📊 Comparaison des niveaux de sécurité

| Niveau | Protection | Coût | Complexité | Recommandé pour |
|--------|-----------|------|------------|----------------|
| **Actuel** (AES-256 + .env) | ⭐⭐⭐☆☆ | Gratuit | Faible | Petits projets |
| **+ Secrets Manager** | ⭐⭐⭐⭐☆ | 1€/mois | Moyenne | Production |
| **+ Rotation + Audit** | ⭐⭐⭐⭐⭐ | 5€/mois | Moyenne | Données sensibles |
| **+ E2E Client-side** | ⭐⭐⭐⭐⭐ | 10€/mois | Élevée | Banking/Santé |
| **+ HSM** | ⭐⭐⭐⭐⭐ | 1000€+/mois | Très élevée | Militaire/Finance |

---

## 🎯 Plan d'action recommandé pour Prix du Cœur

### Phase 1 (Immédiat - 1 jour)
- [x] Chiffrement AES-256-GCM implémenté ✅
- [ ] Corriger permissions .env (chmod 600)
- [ ] Activer HTTPS strict
- [ ] Chiffrer les backups DB

### Phase 2 (Court terme - 1 semaine)
- [ ] Migrer vers AWS Secrets Manager ou équivalent
- [ ] Implémenter audit logging basique
- [ ] Tester la rotation de clé sur environnement de test

### Phase 3 (Moyen terme - 1 mois)
- [ ] Rotation automatique de clé tous les 6 mois
- [ ] Monitoring des accès suspects
- [ ] Documentation sécurité complète

### Phase 4 (Long terme - optionnel)
- [ ] Évaluer le besoin de E2E encryption
- [ ] Penetration testing externe
- [ ] Certification de sécurité

---

## 💡 Conclusion

**Ton système actuel est déjà bien sécurisé** pour une application de gestion de finances personnelles :

✅ **Protections en place** :
- Données chiffrées en base
- Impossible de lire sans la clé
- Standard cryptographique militaire

⚠️ **Point d'attention principal** :
- Si quelqu'un accède au serveur ET à .env → game over
- Solution : Secrets Manager externe

🎯 **Recommandation prioritaire** :
1. Corriger les permissions .env → 5 minutes
2. Migrer vers Secrets Manager → 2 heures
3. Chiffrer les backups → 1 heure

Avec ces 3 actions, tu passes de ⭐⭐⭐ à ⭐⭐⭐⭐⭐ en sécurité ! 🔐
