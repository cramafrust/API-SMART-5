#!/usr/bin/env node
/**
 * reset_incomplete_state.js
 *
 * Resetează state-ul din backfill_state.json DOAR pentru sezoanele incomplete
 * (sub 85% meciuri în fișierele JSON), permițând re-discovery + re-processing.
 *
 * Nu atinge sezoanele complete sau cele curente (2025-2026 / 2025).
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'backfill_state.json');
const SEASONS_DIR = path.join(__dirname, 'data', 'seasons');

// Expected matches per league per season
const EXPECTED = {
    'PremierLeague': 380, 'LaLiga': 380, 'SerieA': 380, 'Bundesliga': 306,
    'Ligue1': 380, 'Eredivisie': 306, 'PrimeiraLiga': 306, 'ENGLANDChampionship': 552,
    'ROMANIASuperliga': 240, 'TURKEYSuperLig': 380, 'GREECESuperLeague': 240,
    'AUSTRIABundesliga': 182, 'SWITZERLANDSuperLeague': 180, 'POLANDEkstraklasa': 306,
    'SCOTLANDPremiership': 228, 'SERBIAMozzartBetSuperLiga': 240, 'Superliga': 198,
    'GERMANY2Bundesliga': 306, 'SPAINLaLiga2': 462, 'SWEDENAllsvenskan': 240,
    'Eliteserien': 240, 'BRAZILSerieA': 380, 'BELGIUMRegularSeason': 240,
    'ChampionsLeague': 200, 'EuropaLeague': 200, 'ConferenceLeague': 200,
};

// Map season file league names to backfill state key patterns
const LEAGUE_TO_STATE_MAP = {
    'PremierLeague': 'ENGLAND: Premier League',
    'LaLiga': 'SPAIN: LaLiga',
    'SerieA': 'ITALY: Serie A',
    'Bundesliga': 'GERMANY: Bundesliga',
    'Ligue1': 'FRANCE: Ligue 1',
    'Eredivisie': 'NETHERLANDS: Eredivisie',
    'PrimeiraLiga': 'PORTUGAL: Liga Portugal',
    'ENGLANDChampionship': 'ENGLAND: Championship',
    'ROMANIASuperliga': 'ROMANIA: Superliga',
    'TURKEYSuperLig': 'TURKEY: Super Lig',
    'GREECESuperLeague': 'GREECE: Super League',
    'AUSTRIABundesliga': 'AUSTRIA: Bundesliga',
    'SWITZERLANDSuperLeague': 'SWITZERLAND: Super League',
    'POLANDEkstraklasa': 'POLAND: Ekstraklasa',
    'SCOTLANDPremiership': 'SCOTLAND: Premiership',
    'SERBIAMozzartBetSuperLiga': 'SERBIA: Mozzart Bet Super Liga',
    'Superliga': 'DENMARK: Superliga',
    'GERMANY2Bundesliga': 'GERMANY: 2. Bundesliga',
    'SPAINLaLiga2': 'SPAIN: LaLiga2',
    'SWEDENAllsvenskan': 'SWEDEN: Allsvenskan',
    'Eliteserien': 'NORWAY: Eliteserien',
    'BRAZILSerieA': 'BRAZIL: Serie A',
    'BELGIUMRegularSeason': 'BELGIUM: Regular Season',
    'ChampionsLeague': 'EUROPE: Champions League',
    'EuropaLeague': 'EUROPE: Europa League',
    'ConferenceLeague': 'EUROPE: Conference League',
};

const THRESHOLD = 85; // Sub 85% = incomplet

// 1. Find incomplete seasons from JSON files
const files = fs.readdirSync(SEASONS_DIR).filter(f => f.endsWith('.json'));
const incomplete = [];

for (const file of files) {
    if (file.includes('BACKUP') || file.includes('OLD_FORMAT') || file.includes('SMART4') ||
        file.includes('MULTI') || file.includes('ORIGINAL') || file.includes('backup') ||
        file.includes('CORRUPT') || file.includes('pre-migration') || file.includes('pre-recovery')) continue;

    const basename = file.replace('.json', '');
    const match = basename.match(/^complete_FULL_SEASON_(.+?)_(2\d{3}(?:-\d{4})?)$/);
    if (!match) continue;

    const league = match[1];
    const season = match[2];

    // Skip current seasons
    if (season === '2025-2026' || season === '2025') continue;

    const exp = EXPECTED[league];
    if (!exp) continue;

    try {
        const data = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, file), 'utf8'));
        const matches = Array.isArray(data) ? data : (data.meciuri || data.matches || []);
        const count = matches.length;
        const pct = Math.round(count / exp * 100);

        if (pct < THRESHOLD) {
            const statePrefix = LEAGUE_TO_STATE_MAP[league];
            if (statePrefix) {
                incomplete.push({ league, season, count, exp, pct, stateKey: `${statePrefix}__${season}` });
            }
        }
    } catch(e) {}
}

if (incomplete.length === 0) {
    console.log('✅ Nu există sezoane incomplete sub ' + THRESHOLD + '%!');
    process.exit(0);
}

// 2. Backup state
const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
const backupPath = STATE_FILE.replace('.json', `.backup-pre-reset-${Date.now()}.json`);
fs.copyFileSync(STATE_FILE, backupPath);
console.log(`📋 Backup state salvat: ${backupPath}`);

// 3. Reset state for incomplete seasons
let resetCount = 0;
console.log(`\n🔄 Resetare state pentru ${incomplete.length} sezoane incomplete:\n`);

for (const s of incomplete) {
    const key = s.stateKey;
    const oldState = state.leagues[key];

    if (oldState) {
        const oldDiscovered = oldState.discoveredIds?.length || 0;
        const oldProcessed = oldState.processedIds?.length || 0;
        console.log(`  ♻️  ${key}: ${s.count}/${s.exp} (${s.pct}%) | was: disc=${oldDiscovered} proc=${oldProcessed} → RESET`);

        // Reset complet - permite re-discovery
        state.leagues[key] = {
            discoveredIds: [],
            discoveredMatches: {},
            processedIds: [],
            failedIds: [],
            lastDiscovery: null,
            lastProcessing: null
        };
        resetCount++;
    } else {
        console.log(`  ⚠️  ${key}: ${s.count}/${s.exp} (${s.pct}%) | state key not found (OK - fresh start)`);
    }
}

// 4. Save updated state
fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');

console.log(`\n✅ Resetat ${resetCount} sezoane din state.`);
console.log(`   Sezoanele complete NU au fost atinse.`);
console.log(`\n   Următorul pas: rulează run_backfill_all.sh`);
