#!/bin/bash

# Script de vérification de l'installation de Prix du Cœur

echo "🔍 Vérification de l'installation de Prix du Cœur..."
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Compteurs
ERRORS=0
WARNINGS=0

# Fonction de vérification
check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${RED}✗${NC} $1"
        ((ERRORS++))
    fi
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

# 1. Vérifier Node.js
echo "📦 Vérification des prérequis..."
node --version > /dev/null 2>&1
check "Node.js installé ($(node --version 2>/dev/null || echo 'NON INSTALLÉ'))"

npm --version > /dev/null 2>&1
check "npm installé ($(npm --version 2>/dev/null || echo 'NON INSTALLÉ'))"

# 2. Vérifier PostgreSQL
psql --version > /dev/null 2>&1
check "PostgreSQL installé ($(psql --version 2>/dev/null | head -1 || echo 'NON INSTALLÉ'))"

# 3. Vérifier la base de données
if command -v psql &> /dev/null; then
    PGPASSWORD=${DB_PASSWORD:-VotreMotDePasse} psql -h localhost -U ${DB_USER:-prix_user} -d ${DB_NAME:-prix_du_coeur} -c "SELECT 1;" > /dev/null 2>&1
    check "Base de données accessible"
else
    warn "PostgreSQL n'est pas installé - impossible de vérifier la base de données"
fi

echo ""
echo "📁 Vérification de la structure du projet..."

# 4. Vérifier les dossiers
[ -d "backend" ] && check "Dossier backend présent" || { echo -e "${RED}✗${NC} Dossier backend manquant"; ((ERRORS++)); }
[ -d "frontend" ] && check "Dossier frontend présent" || { echo -e "${RED}✗${NC} Dossier frontend manquant"; ((ERRORS++)); }
[ -d "database" ] && check "Dossier database présent" || { echo -e "${RED}✗${NC} Dossier database manquant"; ((ERRORS++)); }

echo ""
echo "⚙️  Vérification de la configuration..."

# 5. Vérifier les fichiers .env
if [ -f "backend/.env" ]; then
    check "Fichier backend/.env présent"
    
    # Vérifier les variables critiques
    if grep -q "JWT_SECRET=votre_secret" backend/.env; then
        warn "JWT_SECRET n'a pas été changé dans backend/.env"
    else
        check "JWT_SECRET personnalisé"
    fi
    
    if grep -q "ENCRYPTION_KEY=votre_cle" backend/.env; then
        warn "ENCRYPTION_KEY n'a pas été changé dans backend/.env"
    else
        check "ENCRYPTION_KEY personnalisé"
    fi
    
    if grep -q "MISTRAL_API_KEY=votre_cle" backend/.env; then
        warn "MISTRAL_API_KEY n'a pas été configuré dans backend/.env"
    else
        check "MISTRAL_API_KEY configuré"
    fi
else
    echo -e "${RED}✗${NC} Fichier backend/.env manquant"
    ((ERRORS++))
    echo "   Créez-le avec: cp backend/.env.example backend/.env"
fi

if [ -f "frontend/.env" ]; then
    check "Fichier frontend/.env présent"
else
    warn "Fichier frontend/.env manquant (optionnel en dev)"
fi

echo ""
echo "📚 Vérification des dépendances..."

# 6. Vérifier node_modules backend
if [ -d "backend/node_modules" ]; then
    check "Dépendances backend installées"
else
    echo -e "${RED}✗${NC} Dépendances backend manquantes"
    ((ERRORS++))
    echo "   Installez-les avec: cd backend && npm install"
fi

# 7. Vérifier node_modules frontend
if [ -d "frontend/node_modules" ]; then
    check "Dépendances frontend installées"
else
    echo -e "${RED}✗${NC} Dépendances frontend manquantes"
    ((ERRORS++))
    echo "   Installez-les avec: cd frontend && npm install"
fi

echo ""
echo "═══════════════════════════════════════════════"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ Installation complète ! Vous pouvez démarrer l'application.${NC}"
    echo ""
    echo "Pour démarrer en mode développement :"
    echo "  Terminal 1: cd backend && npm run dev"
    echo "  Terminal 2: cd frontend && npm run dev"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ Installation correcte avec $WARNINGS avertissement(s)${NC}"
    echo "  Vérifiez les avertissements ci-dessus"
else
    echo -e "${RED}✗ Installation incomplète : $ERRORS erreur(s), $WARNINGS avertissement(s)${NC}"
    echo "  Corrigez les erreurs ci-dessus avant de continuer"
    exit 1
fi

echo "═══════════════════════════════════════════════"
