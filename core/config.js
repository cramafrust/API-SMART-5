/**
 * core/config.js — Configurare centralizată API SMART 5
 *
 * TOATE constantele, pragurile, path-urile, și listele din sistem.
 * Importă de aici, nu hardcoda valori în module individuale.
 *
 * USAGE:
 *   const config = require('./core/config');
 *   config.thresholds.getMinimum('ENGLAND: Premier League') // → 75
 *   config.paths.getSeasonFile('PremierLeague', '2025-2026') // → path
 *   config.leagues.isTopLeague('ENGLAND: Premier League') // → true
 */

const path = require('path');
const fs = require('fs');

// ═══════════════════════════════════════════════════════
// PATH-URI
// ═══════════════════════════════════════════════════════

const BASE_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(BASE_DIR, 'data');

const paths = {
    base: BASE_DIR,
    data: DATA_DIR,

    // Directoare
    seasons: path.join(DATA_DIR, 'seasons'),
    procente: path.join(DATA_DIR, 'procente'),
    daily: path.join(DATA_DIR, 'daily'),
    tracking: path.join(DATA_DIR, 'tracking'),
    streaks: path.join(DATA_DIR, 'streaks'),
    logs: path.join(BASE_DIR, 'logs'),

    // Fișiere fixe
    notifications: path.join(DATA_DIR, 'tracking', 'notifications.json'),
    prematch: path.join(DATA_DIR, 'tracking', 'prematch.json'),
    procenteFile: path.join(DATA_DIR, 'procente', 'PROCENTE_AUTOACTUAL.json'),
    procenteRoot: path.join(BASE_DIR, 'JSON PROCENTE AUTOACTUAL.json'),
    streakCatalog: path.join(DATA_DIR, 'streaks', 'streak_patterns_catalog.json'),
    scoringStreak: path.join(DATA_DIR, 'streaks', 'scoring_streak_probabilities.json'),
    goalStreak: path.join(DATA_DIR, 'streaks', 'goal_streak_probabilities.json'),
    yellowCards: path.join(DATA_DIR, 'streaks', 'yellow_cards_streak_probabilities.json'),
    yellowCards2plus: path.join(DATA_DIR, 'streaks', 'yellow_cards_2plus_streak_probabilities.json'),
    oddsMonitorState: path.join(DATA_DIR, 'odds_monitor_state.json'),

    // Compatibilitate — path-uri vechi (symlink-uri)
    notificationsLegacy: path.join(BASE_DIR, 'notifications_tracking.json'),
    prematchLegacy: path.join(BASE_DIR, 'prematch_tracking.json'),
    procenteLegacy: path.join(DATA_DIR, 'procente', 'JSON PROCENTE AUTOACTUAL.json'),

    // Helpers
    getSeasonFile(league, season) {
        return path.join(DATA_DIR, 'seasons', season, `${league}.json`);
    },

    getSeasonDir(season) {
        return path.join(DATA_DIR, 'seasons', season);
    },

    getSeasonGlob(season) {
        if (season) return path.join(DATA_DIR, 'seasons', season, '*.json');
        return path.join(DATA_DIR, 'seasons', '*', '*.json');
    },

    // Vechi (symlink-uri active)
    oldSeasonFile(league, season) {
        return path.join(DATA_DIR, 'seasons', `complete_FULL_SEASON_${league}_${season}.json`);
    },

    getDailyDir(date) {
        if (!date) {
            const now = new Date();
            date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        }
        return path.join(DATA_DIR, 'daily', date);
    },

    getDailyFile(type, date) {
        const dir = paths.getDailyDir(date);
        const map = {
            meciuri: 'meciuri.json',
            verificari: 'verificari.json',
            'final-verificari': 'final-verificari.json',
            collected: 'collected.json',
        };
        return path.join(dir, map[type] || `${type}.json`);
    },

    // Vechi — fișiere zilnice la root (symlink-uri)
    getTodayMatchesFile() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return path.join(BASE_DIR, `meciuri-${y}-${m}-${d}.json`);
    },

    ensureDirs() {
        [paths.seasons, paths.procente, paths.daily, paths.tracking, paths.streaks, paths.logs].forEach(dir => {
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        });
    },
};

