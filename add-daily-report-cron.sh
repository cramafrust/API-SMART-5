#!/bin/bash
# Adaugă cron job pentru raportul zilnic automat

# Verifică dacă cron-ul există deja
if crontab -l 2>/dev/null | grep -q "SEND_DAILY_REPORT.js"; then
    echo "⚠️  Cron job pentru raportul zilnic EXISTĂ DEJA!"
    echo ""
    crontab -l | grep "SEND_DAILY_REPORT"
    echo ""
    read -p "Vrei să-l înlocuiești? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Anulat."
        exit 0
    fi
    # Șterge linia veche
    crontab -l | grep -v "SEND_DAILY_REPORT.js" | crontab -
fi

# Adaugă cron job nou (08:00 zilnic)
(crontab -l 2>/dev/null; echo "# API SMART 5 - Raport zilnic (08:00)") | crontab -
(crontab -l 2>/dev/null; echo "0 8 * * * cd \"/home/florian/API SMART 5\" && /usr/bin/node SEND_DAILY_REPORT.js >> logs/daily-report.log 2>&1") | crontab -

echo "✅ Cron job adăugat cu succes!"
echo ""
echo "📧 Raportul zilnic va fi trimis automat în fiecare zi la 08:00"
echo ""
echo "Verificare:"
crontab -l | grep -A1 "API SMART 5 - Raport"
