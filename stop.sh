#!/bin/bash
#
# SCRIPT DE STOP - API SMART 5
#
# Oprește procesul API SMART 5 în mod sigur
#

echo "============================================================"
echo "🛑 STOP API SMART 5"
echo "============================================================"
echo ""

# Verifică dacă există PID file
if [ -f /tmp/api-smart-5.pid ]; then
    PID=$(cat /tmp/api-smart-5.pid)
    echo "📋 PID găsit în fișier: $PID"

    # Verifică dacă procesul există
    if ps -p $PID > /dev/null 2>&1; then
        echo "🛑 Oprire proces $PID..."
        kill $PID
        sleep 2

        # Verifică dacă s-a oprit
        if ps -p $PID > /dev/null 2>&1; then
            echo "⚠️  Procesul nu s-a oprit. Forțez oprirea..."
            kill -9 $PID
            sleep 1
        fi

        echo "✅ Proces oprit"
    else
        echo "⚠️  Procesul $PID nu mai rulează"
    fi

    # Șterge PID file
    rm -f /tmp/api-smart-5.pid
else
    echo "⚠️  Nu există PID file. Caut procese active..."
fi

# Oprește TOATE procesele API-SMART-5.js (backup)
echo ""
echo "🧹 Curățare procese rămase..."
pkill -f "API-SMART-5.js" 2>/dev/null
pkill -f "monitor-optimizat.js" 2>/dev/null
sleep 1

# Verificare finală
REMAINING=$(ps aux | grep -E "API-SMART-5.js|monitor-optimizat.js" | grep -v grep | wc -l)
if [ "$REMAINING" -gt 0 ]; then
    echo "⚠️  Încă există $REMAINING procese. Forțez oprirea..."
    pkill -9 -f "API-SMART-5.js" 2>/dev/null
    pkill -9 -f "monitor-optimizat.js" 2>/dev/null
fi

echo "✅ Toate procesele oprite"
echo ""
echo "============================================================"
echo "✅ API SMART 5 oprit cu succes!"
echo "============================================================"
