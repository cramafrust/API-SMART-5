#!/bin/bash
# ============================================================
# NIGHT OPS: Restart monitor + Backfill Phase 1 + Phase 2
# Scheduled for 01:15 AM on 2026-03-02
# Runs autonomously - no user input needed
# ============================================================

WORKDIR="/home/florian/API SMART 5"
LOG="$WORKDIR/api-smart-5-run.log"
NIGHT_LOG="$WORKDIR/logs/night-ops-$(date +%Y%m%d).log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [NIGHT-OPS] $1" | tee -a "$NIGHT_LOG"
}

cd "$WORKDIR"

log "=== NIGHT OPS STARTED - Waiting until 01:15 ==="
log "Plan: 1) Restart monitor  2) Backfill Phase 1 (discover)  3) Backfill Phase 2 (extract)"

# ============================================================
# STEP 0: Wait until 01:15
# ============================================================
while true; do
    CURRENT_DATE=$(date +%Y-%m-%d)
    NOW=$(date +%H%M)
    if [ "$CURRENT_DATE" = "2026-03-02" ] && [ "$NOW" -ge "0115" ]; then
        break
    fi
    # Also handle edge case: it's already March 2 past 01:15
    if [ "$CURRENT_DATE" \> "2026-03-02" ]; then
        break
    fi
    sleep 30
done

log "=== 01:15 REACHED - Starting operations ==="

# ============================================================
# STEP 1: Wait for any in-progress match verification to finish
# ============================================================
log "Checking for active match verifications..."
for i in $(seq 1 20); do
    ACTIVE=$(tail -20 "$LOG" 2>/dev/null | grep -c "Checking\|Verificare:" || echo "0")
    if [ "$ACTIVE" -eq "0" ]; then
        log "No active verifications. Proceeding."
        break
    fi
    log "Still active checks, waiting 30s... (attempt $i/20)"
    sleep 30
done

# ============================================================
# STEP 2: Kill stuck DAILY_MASTER if still running
# ============================================================
DM_PID=$(pgrep -f "node DAILY_MASTER.js" || true)
if [ -n "$DM_PID" ]; then
    log "DAILY_MASTER still running (PID $DM_PID) - stopping it"
    kill "$DM_PID" 2>/dev/null
    sleep 2
    kill -9 "$DM_PID" 2>/dev/null || true
    log "DAILY_MASTER stopped"
fi

# Also kill any lingering COMPLETE_MISSING_PARAMS
CMP_PID=$(pgrep -f "COMPLETE_MISSING_PARAMS" || true)
if [ -n "$CMP_PID" ]; then
    log "COMPLETE_MISSING_PARAMS running (PID $CMP_PID) - stopping it"
    kill "$CMP_PID" 2>/dev/null
    sleep 2
    kill -9 "$CMP_PID" 2>/dev/null || true
fi

# ============================================================
# STEP 3: Restart monitor (picks up MATCH_VERIFICATION_ALERTER fix)
# ============================================================
log "Stopping current monitor..."
MONITOR_PID=$(pgrep -f "node API-SMART-5.js full" || true)
if [ -n "$MONITOR_PID" ]; then
    kill "$MONITOR_PID" 2>/dev/null
    sleep 3
    kill -9 "$MONITOR_PID" 2>/dev/null || true
    log "Monitor stopped (was PID $MONITOR_PID)"
else
    log "No monitor process found"
fi

sleep 2

# Archive old log
mv "$LOG" "$WORKDIR/logs/api-smart-5-$(date +%Y%m%d-%H%M%S).log" 2>/dev/null || true

# Start fresh monitor
log "Starting fresh monitor..."
nohup node API-SMART-5.js full >> "$LOG" 2>&1 &
NEW_MONITOR_PID=$!
sleep 5

if kill -0 "$NEW_MONITOR_PID" 2>/dev/null; then
    log "Monitor restarted successfully (PID $NEW_MONITOR_PID)"
else
    log "ERROR: Monitor failed to start! Retrying..."
    nohup node API-SMART-5.js full >> "$LOG" 2>&1 &
    NEW_MONITOR_PID=$!
    sleep 5
    if kill -0 "$NEW_MONITOR_PID" 2>/dev/null; then
        log "Monitor restarted on retry (PID $NEW_MONITOR_PID)"
    else
        log "CRITICAL: Monitor failed twice. Continuing with backfill anyway."
    fi
fi

# ============================================================
# STEP 4: Backfill Phase 1 - Discover matchIds (Puppeteer)
# ============================================================
log "=== BACKFILL PHASE 1: Discovering missing matchIds ==="
log "This uses Puppeteer to scrape FlashScore results pages"
log "Estimated time: 20-30 minutes for all leagues"

# Run Phase 1 for priority 1 leagues first (top 5)
node UNIVERSAL_BACKFILL.js --phase=1 --league="ENGLAND: Premier League" >> "$NIGHT_LOG" 2>&1
log "Phase 1 done: Premier League"