// ═══════════════════════════════════════════════════════
// PRAGURI ȘI PENALIZĂRI
// ═══════════════════════════════════════════════════════

const thresholds = {
    // Penalizări
    xgPenalty: 10,           // +10% dacă xG > 0 și < 0.5
    tierPenaltyHigh: 5,      // +5% LOW vs TOP
    tierPenaltyMid: 3,       // +3% LOW vs MID / MID vs TOP

    // Praguri per categorie ligă
    european: 70,
    veryWeak: 85,
    weak: 80,
    standard: 75,

    // Ligi foarte slabe (rata gol R2 < 65%)
    veryWeakLeagues: [
        'NORWAY: Eliteserien',
        'Eliteserien',
    ],

    // Ligi sub-medie (rata gol R2 65-75%)
    weakLeagues: [
        'BELGIUM',
        'ARGENTINA',
        'ROMANIA: Superliga',
        'ENGLAND: Championship',
        'GREECE',
        'PORTUGAL: Liga Portugal',
        'ITALY: Serie A',
        'BRAZIL: Serie A',
    ],

    // Competiții europene
    europeanCompetitions: [
        'Champions League',
        'Europa League',
        'Conference League',
    ],

    /**
     * Determină pragul minim pentru o ligă
     */
    getMinimum(leagueName) {
        if (!leagueName) return thresholds.standard;

        const isEuropean = thresholds.europeanCompetitions.some(c => leagueName.includes(c));
        if (isEuropean) return thresholds.european;

        const isVeryWeak = thresholds.veryWeakLeagues.some(w => leagueName.includes(w));
        if (isVeryWeak) return thresholds.veryWeak;

        const isWeak = thresholds.weakLeagues.some(w => leagueName.includes(w));
        if (isWeak) return thresholds.weak;

        return thresholds.standard;
    },

    /**
     * Penalizare diferență tier
     */
    getTierPenalty(teamTier, opponentTier) {
        function rank(t) {
            if (!t) return 2;
            const u = t.toUpperCase();
            if (u.includes('TOP')) return 3;
            if (u.includes('MID') || u.includes('MIDDLE')) return 2;
            return 1;
        }
        const diff = rank(opponentTier) - rank(teamTier);
        if (diff >= 2) return thresholds.tierPenaltyHigh;
        if (diff >= 1) return thresholds.tierPenaltyMid;
        return 0;
    },
};

// ═══════════════════════════════════════════════════════
// LIGI ȘI ECHIPE
// ═══════════════════════════════════════════════════════

