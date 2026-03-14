# 💖 Prix du Cœur (Price of Heart)

> Shared expense manager for couples and individuals — Easily harmonize your finances!

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)

---

## 📋 About

**Prix du Cœur** is a modern web application that automates shared expense tracking for couples, while providing a complete personal dashboard for single users.

### ✨ Value Proposition

| Before | After |
|--------|-------|
| ⏱️ 30 minutes monthly reconciliation | ⚡ 5 minutes max |
| 📊 Manual and tedious Excel | 🤖 Automatic AI classification |
| ❓ "Who owes what?" - manual calculations | 💰 Real-time calculation |
| 📄 Manual statement import | 📥 Automatic CSV/PDF import |

---

## 🚀 Features

### 🔐 Authentication & Security
- **JWT** with configurable expiration
- **2FA** (TOTP via Google Authenticator / Authy or email)
- **Mandatory email verification**
- **AES-256-GCM encryption** for sensitive data
- **Rate limiting** and DDoS protection

### 💳 Banking Management
- Import statements from **CSV and PDF**
- Multi-bank support: Crédit Agricole, Revolut, CMB, CIC
- Automatic duplicate detection (SHA-256 checksum)
- **Multiple accounts** per user

### 🤖 AI Classification (Mistral AI)
- Automatic transaction categorization
- Adaptive learning based on user corrections
- Types: Shared, Individual, Subscription, Internal transfer
- 13+ categories: Groceries, Restaurant, Transport, Entertainment, etc.

### ⚖️ Expense Harmonization (Couples)
- Automatic "Who owes what?" calculation
- Customizable ratios (50/50, 70/30, etc.)
- Settlement history
- 100% precision via Decimal.js

### 📊 Dashboard & Analytics
- Total account balance
- Category distribution charts
- Monthly expense evolution
- Recurring subscription tracking

### 🎨 Modern Interface
- **Dark mode** native (system/manual)
- Responsive design (mobile-first)
- Apple/Google inspired interface

---

## 🛠️ Tech Stack

### Frontend
| Technology | Usage |
|------------|-------|
| **React 19** | UI Framework |
| **Vite** | Build tool |
| **TailwindCSS** | Styling |
| **React Router** | Navigation |
| **Recharts** | Charts |
| **Heroicons** | Icons |

### Backend
| Technology | Usage |
|------------|-------|
| **Node.js 18+** | Runtime |
| **Express** | API Framework |
| **PostgreSQL 14+** | Database |
| **JWT** | Authentication |
| **Mistral AI** | AI Classification |
| **Helmet** | HTTP Security |

### Security
| Measure | Implementation |
|---------|----------------|
| Data encryption | AES-256-GCM |
| Password hashing | bcrypt (10 rounds) |
| API protection | Rate limiting |
| 2FA | TOTP (speakeasy) + Email |

---

## 📦 Prerequisites

- Node.js >= 18.x
- PostgreSQL >= 14.x
- npm or yarn
- Mistral AI account (free) for AI classification

---

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/NeuTroNBZh/prix-du-coeur.git
cd prix-du-coeur
```

### 2. Database Setup

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE prix_du_coeur;
CREATE USER prix_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE prix_du_coeur TO prix_user;

# Connect to database
\c prix_du_coeur

# Grant permissions
GRANT ALL ON SCHEMA public TO prix_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO prix_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO prix_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO prix_user;

\q

# Run initial schema
psql -U prix_user -d prix_du_coeur -f database/migrations/001_initial_schema.sql

# Apply migrations in order
for f in database/migrations/*.sql; do
  psql -U prix_user -d prix_du_coeur -f "$f"
done
```

### 3. Backend Setup

```bash
cd backend
npm install

# Create configuration file
cp .env.example .env
```

Edit `backend/.env` with your information:

```env
# Server
NODE_ENV=development
PORT=3002
FRONTEND_URL=http://localhost:5173

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=prix_du_coeur
DB_USER=prix_user
DB_PASSWORD=your_secure_password

# JWT (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=your_generated_jwt_secret
JWT_EXPIRES_IN=7d

# Mistral AI (get at: https://console.mistral.ai/)
MISTRAL_API_KEY=your_mistral_api_key
MISTRAL_MODEL=mistral-small-latest

# Encryption (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=your_32_byte_hex_encryption_key

# CORS
CORS_ORIGIN=http://localhost:5173

# Email SMTP (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM=Prix du Coeur <noreply@yourdomain.com>
```

