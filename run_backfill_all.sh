#!/bin/bash
###############################################################################
# run_backfill_all.sh
#
# Completează TOATE sezoanele incomplete:
#   1. Resetează state-ul doar pentru sezoanele incomplete
#   2. Rulează Phase 1 (Puppeteer discovery) pentru fiecare sezon
#   3. Rulează Phase 2 (HTTP API extraction) în batch-uri
#   4. Rulează RECALCULATE_ALL.js la final
#
# USAGE:
#   bash run_backfill_all.sh              # Full run (reset + phase1 + phase2)
#   bash run_backfill_all.sh --skip-reset # Skip reset, doar phase1+phase2
#   bash run_backfill_all.sh --phase2only # Doar phase2 (dacă phase1 e deja făcut)
###############################################################################

cd "/home/florian/API SMART 5"

LOG_DIR="logs/backfill"
mkdir -p "$LOG_DIR"
LOGFILE="$LOG_DIR/backfill_$(date '+%Y%m%d_%H%M%S').log"

# Funcție de logging
log() {
    echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOGFILE"
}

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     BACKFILL ALL - Completare Toate Sezoanele Incomplete    ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Start: $(date '+%Y-%m-%d %H:%M:%S')                            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

SKIP_RESET=false
PHASE2_ONLY=false

for arg in "$@"; do
    case $arg in
        --skip-reset) SKIP_RESET=true ;;
        --phase2only) PHASE2_ONLY=true ;;
    esac
done

# ═══════════════════════════════════════════════
# STEP 0: Reset state pentru sezoane incomplete
# ═══════════════════════════════════════════════

if [ "$SKIP_RESET" = false ] && [ "$PHASE2_ONLY" = false ]; then
    log "═══ STEP 0: Reset state sezoane incomplete ═══"
    node reset_incomplete_state.js 2>&1 | tee -a "$LOGFILE"
    echo ""
fi

# ═══════════════════════════════════════════════
# STEP 1: Phase 1 - Discovery (Puppeteer)
# Rulează per-ligă, per-sezon
# ═══════════════════════════════════════════════

# Sezoanele care trebuie completate (non-calendar year leagues)
SEASONS_STANDARD="2021-2022 2022-2023 2023-2024 2024-2025"
# Calendar year leagues (Norway, Sweden, Brazil)
SEASONS_CALENDAR="2021 2022 2023 2024"

# Toate ligile cu sezon standard
LEAGUES_STANDARD=(
    "ENGLAND: Premier League"
    "SPAIN: LaLiga"
    "GERMANY: Bundesliga"
    "ITALY: Serie A"
    "FRANCE: Ligue 1"
    "NETHERLANDS: Eredivisie"
    "PORTUGAL: Liga Portugal"
    "BELGIUM: Regular Season"
    "TURKEY: Super Lig"
    "SCOTLAND: Premiership"
    "AUSTRIA: Bundesliga"
    "DENMARK: Superliga"
    "SWITZERLAND: Super League"
    "GREECE: Super League"
    "ROMANIA: Superliga"
    "SERBIA: Mozzart Bet Super Liga"
    "POLAND: Ekstraklasa"
    "ENGLAND: Championship"
    "GERMANY: 2. Bundesliga"
    "SPAIN: LaLiga2"
    "EUROPE: Champions League"
    "EUROPE: Europa League"
    "EUROPE: Conference League"
)

LEAGUES_CALENDAR=(
    "NORWAY: Eliteserien"
    "SWEDEN: Allsvenskan"
    "BRAZIL: Serie A"
)

