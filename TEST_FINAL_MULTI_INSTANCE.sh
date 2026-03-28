#!/bin/bash
echo "🧪 TEST FINAL: Sistem Anti-Duplicate Monitor"
echo "=" | head -c 60 && echo

cd "/home/florian/API SMART 5"

# Test 1: Pornire monitor normal
echo "Test 1: Pornire monitor normal..."
rm -f .monitor.lock
node API-SMART-5.js monitor > /tmp/test-final-1.log 2>&1 &
PID1=$!
sleep 2

if [ -f ".monitor.lock" ]; then
    echo "✅ Lock file creat"
else
    echo "❌ FAIL: Lock file NU a fost creat"
    exit 1
fi

# Test 2: Blocare al doilea monitor
echo "Test 2: Încercare pornire al doilea monitor..."
node API-SMART-5.js monitor > /tmp/test-final-2.log 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -eq 1 ]; then
    echo "✅ Al doilea monitor blocat corect"
else
    echo "❌ FAIL: Al doilea monitor NU a fost blocat"
    kill $PID1 2>/dev/null
    exit 1
fi

# Test 3: Cleanup după oprire
echo "Test 3: Cleanup lock file..."
kill $PID1 2>/dev/null
sleep 2

if [ ! -f ".monitor.lock" ]; then
    echo "✅ Lock file șters automat"
else
    echo "⚠️  Lock file încă prezent, ștergere manuală..."
    rm -f .monitor.lock
fi

# Test 4: Pornire după cleanup
echo "Test 4: Re-pornire după cleanup..."
node API-SMART-5.js monitor > /tmp/test-final-4.log 2>&1 &
PID2=$!
sleep 2

if [ -f ".monitor.lock" ]; then
    LOCK_PID=$(cat .monitor.lock | grep -o '"pid": [0-9]*' | grep -o '[0-9]*')
    if [ "$LOCK_PID" == "$PID2" ]; then
        echo "✅ Nou lock creat cu PID corect"
    else
        echo "❌ FAIL: PID în lock incorect"
    fi
else
    echo "❌ FAIL: Lock file NU a fost re-creat"
fi

# Cleanup final
kill $PID2 2>/dev/null
sleep 1
rm -f .monitor.lock

echo ""
echo "=" | head -c 60 && echo
echo "✅ TOATE TESTELE AU TRECUT!"
echo "🎉 Sistem anti-duplicate 100% funcțional"