const leagues = {
    // TOP 30 campionate (whitelist)
    topLeagues: [
        'premier league', 'la liga', 'laliga', 'serie a', 'bundesliga',
        '2. bundesliga', 'ligue 1', 'eredivisie', 'primeira liga', 'liga portugal',
        'austrian bundesliga', 'austria bundesliga', 'superliga', 'cyprus league',
        'cyprus first division', 'championship', 'scottish premiership',
        'super lig', 'brasileirao', 'liga profesional', 'primera division',
        'mls', 'jupiler pro league', 'pro league', 'super league', 'superligaen',
        'eliteserien', 'allsvenskan', 'ekstraklasa', 'super liga', 'first league',
        'greek super league', 'super league 1',
        'champions league', 'europa league', 'conference league',
        'copa libertadores', 'copa sudamericana',
    ],

    // Blacklist echipe/ligi
    leagueBlacklist: [
        'u21', 'u19', 'u18', 'u17', 'under ', 'youth', 'reserve', ' ii', ' b ',
        'women', ' w ', 'next pro', 'usl ', 'serie c', 'serie d',
        'premier league 2', 'liga portugal 2', 'challenger pro league',
        'paulista a2', 'paulista a3', 'paulista a4', 'super league 2',
        'laliga2', 'la liga 2',
        'afc champions league', 'afc champions league 2', 'afc champions league elite',
        'gulf club champions', 'afc cup', 'asean club championship', 'afc ', 'asia: ',
    ],

    // Perechi validate (țară + ligă)
    validPairs: [
        { country: 'england', league: 'premier league' },
        { country: 'england', league: 'championship' },
        { country: 'spain', league: 'laliga' }, { country: 'spain', league: 'la liga' },
        { country: 'italy', league: 'serie a' },
        { country: 'germany', league: 'bundesliga' },
        { country: 'france', league: 'ligue 1' },
        { country: 'netherlands', league: 'eredivisie' },
        { country: 'portugal', league: 'liga portugal' }, { country: 'portugal', league: 'primeira liga' },
        { country: 'turkey', league: 'super lig' },
        { country: 'belgium', league: 'jupiler pro league' }, { country: 'belgium', league: 'pro league' },
        { country: 'scotland', league: 'premiership' },
        { country: 'austria', league: 'bundesliga' },
        { country: 'denmark', league: 'superliga' },
        { country: 'sweden', league: 'allsvenskan' },
        { country: 'norway', league: 'eliteserien' },
        { country: 'poland', league: 'ekstraklasa' },
        { country: 'romania', league: 'superliga' },
        { country: 'serbia', league: 'super liga' },
        { country: 'croatia', league: 'first' },
        { country: 'greece', league: 'super league' },
        { country: 'switzerland', league: 'super league' },
        { country: 'brazil', league: 'serie a' }, { country: 'brazil', league: 'brasileirao' },
        { country: 'brazil', league: 'primeira liga' }, { country: 'brazil', league: 'paulista' },
        { country: 'argentina', league: 'primera division' },
        { country: 'argentina', league: 'liga profesional' }, { country: 'argentina', league: 'superliga' },
        { country: 'europe', league: 'champions league' },
        { country: 'europe', league: 'europa league' },
        { country: 'europe', league: 'conference league' },
        { country: 'south america', league: 'copa libertadores' },
        { country: 'south america', league: 'copa sudamericana' },
        { country: 'usa', league: 'mls' },
    ],

    /**
     * Verifică dacă o ligă e în top 30
     */
    isTopLeague(leagueName) {
        if (!leagueName) return false;
        const n = leagueName.toLowerCase();

        for (const blocked of leagues.leagueBlacklist) {
            if (n.includes(blocked)) return false;
        }

        for (const pair of leagues.validPairs) {
            if (n.includes(pair.country) && n.includes(pair.league)) return true;
        }

        return false;
    },

    // România playoff/playout 2025-2026
    romaniaPlayoffTeams: [
        'U. Cluj', 'CFR Cluj', 'Dinamo Bucuresti', 'Dinamo',
        'FC Rapid Bucuresti', 'Rapid Bucuresti',
        'FC Arges', 'Univ. Craiova', 'Universitatea Craiova',
    ],

    romaniaPlayoutTeams: [
        'FCSB', 'UTA Arad', 'UTA', 'FC Hermannstadt', 'Hermannstadt',
        'FC Botosani', 'Botosani', 'Unirea Slobozia', 'Slobozia',
        'Otelul', 'Otelul Galati', 'Csikszereda', 'Csikszereda M. Ciuc',
        'Farul Constanta', 'Farul', 'Petrolul', 'Petrolul Ploiesti',
        'Metaloglobus', 'Metaloglobus Bucharest',
    ],

    /**
     * Corectează numele ligii pentru meciuri România post-sezon regulat
     */
    fixRomaniaLeagueName(leagueName, homeTeam, awayTeam) {
        if (!leagueName.toLowerCase().includes('romania')) return leagueName;
        if (!leagueName.toLowerCase().includes('relegation') && !leagueName.toLowerCase().includes('championship')) return leagueName;

        const homeIsPlayoff = leagues.romaniaPlayoffTeams.some(t => homeTeam.includes(t) || t.includes(homeTeam));
        const awayIsPlayoff = leagues.romaniaPlayoffTeams.some(t => awayTeam.includes(t) || t.includes(awayTeam));
        if (homeIsPlayoff && awayIsPlayoff) return 'ROMANIA: Superliga - Championship Group';

        const homeIsPlayout = leagues.romaniaPlayoutTeams.some(t => homeTeam.includes(t) || t.includes(homeTeam));
        const awayIsPlayout = leagues.romaniaPlayoutTeams.some(t => awayTeam.includes(t) || t.includes(awayTeam));
        if (homeIsPlayout && awayIsPlayout) return 'ROMANIA: Superliga - Relegation Group';

        return leagueName;
    },
};

