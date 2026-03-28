#!/bin/bash
cd "/home/florian/API SMART 5"

echo "🧪 TEST: Pornire multiple monitoare simultan"
echo "=" | head -c 60 && echo

# Pornește primul monitor
echo "1️⃣  Pornire Monitor #1..."
node API-SMART-5.js monitor > /tmp/test-monitor-1.log 2>&1 &
MONITOR1_PID=$!
echo "   Monitor #1 PID: $MONITOR1_PID"
sleep 3

# Verifică lock file
if [ -f ".monitor.lock" ]; then
    echo "✅ Lock file creat:"
    cat ".monitor.lock"
else
    echo "❌ Lock file NU a fost creat!"
fi

echo ""
echo "2️⃣  Încercare pornire Monitor #2 (ar trebui să eșueze)..."
node API-SMART-5.js monitor > /tmp/test-monitor-2.log 2>&1
MONITOR2_EXIT=$?

echo ""
if [ $MONITOR2_EXIT -ne 0 ]; then
    echo "✅ SUCCESS: Monitor #2 a fost blocat corect!"
    echo ""
    echo "📋 Mesaj eroare Monitor #2:"
    cat /tmp/test-monitor-2.log | tail -10
else
    echo "❌ FAIL: Monitor #2 NU a fost blocat!"
fi

echo ""
echo "🧹 Cleanup: oprire Monitor #1..."
kill $MONITOR1_PID 2>/dev/null
sleep 1
rm -f ".monitor.lock"
echo "✅ Test finalizat"
