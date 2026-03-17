# 💖 Prix du Cœur

> Application web de gestion financière pour couples et célibataires — Harmonisez vos finances facilement !

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)

---

## 📋 À propos

**Prix du Cœur** est une application web moderne qui automatise le suivi des dépenses partagées pour les couples, tout en offrant un tableau de bord personnel complet pour les utilisateurs célibataires.

### ✨ Proposition de valeur

| Avant | Après |
|-------|-------|
| ⏱️ 30 minutes de rapprochement mensuel | ⚡ 5 minutes maximum |
| 📊 Excel manuel et fastidieux | 🤖 Classification automatique par IA |
| ❓ "Qui doit combien ?" - calculs manuels | 💰 Calcul en temps réel |
| 📄 Import manuel des relevés | 📥 Import automatique CSV/PDF |

---

## 🚀 Fonctionnalités

### 🔐 Authentification & Sécurité
- **JWT** avec expiration configurable
- **2FA** (TOTP via Google Authenticator / Authy ou par email)
- **Vérification email** obligatoire
- **Chiffrement AES-256-GCM** des données sensibles
- **Rate limiting** et protection DDoS

### 💳 Gestion Bancaire
- Import de relevés **CSV et PDF**
- Support multi-banques : Crédit Agricole, Revolut, CMB, CIC
- Détection automatique des doublons (checksum SHA-256)
- Gestion de **plusieurs comptes** par utilisateur

### 🤖 Classification IA (Mistral AI)
- Catégorisation automatique des transactions
- Apprentissage adaptatif basé sur les corrections utilisateur
- Types : Commune, Individuelle, Abonnement, Virement interne
- 13+ catégories : Courses, Restaurant, Transport, Loisirs, etc.

### ⚖️ Harmonisation (Couples)
- Calcul automatique "Qui doit combien ?"
- Ratios personnalisables (50/50, 70/30, etc.)
- Historique des règlements
- Précision 100% via Decimal.js

### 📊 Dashboard & Analytics
- Solde total des comptes
- Graphiques de répartition par catégorie
- Évolution mensuelle des dépenses
- Suivi des abonnements récurrents

### 🎨 Interface Moderne
- **Dark mode** natif (système/manuel)
- Design responsive (mobile-first)
- Interface inspirée Apple/Google

---

## 🛠️ Stack Technique

### Frontend
| Technologie | Usage |
|-------------|-------|
| **React 19** | Framework UI |
| **Vite** | Build tool |
| **TailwindCSS** | Styling |
| **React Router** | Navigation |
| **Recharts** | Graphiques |
| **Heroicons** | Icônes |

### Backend
| Technologie | Usage |
|-------------|-------|
| **Node.js 18+** | Runtime |
| **Express** | Framework API |
| **PostgreSQL 14+** | Base de données |
| **JWT** | Authentification |
| **Mistral AI** | Classification IA |
| **Helmet** | Sécurité HTTP |

### Sécurité
| Mesure | Implémentation |
|--------|----------------|
| Chiffrement données | AES-256-GCM |
| Hash mots de passe | bcrypt (10 rounds) |
| Protection API | Rate limiting |
| 2FA | TOTP (speakeasy) + Email |

---

## 📦 Prérequis

- **Node.js** >= 18.x
- **PostgreSQL** >= 14.x
- **npm** ou **yarn**
- Compte **Mistral AI** (gratuit) pour la classification IA

---

## 🚀 Installation

### 1. Cloner le projet

```bash
git clone https://github.com/NeuTroNBZh/prix-du-coeur.git
cd prix-du-coeur
```

### 2. Configuration de la base de données

```bash
# Se connecter à PostgreSQL
sudo -u postgres psql

# Créer la base de données et l'utilisateur
CREATE DATABASE prix_du_coeur;
CREATE USER prix_user WITH PASSWORD 'votre_mot_de_passe_securise';
GRANT ALL PRIVILEGES ON DATABASE prix_du_coeur TO prix_user;

# Se connecter à la base
\c prix_du_coeur

# Donner les permissions
GRANT ALL ON SCHEMA public TO prix_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO prix_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO prix_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO prix_user;

\q
```

### 3. Appliquer les migrations

```bash
# Exécuter le schéma initial
psql -U prix_user -d prix_du_coeur -f database/migrations/001_initial_schema.sql

# Appliquer les migrations suivantes dans l'ordre
for f in database/migrations/*.sql; do
  psql -U prix_user -d prix_du_coeur -f "$f"
done
```

### 4. Configuration Backend

```bash
cd backend
npm install

# Créer le fichier de configuration
cp .env.example .env
```

Éditez `backend/.env` avec vos informations :

