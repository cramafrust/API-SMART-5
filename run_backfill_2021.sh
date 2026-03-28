#!/bin/bash
# Backfill sezon 2021-2022 / 2021 / 2022
# Phase 1: Discovery (Puppeteer) - gaseste match IDs
# Phase 2: Extract in batch-uri de 200, cu pauza intre ele

cd "/home/florian/API SMART 5"
LOG="logs/backfill_2021_$(date +%Y%m%d_%H%M%S).log"

echo "=== BACKFILL 2021-2022 START: $(date) ===" | tee -a "$LOG"

# Phase 1: Discovery pentru toate sezoanele 2021-2022 / 2021
echo "" | tee -a "$LOG"
echo "=== PHASE 1: DISCOVERY ===" | tee -a "$LOG"

# Sezoane europene (2021-2022)
node UNIVERSAL_BACKFILL.js --phase=1 --season=2021-2022 2>&1 | tee -a "$LOG"

# Sezoane calendar year (2021)
node UNIVERSAL_BACKFILL.js --phase=1 --season=2021 2>&1 | tee -a "$LOG"

# Brazilia 2022
node UNIVERSAL_BACKFILL.js --phase=1 --season=2022 2>&1 | tee -a "$LOG"

echo "" | tee -a "$LOG"
echo "=== PHASE 1 COMPLETE: $(date) ===" | tee -a "$LOG"

# Phase 2: Extract in batch-uri de 200
echo "" | tee -a "$LOG"
echo "=== PHASE 2: EXTRACTION (batches of 200) ===" | tee -a "$LOG"

BATCH=1
while true; do
    echo "" | tee -a "$LOG"
    echo "--- Batch $BATCH (200 matches) - $(date) ---" | tee -a "$LOG"

    # Ruleaza batch de 200 doar pentru sezoanele noi
    OUTPUT=$(node UNIVERSAL_BACKFILL.js --phase=2 --batch=200 --season=2021-2022 2>&1)
    echo "$OUTPUT" | tee -a "$LOG"

    # Si pentru sezoanele calendar year
    OUTPUT2=$(node UNIVERSAL_BACKFILL.js --phase=2 --batch=200 --season=2021 2>&1)
    echo "$OUTPUT2" | tee -a "$LOG"

    OUTPUT3=$(node UNIVERSAL_BACKFILL.js --phase=2 --batch=200 --season=2022 2>&1)
    echo "$OUTPUT3" | tee -a "$LOG"

    # Verifica daca mai sunt meciuri de procesat
    if echo "$OUTPUT $OUTPUT2 $OUTPUT3" | grep -q "Niciun meci nou de procesat\|Nu sunt meciuri\|0 meciuri de procesat\|All matches processed"; then
        echo "" | tee -a "$LOG"
        echo "=== ALL DONE! No more matches to process ===" | tee -a "$LOG"
        break
    fi

    BATCH=$((BATCH + 1))

    # Pauza de 30s intre batch-uri ca sa nu supraincarcam
    echo "Pauza 30s inainte de urmatorul batch..." | tee -a "$LOG"
    sleep 30
done

echo "" | tee -a "$LOG"
echo "=== BACKFILL 2021-2022 COMPLETE: $(date) ===" | tee -a "$LOG"

# Recalculeaza procentele dupa backfill
echo "" | tee -a "$LOG"
echo "=== RECALCULATE ALL ===" | tee -a "$LOG"
node RECALCULATE_ALL.js 2>&1 | tee -a "$LOG"

echo "" | tee -a "$LOG"
echo "=== ALL DONE: $(date) ===" | tee -a "$LOG"
