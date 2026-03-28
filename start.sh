#!/bin/bash
#
# SCRIPT DE START DEFINITIV - API SMART 5
#
# Rezolvă problema proceselor multiple care rulează în paralel
# Oprește TOATE procesele vechi și pornește UN SINGUR proces nou
#

cd "/home/florian/API SMART 5"

echo "============================================================"
echo "🔄 START API SMART 5 - CLEAN START"
echo "============================================================"
echo ""

# Step 1: OPREȘTE TOATE procesele vechi
echo "🛑 STEP 1: Oprire procese vechi..."
pkill -f "API-SMART-5.js" 2>/dev/null
pkill -f "monitor-optimizat.js" 2>/dev/null
sleep 3

# Verifică dacă mai există procese
REMAINING=$(ps aux | grep -E "API-SMART-5.js|monitor-optimizat.js" | grep -v grep | wc -l)
if [ "$REMAINING" -gt 0 ]; then
    echo "⚠️  Încă există $REMAINING procese. Forțez oprirea..."
    pkill -9 -f "API-SMART-5.js" 2>/dev/null
    pkill -9 -f "monitor-optimizat.js" 2>/dev/null
    sleep 2
fi

echo "✅ Toate procesele vechi oprite"
echo ""

# Step 2: Curăță PID file (dacă există)
echo "🧹 STEP 2: Curățare PID file..."
rm -f /tmp/api-smart-5.pid
echo "✅ PID file curățat"
echo ""

# Step 3: Pornește procesul NOU
echo "🚀 STEP 3: Pornire proces nou..."
LOG_FILE="logs/api-smart-5-$(date +%Y%m%d-%H%M%S).log"
nohup node API-SMART-5.js full >> "$LOG_FILE" 2>&1 &
NEW_PID=$!

# Salvează PID-ul în fișier
echo "$NEW_PID" > /tmp/api-smart-5.pid

echo "✅ Proces pornit cu PID: $NEW_PID"
echo "📁 Log file: $LOG_FILE"
echo ""

# Step 4: Verificare
sleep 3
if ps -p $NEW_PID > /dev/null 2>&1; then
    echo "============================================================"
    echo "✅ SUCCESS: API SMART 5 pornit cu succes!"
    echo "============================================================"
    echo ""
    echo "📊 Status:"
    echo "   PID: $NEW_PID"
    echo "   Log: tail -f $LOG_FILE"
    echo "   Stop: ./stop.sh"
    echo ""
else
    echo "============================================================"
    echo "❌ EROARE: Procesul nu a pornit!"
    echo "============================================================"
    echo ""
    echo "Verifică log-ul pentru detalii:"
    echo "   tail -50 $LOG_FILE"
    echo ""
    exit 1
fi
