/**
 * PATHS.js — Configurare centralizată a tuturor path-urilor din sistem
 *
 * TOATE modulele trebuie să importe path-urile de aici.
 * La reorganizarea structurii de fișiere, se modifică DOAR acest fișier.
 *
 * STRUCTURA:
 *   data/
 *   ├── seasons/
 *   │   ├── 2024-2025/
 *   │   │   ├── PremierLeague.json
 *   │   │   └── ...
 *   │   └── 2025-2026/
 *   │       └── ...
 *   ├── procente/
 *   │   └── PROCENTE_AUTOACTUAL.json
 *   ├── daily/
 *   │   └── YYYY-MM-DD/
 *   │       ├── meciuri.json
 *   │       ├── verificari.json
 *   │       ├── final-verificari.json
 *   │       └── collected.json
 *   ├── tracking/
 *   │   ├── notifications.json
 *   │   └── prematch.json
 *   └── streaks/
 *       ├── streak_patterns_catalog.json
 *       ├── scoring_streak_probabilities.json
 *       ├── goal_streak_probabilities.json
 *       └── yellow_cards_*.json
 */

const path = require('path');
const fs = require('fs');

const BASE_DIR = __dirname;
const DATA_DIR = path.join(BASE_DIR, 'data');

// =============================================
// DIRECTOARE PRINCIPALE
// =============================================
const DIRS = {
    base: BASE_DIR,
    data: DATA_DIR,
    seasons: path.join(DATA_DIR, 'seasons'),
    procente: path.join(DATA_DIR, 'procente'),
    daily: path.join(DATA_DIR, 'daily'),
    tracking: path.join(DATA_DIR, 'tracking'),
    streaks: path.join(DATA_DIR, 'streaks'),
    logs: path.join(BASE_DIR, 'logs'),
};

// =============================================
// FIȘIERE FIXE (nu depind de dată/ligă)
// =============================================
const FILES = {
    procente: path.join(DIRS.procente, 'PROCENTE_AUTOACTUAL.json'),
    procenteRoot: path.join(BASE_DIR, 'JSON PROCENTE AUTOACTUAL.json'),
    notifications: path.join(DIRS.tracking, 'notifications.json'),
    prematch: path.join(DIRS.tracking, 'prematch.json'),
    streakCatalog: path.join(DIRS.streaks, 'streak_patterns_catalog.json'),
    scoringStreak: path.join(DIRS.streaks, 'scoring_streak_probabilities.json'),
    goalStreak: path.join(DIRS.streaks, 'goal_streak_probabilities.json'),
    yellowCards: path.join(DIRS.streaks, 'yellow_cards_streak_probabilities.json'),
    yellowCards2plus: path.join(DIRS.streaks, 'yellow_cards_2plus_streak_probabilities.json'),
    oddsMonitorState: path.join(DIRS.data, 'odds_monitor_state.json'),
};

// =============================================
// FIȘIERE DINAMICE (depind de dată/ligă/sezon)
// =============================================

/**
 * Path fișier season: data/seasons/{sezon}/{Liga}.json
 * Ex: data/seasons/2025-2026/PremierLeague.json
 */
function getSeasonFile(leagueName, season) {
    return path.join(DIRS.seasons, season, `${leagueName}.json`);
}

/**
 * Pattern glob pentru toate season files dintr-un sezon
 */
function getSeasonGlob(season) {
    if (season) return path.join(DIRS.seasons, season, '*.json');
    return path.join(DIRS.seasons, '*', '*.json');
}

/**
 * Directorul zilnic: data/daily/YYYY-MM-DD/
 */
function getDailyDir(date) {
    if (!date) {
        const now = new Date();
        date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    return path.join(DIRS.daily, date);
}

/**
 * Fișiere zilnice
 */
function getDailyFile(type, date) {
    const dir = getDailyDir(date);
    const map = {
        meciuri: 'meciuri.json',
        verificari: 'verificari.json',
        'final-verificari': 'final-verificari.json',
        collected: 'collected.json',
        'pre-match-streaks': 'pre-match-streaks.json',
    };
    return path.join(dir, map[type] || `${type}.json`);
}

/**
 * Asigură că toate directoarele necesare există
 */
function ensureDirs() {
    Object.values(DIRS).forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

// =============================================
// COMPATIBILITATE — path-uri vechi → noi
// Folosit în timpul migrației
// =============================================

// Mapping vechi → nou pentru season files
// Vechi: data/seasons/complete_FULL_SEASON_PremierLeague_2025-2026.json
// Nou:   data/seasons/2025-2026/PremierLeague.json
function oldSeasonPath(leagueName, season) {
    return path.join(DIRS.seasons, `complete_FULL_SEASON_${leagueName}_${season}.json`);
}

// Vechi: notifications_tracking.json (root)
// Nou:   data/tracking/notifications.json
const LEGACY = {
    notifications: path.join(BASE_DIR, 'notifications_tracking.json'),
    prematch: path.join(BASE_DIR, 'prematch_tracking.json'),
    procente: path.join(DIRS.procente, 'JSON PROCENTE AUTOACTUAL.json'),
};

module.exports = {
    DIRS,
    FILES,
    LEGACY,
    getSeasonFile,
    getSeasonGlob,
    getDailyDir,
    getDailyFile,
    ensureDirs,
    oldSeasonPath,
};