node UNIVERSAL_BACKFILL.js --phase=1 --league="SPAIN: LaLiga" >> "$NIGHT_LOG" 2>&1
log "Phase 1 done: LaLiga"

node UNIVERSAL_BACKFILL.js --phase=1 --league="GERMANY: Bundesliga" >> "$NIGHT_LOG" 2>&1
log "Phase 1 done: Bundesliga"

node UNIVERSAL_BACKFILL.js --phase=1 --league="ITALY: Serie A" >> "$NIGHT_LOG" 2>&1
log "Phase 1 done: Serie A"

node UNIVERSAL_BACKFILL.js --phase=1 --league="FRANCE: Ligue 1" >> "$NIGHT_LOG" 2>&1
log "Phase 1 done: Ligue 1"

# Priority 2 leagues
for LEAGUE in \
    "NETHERLANDS: Eredivisie" \
    "PORTUGAL: Liga Portugal" \
    "BELGIUM: Jupiler Pro League" \
    "TURKEY: Super Lig" \
    "SCOTLAND: Premiership" \
    "AUSTRIA: Bundesliga" \
    "DENMARK: Superliga" \
    "SWITZERLAND: Super League" \
    "GREECE: Super League" \
    "ROMANIA: Superliga" \
    "SERBIA: Super Liga" \
    "POLAND: Ekstraklasa" \
    "ENGLAND: Championship" \
    "GERMANY: 2. Bundesliga" \
    "SPAIN: LaLiga2" \
    "NORWAY: Eliteserien" \
    "SWEDEN: Allsvenskan" \
    "BRAZIL: Serie A" \
    "ARGENTINA: Liga Profesional"
do
    # Check if monitor is still running before each league
    if ! kill -0 "$NEW_MONITOR_PID" 2>/dev/null; then
        log "WARNING: Monitor died! Restarting before continuing..."
        nohup node API-SMART-5.js full >> "$LOG" 2>&1 &
        NEW_MONITOR_PID=$!
        sleep 5
    fi

    log "Phase 1: Discovering $LEAGUE..."
    node UNIVERSAL_BACKFILL.js --phase=1 --league="$LEAGUE" >> "$NIGHT_LOG" 2>&1
    EXIT_CODE=$?
    if [ "$EXIT_CODE" -eq 0 ]; then
        log "Phase 1 done: $LEAGUE"
    elif [ "$EXIT_CODE" -eq 2 ]; then
        log "Phase 1: $LEAGUE - no data/already complete"
    else
        log "Phase 1 WARNING: $LEAGUE exit code $EXIT_CODE"
    fi

    # Small pause between leagues to not overload
    sleep 5
done

# Priority 3 (cups) - skip if it's getting late (after 05:00)
HOUR_NOW=$(date +%H)
if [ "$HOUR_NOW" -lt "05" ]; then
    for LEAGUE in \
        "UEFA: Champions League" \
        "UEFA: Europa League" \
        "UEFA: Conference League"
    do
        log "Phase 1: Discovering $LEAGUE..."
        node UNIVERSAL_BACKFILL.js --phase=1 --league="$LEAGUE" >> "$NIGHT_LOG" 2>&1
        log "Phase 1 done: $LEAGUE"
        sleep 5
    done
fi

log "=== BACKFILL PHASE 1 COMPLETE ==="

# Show status
node UNIVERSAL_BACKFILL.js --status >> "$NIGHT_LOG" 2>&1

# ============================================================
# STEP 5: Backfill Phase 2 - Extract stats via API (no browser)
# ============================================================
log "=== BACKFILL PHASE 2: Extracting match stats ==="
log "Processing up to 200 matches via HTTP API"

# Run Phase 2 with a generous batch - API only, lightweight
node UNIVERSAL_BACKFILL.js --phase=2 --batch=200 >> "$NIGHT_LOG" 2>&1
PHASE2_EXIT=$?

if [ "$PHASE2_EXIT" -eq 0 ]; then
    log "Phase 2: 200 matches processed successfully"
elif [ "$PHASE2_EXIT" -eq 2 ]; then
    log "Phase 2: All discovered matches already processed"
else
    log "Phase 2: Finished with exit code $PHASE2_EXIT"
fi

# ============================================================
# STEP 6: Final status + verify monitor
# ============================================================
log "=== FINAL STATUS ==="
node UNIVERSAL_BACKFILL.js --status >> "$NIGHT_LOG" 2>&1

# Make sure monitor is still running
if kill -0 "$NEW_MONITOR_PID" 2>/dev/null; then
    log "Monitor still running (PID $NEW_MONITOR_PID)"
else
    log "WARNING: Monitor died during backfill. Restarting..."
    nohup node API-SMART-5.js full >> "$LOG" 2>&1 &
    log "Monitor restarted (PID $!)"
fi

log "=== NIGHT OPS COMPLETE ==="
log "Summary available in: $NIGHT_LOG"
