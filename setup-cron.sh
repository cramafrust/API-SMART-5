#!/usr/bin/env bash
#
# Setup CRON job pentru API SMART 5
# Rulează automat daily + schedule + monitor în fiecare zi la 08:00
#

SCRIPT_DIR="/home/florian/API SMART 5"
CRON_TIME="0 8 * * *"
CRON_COMMAND="cd \"$SCRIPT_DIR\" && /usr/bin/node API-SMART-5.js full >> logs/cron-daily.log 2>&1"

echo "🔧 SETUP CRON JOB - API SMART 5"
echo "================================"
echo ""
echo "📅 Program: În fiecare zi la 08:00"
echo "📂 Director: $SCRIPT_DIR"
echo "🎯 Comandă: node API-SMART-5.js full"
echo ""

# Verifică dacă cron job există deja
if crontab -l 2>/dev/null | grep -q "API-SMART-5.js full"; then
    echo "⚠️  CRON job există deja!"
    echo ""
    echo "Cron job curent:"
    crontab -l | grep "API-SMART-5.js"
    echo ""
    read -p "Ștergi cron job-ul existent și creezi unul nou? (y/N): " response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "❌ Anulat."
        exit 1
    fi

    # Șterge cron job vechi
    crontab -l | grep -v "API-SMART-5.js" | crontab -
    echo "✅ Cron job vechi șters"
fi

# Adaugă cron job nou
(crontab -l 2>/dev/null; echo "$CRON_TIME $CRON_COMMAND") | crontab -

echo ""
echo "✅ CRON JOB CREAT CU SUCCES!"
echo ""
echo "📋 Detalii:"
echo "   Oră: 08:00 (în fiecare zi)"
echo "   Workflow: daily → schedule → monitor"
echo "   Log: $SCRIPT_DIR/logs/cron-daily.log"
echo ""
echo "🔍 Verificare cron job:"
crontab -l | grep "API-SMART-5.js"
echo ""
echo "📝 NOTĂ: Cron job-ul va:"
echo "   1. Genera lista meciurilor (daily)"
echo "   2. Crea program verificări (schedule)"
echo "   3. Porni monitorizarea automată (monitor)"
echo "   4. Porni watchdog pentru notificări"
echo ""
echo "✅ GATA! Sistemul va rula automat în fiecare zi la 08:00!"
