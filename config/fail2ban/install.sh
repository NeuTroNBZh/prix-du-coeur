#!/bin/bash
# ============================================
# 🛡️ INSTALLATION FAIL2BAN - Prix du Coeur
# ============================================
# Ce script installe et configure fail2ban
# pour protéger l'application contre les intrusions
# ============================================

set -e

echo "🛡️ Installation de la protection Fail2Ban..."
echo ""

# Vérifier les droits root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Ce script doit être exécuté en root (sudo)"
    exit 1
fi

# Chemin de la configuration
CONFIG_DIR="/var/www/html/prix-du-coeur/config/fail2ban"

# Vérifier que les fichiers de config existent
if [ ! -f "$CONFIG_DIR/jail.local" ]; then
    echo "❌ Fichier jail.local non trouvé dans $CONFIG_DIR"
    exit 1
fi

echo "📦 Installation de fail2ban si nécessaire..."
apt-get update -qq
apt-get install -y fail2ban > /dev/null

echo "📋 Copie des fichiers de configuration..."

# Backup de la config existante
if [ -f "/etc/fail2ban/jail.local" ]; then
    cp /etc/fail2ban/jail.local /etc/fail2ban/jail.local.backup.$(date +%Y%m%d)
    echo "   ✅ Backup de l'ancienne config créé"
fi

# Copier la configuration jail
cp "$CONFIG_DIR/jail.local" /etc/fail2ban/jail.local
echo "   ✅ jail.local installé"

# Copier les filtres personnalisés
mkdir -p /etc/fail2ban/filter.d
for filter in "$CONFIG_DIR/filter.d/"*.conf; do
    if [ -f "$filter" ]; then
        cp "$filter" /etc/fail2ban/filter.d/
        echo "   ✅ $(basename $filter) installé"
    fi
done

# Vérifier la configuration
echo ""
echo "🔍 Vérification de la configuration..."
if fail2ban-client -t; then
    echo "   ✅ Configuration valide"
else
    echo "   ❌ Erreur de configuration!"
    exit 1
fi

# Redémarrer fail2ban
echo ""
echo "🔄 Redémarrage de fail2ban..."
systemctl restart fail2ban
systemctl enable fail2ban

# Attendre que le service démarre
sleep 2

# Afficher le statut
echo ""
echo "📊 Statut des jails actives:"
echo "----------------------------"
fail2ban-client status

echo ""
echo "✅ Installation terminée!"
echo ""
echo "📝 Commandes utiles:"
echo "   - Voir les jails:     sudo fail2ban-client status"
echo "   - Voir une jail:      sudo fail2ban-client status prix-du-coeur-auth"
echo "   - Débannir une IP:    sudo fail2ban-client set <jail> unbanip <IP>"
echo "   - Voir les logs:      sudo tail -f /var/log/fail2ban.log"
echo ""
echo "⚠️  N'oubliez pas de configurer les rate limits Nginx!"
echo "    Voir: /var/www/html/prix-du-coeur/config/nginx-security.conf"
