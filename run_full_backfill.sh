#!/bin/bash
# Full backfill: Phase 1 (discover) + Phase 2 (download)
# Rulează automat Phase 2 după Phase 1

cd "/home/florian/API SMART 5"

echo "=== START FULL BACKFILL: $(date) ==="

# Phase 1 already running, wait for it
PHASE1_PID=$(pgrep -f "UNIVERSAL_BACKFILL.js --phase=1" 2>/dev/null)
if [ -n "$PHASE1_PID" ]; then
    echo "Phase 1 deja rulează (PID: $PHASE1_PID), aștept..."
    while kill -0 $PHASE1_PID 2>/dev/null; do
        sleep 10
    done
    echo "Phase 1 terminat: $(date)"
else
    echo "Phase 1 nu rulează, lansez..."
    node UNIVERSAL_BACKFILL.js --phase=1 >> logs/backfill_phase1_rediscovery_$(date +%Y%m%d).log 2>&1
    echo "Phase 1 terminat: $(date)"
fi

echo ""
echo "=== START PHASE 2 (download matches) ==="
echo "Batch: 5000 (va descărca tot ce e de descărcat)"
echo ""

# Phase 2 - batch mare ca să descarce tot
node UNIVERSAL_BACKFILL.js --phase=2 --batch=5000 >> logs/backfill_phase2_full_$(date +%Y%m%d).log 2>&1

echo ""
echo "=== PHASE 2 TERMINAT: $(date) ==="

# After download, regenerate PROCENTE
echo ""
echo "=== REGENERARE JSON PROCENTE ==="
node GENERATE_ALL_PROCENTE.js >> logs/regenerate_procente_$(date +%Y%m%d).log 2>&1

echo ""
echo "=== FULL BACKFILL COMPLET: $(date) ==="