// ═══════════════════════════════════════════════════════
// TIMING-URI
// ═══════════════════════════════════════════════════════

const timing = {
    monitorCheckInterval: 60 * 1000,           // 1 minut — STATS_MONITOR
    oddsCheckInterval: 2 * 60 * 1000,          // 2 minute — ODDS_MONITOR
    healthCheckInterval: 3 * 60 * 1000,        // 3 minute — WATCHDOG
    heartbeatInterval: 3 * 60 * 60 * 1000,     // 3 ore — WATCHDOG
    autoValidateInterval: 6 * 60 * 60,         // 6 ore (secunde) — AUTO_VALIDATOR
    minMatchAgeHours: 3,                        // Minim 3 ore pentru validare
    maxRestartsPerHour: 2,                      // WATCHDOG
    htOffset: 53,                               // +53 min — verificare HT
    ftOffset: 120,                              // +120 min — verificare FT
    refreshHour: 13,                            // Ora refresh meciuri
    playoffDiscoveryHour: 8,                    // Ora playoff discovery (minut 5-8)
    dailyReportHour: 8,                         // Ora raport zilnic
};

// ═══════════════════════════════════════════════════════
// LEAGUE FILE MAPPING (CHAMPIONSHIP_JSON_MANAGER)
// ═══════════════════════════════════════════════════════

const leagueFileMapping = {
    'ENGLAND: Premier League': 'PremierLeague',
    'Premier League': 'PremierLeague',
    'SPAIN: LaLiga': 'LaLiga',
    'La Liga': 'LaLiga',
    'LaLiga': 'LaLiga',
    'ITALY: Serie A': 'SerieA',
    'Serie A': 'SerieA',
    'GERMANY: Bundesliga': 'Bundesliga',
    'Bundesliga': 'Bundesliga',
    'FRANCE: Ligue 1': 'Ligue1',
    'Ligue 1': 'Ligue1',
    'PORTUGAL: Liga Portugal': 'PrimeiraLiga',
    'Primeira Liga': 'PrimeiraLiga',
    'NETHERLANDS: Eredivisie': 'Eredivisie',
    'Eredivisie': 'Eredivisie',
    'DENMARK: Superliga': 'Superliga',
    'Superliga': 'Superliga',
    'NORWAY: Eliteserien': 'Eliteserien',
    'Eliteserien': 'Eliteserien',
    'EUROPE: Champions League': 'ChampionsLeague',
    'EUROPE: Champions League - League phase': 'ChampionsLeague',
    'Champions League': 'ChampionsLeague',
    'EUROPE: Europa League': 'EuropaLeague',
    'EUROPE: Europa League - League phase': 'EuropaLeague',
    'Europa League': 'EuropaLeague',
    'EUROPE: Conference League': 'ConferenceLeague',
    'EUROPE: Conference League - League phase': 'ConferenceLeague',
    'Conference League': 'ConferenceLeague',
    'ROMANIA: Superliga': 'ROMANIASuperliga',
    'ROMANIA: Superliga - Championship Group': 'ROMANIASuperligaChampionshipGroup',
    'ROMANIA: Superliga - Relegation Group': 'ROMANIASuperligaRelegationGroup',
};

/**
 * Normalizează numele ligii la un identificator de fișier
 */
function normalizeLeagueName(leagueName) {
    if (leagueFileMapping[leagueName]) return leagueFileMapping[leagueName];
    return leagueName.replace(/[^a-zA-Z0-9]/g, '').trim() || 'UnknownLeague';
}

module.exports = {
    paths,
    thresholds,
    leagues,
    timing,
    leagueFileMapping,
    normalizeLeagueName,
};
