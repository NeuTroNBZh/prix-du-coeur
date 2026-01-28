# 💖 Prix du Cœur

Application web de gestion des dépenses partagées pour couples. Harmonisez vos finances facilement !

## 📋 Fonctionnalités

- 🔐 **Authentification sécurisée** : Inscription/Connexion avec JWT + 2FA optionnel (TOTP)
- 💑 **Gestion de couple** : Liez-vous à votre partenaire avec un code de couple
- 💳 **Multi-comptes** : Gérez plusieurs comptes bancaires (Crédit Agricole, Revolut, CMB, etc.)
- 📊 **Import CSV/PDF** : Importez automatiquement vos relevés bancaires
- 🤖 **Classification IA** : Catégorisation intelligente des transactions avec Mistral AI
- 💰 **Harmonisation** : Calculez automatiquement qui doit quoi
- 📈 **Analytics** : Visualisez vos dépenses par catégorie, évolution temporelle
- 🔄 **Abonnements** : Détection automatique des abonnements récurrents
- 🎯 **Dépenses partagées** : Définissez des ratios personnalisés (50/50, 70/30, etc.)
- 🌙 **Dark mode** : Interface moderne et responsive

## 🛠️ Technologies

### Frontend
- **React 19** avec React Router
- **Vite** pour le build
- **TailwindCSS** pour le style
- **Recharts** pour les graphiques
- **Heroicons** pour les icônes

### Backend
- **Node.js** + **Express**
- **PostgreSQL** pour la base de données
- **JWT** pour l'authentification
- **Mistral AI** pour la classification intelligente
- **Multer** pour l'upload de fichiers
- **pdf-parse** pour parser les PDFs
- **csv-parser** pour parser les CSV

## 📦 Prérequis

- **Node.js** >= 18.x
- **PostgreSQL** >= 14.x
- **npm** ou **yarn**
- Un compte **Mistral AI** (gratuit) pour la classification automatique

## 🚀 Installation

### 1. Cloner le projet

```bash
git clone https://github.com/votre-username/prix-du-coeur.git
cd prix-du-coeur
```

### 2. Configuration de la base de données

```bash
# Se connecter à PostgreSQL
sudo -u postgres psql

# Créer la base de données et l'utilisateur
CREATE DATABASE prix_du_coeur;
CREATE USER prix_user WITH PASSWORD 'VotreMotDePasse';
GRANT ALL PRIVILEGES ON DATABASE prix_du_coeur TO prix_user;

# Se connecter à la base
\c prix_du_coeur

# Donner les permissions sur le schéma public
GRANT ALL ON SCHEMA public TO prix_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO prix_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO prix_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO prix_user;

\q
```

### 3. Créer les tables

```bash
# Exécuter le script SQL
psql -U prix_user -d prix_du_coeur -f database/schema.sql
```

### 4. Configuration Backend

```bash
cd backend

# Installer les dépendances
npm install

# Créer le fichier .env
cp .env.example .env
```

**Éditez `backend/.env` avec vos informations :**

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
DB_PASSWORD=VotreMotDePasse

# JWT Auth - CHANGEZ CES VALEURS !
JWT_SECRET=votre_secret_jwt_super_long_et_complexe_minimum_32_caracteres
JWT_EXPIRES_IN=7d

# Mistral IA - Obtenez votre clé sur https://console.mistral.ai/
MISTRAL_API_KEY=votre_cle_mistral_api
MISTRAL_MODEL=mistral-small-latest

# Encryption - CHANGEZ CETTE VALEUR !
ENCRYPTION_KEY=votre_cle_chiffrement_exactement_32_caracteres_ici

# Logs
LOG_LEVEL=info
LOG_RETENTION_DAYS=90

# CORS - Ajoutez vos domaines
CORS_ORIGIN=http://localhost:5173

# Email SMTP (optionnel - pour la récupération de mot de passe)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre.email@gmail.com
SMTP_PASSWORD=votre_mot_de_passe_application
SMTP_FROM=Prix du Coeur <noreply@example.com>
```

### 5. Configuration Frontend

```bash
cd ../frontend

# Installer les dépendances
npm install

