#!/bin/bash
##
## Script de instalare servicii systemd pentru API SMART 5
##

echo "═══════════════════════════════════════════════════════════"
echo "🔧 INSTALARE SERVICII API SMART 5"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Verifică dacă rulează ca root
if [ "$EUID" -ne 0 ]; then
    echo "❌ Acest script trebuie rulat ca root (sudo)"
    echo "   Rulează: sudo bash install-service.sh"
    exit 1
fi

# Director curent
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Creează director logs dacă nu există
mkdir -p "$SCRIPT_DIR/logs"
chown florian:florian "$SCRIPT_DIR/logs"

echo "📋 Configurare servicii..."

# Copiază fișierele de serviciu
echo "   → Copiere api-smart-5.service"
cp "$SCRIPT_DIR/api-smart-5.service" /etc/systemd/system/
chmod 644 /etc/systemd/system/api-smart-5.service

echo "   → Copiere api-smart-5-watchdog.service"
cp "$SCRIPT_DIR/api-smart-5-watchdog.service" /etc/systemd/system/
chmod 644 /etc/systemd/system/api-smart-5-watchdog.service

# Reload systemd
echo ""
echo "🔄 Reload systemd daemon..."
systemctl daemon-reload

# Enable services
echo ""
echo "✅ Activare servicii (pornire automată la boot)..."
systemctl enable api-smart-5.service
systemctl enable api-smart-5-watchdog.service

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ INSTALARE COMPLETĂ!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📋 Comenzi disponibile:"
echo ""
echo "   # Pornire servicii"
echo "   sudo systemctl start api-smart-5"
echo "   sudo systemctl start api-smart-5-watchdog"
echo ""
echo "   # Oprire servicii"
echo "   sudo systemctl stop api-smart-5"
echo "   sudo systemctl stop api-smart-5-watchdog"
echo ""
echo "   # Restart servicii"
echo "   sudo systemctl restart api-smart-5"
echo "   sudo systemctl restart api-smart-5-watchdog"
echo ""
echo "   # Status servicii"
echo "   sudo systemctl status api-smart-5"
echo "   sudo systemctl status api-smart-5-watchdog"
echo ""
echo "   # Vizualizare logs LIVE"
echo "   sudo journalctl -u api-smart-5 -f"
echo "   sudo journalctl -u api-smart-5-watchdog -f"
echo ""
echo "   # Dezactivare pornire automată"
echo "   sudo systemctl disable api-smart-5"
echo "   sudo systemctl disable api-smart-5-watchdog"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "💡 Vrei să pornești serviciile acum? (y/n)"
read -r response

if [[ "$response" =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 Pornire servicii..."

    # Oprește procesele vechi dacă există
    echo "   → Oprire procese vechi..."
    pkill -f "API-SMART-5.js" || true
    sleep 2

    # Pornește serviciile noi
    echo "   → Pornire api-smart-5.service..."
    systemctl start api-smart-5

    echo "   → Pornire api-smart-5-watchdog.service..."
    systemctl start api-smart-5-watchdog

    sleep 3

    echo ""
    echo "📊 Status servicii:"
    echo ""
    systemctl status api-smart-5 --no-pager -l
    echo ""
    systemctl status api-smart-5-watchdog --no-pager -l

    echo ""
    echo "✅ Servicii pornite! Verifică log-urile pentru detalii."
else
    echo ""
    echo "ℹ️  Serviciile NU au fost pornite automat."
    echo "   Pornește-le manual când ești gata:"
    echo "   sudo systemctl start api-smart-5"
    echo "   sudo systemctl start api-smart-5-watchdog"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