```bash
# Server
NODE_ENV=development
PORT=3002
FRONTEND_URL=http://localhost:5173

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=prix_du_coeur
DB_USER=prix_user
DB_PASSWORD=votre_mot_de_passe_securise

# JWT (générer avec: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=votre_secret_jwt_genere
JWT_EXPIRES_IN=7d

# Mistral AI (obtenir sur: https://console.mistral.ai/)
MISTRAL_API_KEY=votre_cle_api_mistral
MISTRAL_MODEL=mistral-small-latest

# Encryption (générer avec: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=votre_cle_chiffrement_32_bytes_hex

# CORS
CORS_ORIGIN=http://localhost:5173

# Email SMTP (optionnel)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre.email@gmail.com
SMTP_PASSWORD=votre_mot_de_passe_application
SMTP_FROM=Prix du Coeur <noreply@votredomaine.com>
```

### 5. Configuration Frontend

```bash
cd frontend
npm install

# Créer le fichier de configuration
cp .env.example .env
```

Éditez `frontend/.env` :

```bash
VITE_API_URL=http://localhost:3002
```

### 6. Lancer l'application

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

L'application est accessible sur **http://localhost:5173**

---

## 🔧 Scripts disponibles

### Backend
```bash
npm run dev      # Démarrer en mode développement (nodemon)
npm start        # Démarrer en production
npm test         # Lancer les tests
```

### Frontend
```bash
npm run dev      # Démarrer le serveur de développement
npm run build    # Build de production
npm run preview  # Prévisualiser le build
npm run lint     # Vérifier le code
```

---

## 📁 Structure du projet

```
prix-du-coeur/
├── 📁 frontend/                # Application React SPA
│   └── src/
│       ├── components/         # Composants UI réutilisables
│       ├── contexts/           # Contextes (Auth, Theme)
│       ├── pages/              # Pages de l'application
│       ├── services/           # Communication API
│       └── utils/              # Fonctions utilitaires
│
├── 📁 backend/                 # API Express
│   └── src/
│       ├── controllers/        # Gestionnaires de requêtes
│       ├── middleware/         # Auth, Admin, etc.
│       ├── routes/             # Définitions des routes
│       ├── services/           # Logique métier (IA, Email, Chiffrement)
│       └── utils/
│           └── parsers/        # Parsers par banque (CA, Revolut, CMB, CIC)
│
├── 📁 database/
│   ├── migrations/             # Scripts SQL de migration
│   └── seeds/                  # Données initiales
│
├── 📁 config/                  # Configurations Nginx, fail2ban
│
└── 📁 docs/                    # Documentation technique
```

---

## 🔐 Sécurité

### Données chiffrées
Les libellés des transactions sont chiffrés avec **AES-256-GCM** avant stockage en base de données. La clé de chiffrement est stockée uniquement dans le fichier `.env` (jamais en base).

### Authentification
- Mots de passe hashés avec **bcrypt** (10 salt rounds)
- Tokens JWT avec expiration configurable
- Support 2FA (TOTP ou Email)
- Vérification email obligatoire

### Protection API
- Rate limiting global (100 req/min)
- Rate limiting strict pour les actions sensibles (10 req/min)
- Headers de sécurité via Helmet.js
- CORS configuré

### Fichiers sensibles
Les fichiers suivants ne doivent **JAMAIS** être commités :
- `backend/.env` - Clés API et d'encryption
- `frontend/.env` - Configuration locale
- `SECURITY-PRIVATE.md` - Rapport d'audit

Ces fichiers sont automatiquement exclus via `.gitignore`.

---

## 🏦 Banques supportées

| Banque | CSV | PDF |
|--------|-----|-----|
| Crédit Agricole | ✅ | ✅ |
| Revolut | ✅ | ❌ |
| Crédit Mutuel de Bretagne | ✅ | ✅ |
| CIC | ✅ | ❌ |
| Boursorama | 🔜 | 🔜 |

---

## 📖 Documentation

- [Guide de déploiement](DEPLOYMENT.md)
- [Guide de contribution](CONTRIBUTING.md)
- [Architecture de chiffrement](docs/ENCRYPTION.md)
- [Description complète](docs/DESCRIPTION-COMPLETE-SITE.md)

---

## 🤝 Contribution

Les contributions sont les bienvenues ! Consultez le [guide de contribution](CONTRIBUTING.md) pour commencer.

```bash
# Fork le projet
# Créer une branche
git checkout -b feature/ma-fonctionnalite

# Commit
git commit -m "feat: ajout de ma fonctionnalité"

# Push et créer une Pull Request
git push origin feature/ma-fonctionnalite
```

---

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

---

## 🙏 Remerciements

- [Mistral AI](https://mistral.ai/) pour l'API de classification
- [TailwindCSS](https://tailwindcss.com/) pour le framework CSS
- [Recharts](https://recharts.org/) pour les graphiques
- La communauté open source

---

<div align="center">

**Fait avec 💖 par NeuTroNBZh aidé par l'IA**

[Signaler un bug](https://github.com/NeuTroNBZh/prix-du-coeur/issues) · [Proposer une fonctionnalité](https://github.com/NeuTroNBZh/prix-du-coeur/issues)

</div>

## License
MIT

## Support
For support, contact us.

## Roadmap
- Feature 1
- Feature 2
