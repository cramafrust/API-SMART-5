#!/bin/bash
# Script pentru actualizare cron job cu DAILY_MASTER.js

echo "🔄 Actualizare Cron Job cu DAILY_MASTER.js"
echo "============================================"
echo ""

# Backup crontab actual
crontab -l > /tmp/crontab.backup 2>/dev/null
echo "✅ Backup crontab salvat în: /tmp/crontab.backup"
echo ""

# Creează noul crontab
cat > /tmp/crontab.new << 'EOF'
# ============================================
# API SMART 5 - Cron Jobs (SIMPLIFIED)
# ============================================

# Restart la boot (dacă ora >= 8 sau <= 1)
@reboot sleep 45 && H=$(date +\%H); if [ "$H" -ge 8 ] || [ "$H" -le 1 ]; then cd "/home/florian/API SMART 5" && /usr/bin/node DAILY_MASTER.js --skip-emails >> logs/daily-master.log 2>&1; fi

# DAILY MASTER - Workflow complet zilnic la 08:00
# - Colectează date finale IERI
# - Trimite email rapoarte IERI (notificări + meciuri)
# - Generează listă + program meciuri ASTĂZI
# - Pornește monitorizare HT ASTĂZI
# ROTAȚIE LOG: Dacă daily-master.log > 20MB, arhivează și resetează
0 8 * * * cd "/home/florian/API SMART 5" && if [ -f logs/daily-master.log ] && [ $(stat -c\%s logs/daily-master.log 2>/dev/null || echo 0) -gt 20971520 ]; then gzip -c logs/daily-master.log > "logs/daily-master.$(date +\%Y\%m\%d).log.gz" && truncate -s 0 logs/daily-master.log; fi && /usr/bin/node DAILY_MASTER.js >> logs/daily-master.log 2>&1

EOF

echo "📋 Noul crontab:"
echo "============================================"
cat /tmp/crontab.new
echo "============================================"
echo ""

read -p "❓ Vrei să aplici noul crontab? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    crontab /tmp/crontab.new
    echo ""
    echo "✅ Crontab actualizat cu succes!"
    echo ""
    echo "📋 Verifică cu: crontab -l"
    echo ""
    echo "📝 Diferențe:"
    echo "   ÎNAINTE: 3 cron jobs separate (08:00, 08:00, 08:05)"
    echo "   ACUM:    1 cron job MASTER (08:00)"
    echo ""
    echo "🎯 Workflow complet: node DAILY_MASTER.js"
else
    echo ""
    echo "⏭️  Crontab NU a fost modificat"
    echo ""
    echo "💡 Pentru aplicare manuală:"
    echo "   crontab /tmp/crontab.new"
fi

echo ""
echo "🗑️  Backup vechi: /tmp/crontab.backup"
echo "     (pentru restore: crontab /tmp/crontab.backup)"
echo ""