### 4. Frontend Setup

```bash
cd frontend
npm install

# Create configuration file
cp .env.example .env
```

Edit `frontend/.env`:

```env
VITE_API_URL=http://localhost:3002
```

### 5. Launch the application

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

The application is accessible at [http://localhost:5173](http://localhost:5173)

---

## 📝 Available Scripts

### Backend
```bash
npm run dev    # Start in development mode (nodemon)
npm start      # Start in production
npm test       # Run tests
```

### Frontend
```bash
npm run dev      # Start development server
npm run build    # Production build
npm run preview  # Preview build
npm run lint     # Check code
```

---

## 📁 Project Structure

```
prix-du-coeur/
├── 📁 frontend/              # React SPA Application
│   └── src/
│       ├── components/       # Reusable UI components
│       ├── contexts/         # Contexts (Auth, Theme)
│       ├── pages/            # Application pages
│       ├── services/         # API communication
│       └── utils/            # Utility functions
│
├── 📁 backend/               # Express API
│   └── src/
│       ├── controllers/      # Request handlers
│       ├── middleware/       # Auth, Admin, etc.
│       ├── routes/           # Route definitions
│       ├── services/         # Business logic (AI, Email, Encryption)
│       └── utils/
│           └── parsers/      # Bank parsers (CA, Revolut, CMB, CIC)
│
├── 📁 database/
│   ├── migrations/           # SQL migration scripts
│   └── seeds/                # Initial data
│
├── 📁 config/                # Nginx, fail2ban configurations
│
└── 📁 docs/                  # Technical documentation
```

---

## 🔐 Security

### Data Encryption
Transaction labels are encrypted with AES-256-GCM before database storage. The encryption key is stored only in the .env file (never in the database).

### Authentication & Authorization
- Passwords hashed with bcrypt (10 salt rounds)
- JWT tokens with configurable expiration
- 2FA support (TOTP or Email)
- Mandatory email verification

### API Protection
- Global rate limiting (100 req/min)
- Strict rate limiting for sensitive actions (10 req/min)
- Security headers via Helmet.js
- Configured CORS

### Sensitive Files
The following files must NEVER be committed:
- `backend/.env` - API and encryption keys
- `frontend/.env` - Local configuration
- `SECURITY-PRIVATE.md` - Audit report

These files are automatically excluded via .gitignore.

---

## 🏦 Supported Banks

| Bank | CSV | PDF |
|------|-----|-----|
| Crédit Agricole | ✅ | ✅ |
| Revolut | ✅ | ❌ |
| Crédit Mutuel de Bretagne | ✅ | ✅ |
| CIC | ✅ | ❌ |
| Boursorama | 🔜 | 🔜 |

---

## 📚 Documentation

- [Deployment Guide](/NeuTroNBZh/prix-du-coeur/blob/main/DEPLOYMENT.md)
- [Contributing Guide](/NeuTroNBZh/prix-du-coeur/blob/main/CONTRIBUTING.md)
- [Encryption Architecture](/NeuTroNBZh/prix-du-coeur/blob/main/docs/ENCRYPTION.md)
- [Full Description](/NeuTroNBZh/prix-du-coeur/blob/main/docs/DESCRIPTION-COMPLETE-SITE.md)

---

## 🤝 Contributing

Contributions are welcome! Check out the [contributing guide](/NeuTroNBZh/prix-du-coeur/blob/main/CONTRIBUTING.md) to get started.

```bash
# Fork the project
# Create a branch
git checkout -b feature/my-feature

# Commit
git commit -m "feat: add my feature"

# Push and create a Pull Request
git push origin feature/my-feature
```

---

## 📜 License

This project is under MIT License. See the [LICENSE](/NeuTroNBZh/prix-du-coeur/blob/main/LICENSE) file for more details.

---

## 🙏 Acknowledgments

- [Mistral AI](https://mistral.ai/) for the classification API
- [TailwindCSS](https://tailwindcss.com/) for the CSS framework
- [Recharts](https://recharts.org/) for the charts
- The open source community