if [ "$PHASE2_ONLY" = false ]; then
    log "═══ STEP 1: Phase 1 - Discovery (Puppeteer) ═══"
    log "Aceasta este cea mai lentă parte - Puppeteer scrape FlashScore"
    echo ""

    phase1_count=0

    # Standard leagues
    for league in "${LEAGUES_STANDARD[@]}"; do
        for season in $SEASONS_STANDARD; do
            log "Phase 1: $league $season"
            timeout 600 node UNIVERSAL_BACKFILL.js --phase=1 --league="$league" --season="$season" 2>&1 | tee -a "$LOGFILE"
            exit_code=${PIPESTATUS[0]}

            if [ $exit_code -eq 124 ]; then
                log "⚠️  Timeout (10 min) pentru $league $season - continuăm"
            fi

            phase1_count=$((phase1_count + 1))

            # Pauză între sesiuni Puppeteer (evităm ban)
            log "   Pauză 10s între discovery..."
            sleep 10
        done
    done

    # Calendar year leagues
    for league in "${LEAGUES_CALENDAR[@]}"; do
        for season in $SEASONS_CALENDAR; do
            log "Phase 1: $league $season"
            timeout 600 node UNIVERSAL_BACKFILL.js --phase=1 --league="$league" --season="$season" 2>&1 | tee -a "$LOGFILE"
            exit_code=${PIPESTATUS[0]}

            if [ $exit_code -eq 124 ]; then
                log "⚠️  Timeout pentru $league $season - continuăm"
            fi

            phase1_count=$((phase1_count + 1))
            log "   Pauză 10s..."
            sleep 10
        done
    done

    log "✅ Phase 1 completat: $phase1_count sesiuni de discovery"
    echo ""
fi

# ═══════════════════════════════════════════════
# STEP 2: Phase 2 - Extraction (HTTP API)
# Rulează în batch-uri mari, iterativ
# ═══════════════════════════════════════════════

log "═══ STEP 2: Phase 2 - Extraction (HTTP API) ═══"
BATCH_SIZE=500
MAX_ITERATIONS=30
iteration=0

while [ $iteration -lt $MAX_ITERATIONS ]; do
    iteration=$((iteration + 1))
    log ""
    log "━━━ Phase 2 - Iterația $iteration/$MAX_ITERATIONS (batch $BATCH_SIZE) ━━━"

    node UNIVERSAL_BACKFILL.js --phase=2 --batch=$BATCH_SIZE 2>&1 | tee "$LOG_DIR/phase2_iter${iteration}.log"

    # Check if there's nothing left to process
    if grep -q "Nu sunt meciuri de procesat" "$LOG_DIR/phase2_iter${iteration}.log" 2>/dev/null; then
        log "🎉 Phase 2 completat - nu mai sunt meciuri de procesat!"
        break
    fi

    # Check how many were processed
    processed=$(grep -oE '[0-9]+ meciuri procesate' "$LOG_DIR/phase2_iter${iteration}.log" | grep -oE '^[0-9]+' | head -1)

    if [ -z "$processed" ] || [ "$processed" -eq 0 ]; then
        log "⚠️  0 meciuri procesate - verificăm dacă mai sunt pending..."

        # Quick status check
        pending_count=$(node -e "
            const fs = require('fs');
            const state = JSON.parse(fs.readFileSync('backfill_state.json', 'utf8'));
            let total = 0;
            for (const [k, v] of Object.entries(state.leagues)) {
                if (k.includes('2025-2026') || k.endsWith('__2025')) continue;
                const pending = (v.discoveredIds?.length || 0) - (v.processedIds?.length || 0);
                if (pending > 0) total += pending;
            }
            console.log(total);
        " 2>/dev/null)

        if [ "$pending_count" = "0" ] || [ -z "$pending_count" ]; then
            log "✅ Nu mai sunt meciuri pending!"
            break
        else
            log "   Încă $pending_count meciuri pending - continuăm..."
        fi
    else
        log "   Procesate: $processed meciuri"
    fi

    # Pauza între batch-uri
    log "   Pauză 15s între batch-uri..."
    sleep 15
done

# ═══════════════════════════════════════════════
# STEP 3: Verificare finală + RECALCULATE
# ═══════════════════════════════════════════════

log ""
log "═══ STEP 3: Verificare finală ═══"
node /tmp/check_incomplete3.js 2>&1 | tee -a "$LOGFILE"

log ""
log "═══ STEP 4: Recalculare probabilități ═══"
node RECALCULATE_ALL.js 2>&1 | tee -a "$LOGFILE"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              BACKFILL ALL - FINALIZAT!                      ║"
echo "║  Finalizat: $(date '+%Y-%m-%d %H:%M:%S')                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
