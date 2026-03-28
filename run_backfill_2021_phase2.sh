#!/bin/bash
cd "/home/florian/API SMART 5"
LOG="logs/backfill_2021_phase2_resume.log"
echo "=== PHASE 2 RESTART: $(date) ===" > "$LOG"

BATCH=1
while true; do
    echo "" >> "$LOG"
    echo "--- Batch $BATCH (500 matches) - $(date) ---" >> "$LOG"

    node UNIVERSAL_BACKFILL.js --phase=2 --batch=500 --season=2021-2022 >> "$LOG" 2>&1
    node UNIVERSAL_BACKFILL.js --phase=2 --batch=500 --season=2021 >> "$LOG" 2>&1
    node UNIVERSAL_BACKFILL.js --phase=2 --batch=500 --season=2022 >> "$LOG" 2>&1

    # Check remaining
    REMAINING=$(node -e "
const s = require('./backfill_state.json');
let pending = 0;
for (const [k, v] of Object.entries(s)) {
    if (k.includes('2021') || k.includes('2022')) {
        if (v.discoveredIds && v.processedIds) {
            pending += v.discoveredIds.length - v.processedIds.length;
        }
    }
}
console.log(pending);
" 2>/dev/null)

    echo "Remaining: $REMAINING" >> "$LOG"

    if [ "$REMAINING" = "0" ] || [ -z "$REMAINING" ]; then
        echo "=== ALL MATCHES DOWNLOADED ===" >> "$LOG"
        break
    fi

    BATCH=$((BATCH + 1))
    echo "Pauza 30s inainte de batch $BATCH..." >> "$LOG"
    sleep 30
done

echo "" >> "$LOG"
echo "=== RECALCULATE ALL ===" >> "$LOG"
node RECALCULATE_ALL.js >> "$LOG" 2>&1
echo "=== COMPLETE: $(date) ===" >> "$LOG"