# Créer le fichier .env
cat > .env << EOF
VITE_API_URL=http://localhost:3002
EOF
```

**Pour la production, éditez `frontend/.env` :**

```bash
VITE_API_URL=https://votre-domaine.com
```

## 🎯 Démarrage

### Mode développement

**Terminal 1 - Backend :**
```bash
cd backend
npm run dev
# Le serveur démarre sur http://localhost:3002
```

**Terminal 2 - Frontend :**
```bash
cd frontend
npm run dev
# L'application démarre sur http://localhost:5173
```

### Mode production

**Backend :**
```bash
cd backend
npm start
```

**Frontend :**
```bash
cd frontend
npm run build
# Les fichiers sont dans frontend/dist/
```

Servez le dossier `dist/` avec nginx, Apache, ou un serveur statique.

## 🔧 Configuration avancée

### Générer des clés sécurisées

```bash
# JWT Secret (32+ caractères)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Encryption Key (32 caractères exactement)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Obtenir une clé API Mistral

1. Créez un compte sur https://console.mistral.ai/
2. Allez dans "API Keys"
3. Créez une nouvelle clé
4. Copiez-la dans `MISTRAL_API_KEY`

### Configuration SMTP (Gmail)

1. Activez la validation en 2 étapes sur votre compte Google
2. Allez dans "Sécurité" > "Mots de passe des applications"
3. Créez un mot de passe pour "Autre (nom personnalisé)"
4. Utilisez ce mot de passe dans `SMTP_PASSWORD`

## 📁 Structure du projet

```
prix-du-coeur/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Logique métier
│   │   ├── middleware/      # Auth, validation
│   │   ├── routes/          # Routes API
│   │   ├── services/        # Services (calculs, IA)
│   │   ├── utils/           # Utilitaires (parsers CSV/PDF)
│   │   └── index.js         # Point d'entrée
│   ├── logs/                # Logs de l'application
│   ├── .env                 # Configuration (NE PAS COMMITER)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Composants React
│   │   ├── pages/           # Pages principales
│   │   ├── services/        # API client
│   │   └── utils/           # Helpers
│   ├── .env                 # Configuration (NE PAS COMMITER)
│   └── package.json
├── database/
│   └── schema.sql           # Schéma de la base de données
└── README.md
```

## 🔒 Sécurité

### ⚠️ Fichiers à NE JAMAIS commiter

Ajoutez ces lignes à votre `.gitignore` :

```
# Environment variables
backend/.env
frontend/.env

# Logs
backend/logs/*.log

# Dependencies
node_modules/
**/node_modules/

# Build
frontend/dist/
frontend/build/

# Database
*.sql.backup
```

### ✅ Checklist avant de partager

- [ ] Supprimer toutes les clés API réelles du code
- [ ] Créer des fichiers `.env.example` avec des valeurs d'exemple
- [ ] Vérifier que `.gitignore` exclut les fichiers sensibles
- [ ] Remplacer les URLs de production par localhost
- [ ] Documenter toutes les étapes d'installation
- [ ] Tester l'installation complète sur une machine vierge

## 📝 Utilisation

### Premier lancement

1. Créez un compte utilisateur
2. Créez ou rejoignez un couple avec le code partagé
3. Créez votre premier compte bancaire
4. Importez vos transactions (CSV ou PDF)
5. Profitez de l'harmonisation automatique !

### Import de transactions

**Formats supportés :**
- CSV Crédit Agricole
- CSV Revolut
- CSV CMB (Crédit Mutuel de Bretagne)
- PDF de relevés bancaires

**Instructions :**
1. Allez dans "Importer CSV"
2. Sélectionnez votre fichier
3. Le parser détecte automatiquement le format
4. Les transactions sont catégorisées par IA
5. Vérifiez et corrigez si nécessaire

## 🤝 Contribution

Les contributions sont les bienvenues !

1. Forkez le projet
2. Créez une branche (`git checkout -b feature/amelioration`)
3. Committez (`git commit -m 'Ajout fonctionnalité'`)
4. Pushez (`git push origin feature/amelioration`)
5. Ouvrez une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 🆘 Support

Pour toute question ou problème :
- Ouvrez une issue sur GitHub
- Consultez la documentation dans `/docs`

## 🎉 Remerciements

- [Mistral AI](https://mistral.ai/) pour la classification intelligente
- [Recharts](https://recharts.org/) pour les graphiques
- [Heroicons](https://heroicons.com/) pour les icônes
- La communauté open source

---

Fait avec 💖 par [Votre Nom]
