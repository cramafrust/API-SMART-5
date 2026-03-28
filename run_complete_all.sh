#!/bin/bash
###############################################################################
# 🔄 RUN COMPLETE ALL - Completare Automată Toate Etapele Lipsă
#
# Rulează COMPLETE_MISSING_PARAMS.js în batch-uri de câte 19 meciuri
# până când nu mai sunt parametri de completat.
#
# USAGE:
#   bash run_complete_all.sh
###############################################################################

BATCH_SIZE=19
LOG_DIR="logs"
MAX_BATCHES=100  # Limită de siguranță

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║         🔄 RUN COMPLETE ALL                                  ║"
echo "║         Completare Automată Etape Lipsă                      ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "⏰ Start: $(date '+%Y-%m-%d %H:%M:%S')"
echo "📦 Batch size: ${BATCH_SIZE} meciuri"
echo "🔄 Max batches: ${MAX_BATCHES}"
echo "============================================================"

# Creează director logs dacă nu există
mkdir -p "$LOG_DIR"

batch_count=0

while [ $batch_count -lt $MAX_BATCHES ]; do
    batch_count=$((batch_count + 1))

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔄 BATCH $batch_count / $MAX_BATCHES"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Rulează batch
    node COMPLETE_MISSING_PARAMS.js --batch=$BATCH_SIZE --param=etapa \
        2>&1 | tee "$LOG_DIR/complete-params-batch${batch_count}.log"

    exit_code=${PIPESTATUS[0]}

    # Verifică dacă s-a terminat (nu mai sunt meciuri)
    if grep -q "Nu există parametri lipsă" "$LOG_DIR/complete-params-batch${batch_count}.log"; then
        echo ""
        echo "🎉 FINALIZAT! Nu mai sunt parametri de completat!"
        break
    fi

    # Verifică dacă au fost completați parametri
    completed=$(grep "✅ Completați:" "$LOG_DIR/complete-params-batch${batch_count}.log" | grep -oE '[0-9]+' | head -1)

    if [ -z "$completed" ] || [ "$completed" -eq 0 ]; then
        echo "⚠️  Niciun parametru completat în acest batch - oprire"
        break
    fi

    echo "✅ Batch $batch_count: $completed parametri completați"

    # Delay între batch-uri (să nu suprasolicit FlashScore)
    if [ $batch_count -lt $MAX_BATCHES ]; then
        echo "⏳ Pauză 5 secunde între batch-uri..."
        sleep 5
    fi
done

echo ""
echo "============================================================"
echo "📊 REZUMAT:"
echo "   Total batch-uri rulate: $batch_count"
echo "⏰ Finalizat: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"
echo ""
echo "✅ Completare finalizată!"
echo ""
