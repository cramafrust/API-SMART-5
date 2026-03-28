/**
 * WINNING_STREAK - Detectează serii de victorii consecutive și calculează probabilitatea continuării
 *
 * Folosit ca boost de credibilitate în notificări email.
 * Calculează per campionat (nu global) - ratele diferă semnificativ între ligi.
 * Se afișează DOAR dacă rata >= 70% și eșantionul >= 5.
 */

const fs = require('fs');
const path = require('path');

const SEASONS_DIR = path.join(__dirname, 'data', 'seasons');

// Reutilizăm din POSITION_FALLBACK
const { leagueToFilePattern, normalizeName } = (() => {
    const mod = require('./POSITION_FALLBACK');
    // normalizeName nu e exportat, o reimplementăm
    function normalizeName(name) {
        if (!name) return '';
        let n = name.toLowerCase().trim().replace(/\s+/g, ' ');
        const prefixes = ['fc ', 'fk ', 'cs ', 'csm ', 'fcv ', 'fcs ', 'afc ', 'sc ', 'as ', 'ac ', 'cf '];
        for (const p of prefixes) { if (n.startsWith(p)) n = n.substring(p.length); }
        const suffixes = [' fc', ' fk', ' cs'];
        for (const s of suffixes) { if (n.endsWith(s)) n = n.substring(0, n.length - s.length); }
        return n.trim();
    }

    // leagueToFilePattern - copie din POSITION_FALLBACK (nu e exportată)
    function leagueToFilePattern(leagueName) {
        if (!leagueName) return null;
        const l = leagueName.toLowerCase();
        if (l.includes('premier league')) return 'PremierLeague';
        if (l.includes('la liga') && !l.includes('2')) return 'LaLiga';
        if (l.includes('serie a') && l.includes('italy')) return 'SerieA';
        if (l.includes('serie a') && !l.includes('brazil')) return 'SerieA';
        if (l.includes('bundesliga') && !l.includes('2.') && !l.includes('austria')) return 'Bundesliga';
        if (l.includes('ligue 1')) return 'Ligue1';
        if (l.includes('eredivisie')) return 'Eredivisie';
        if (l.includes('championship')) return 'ENGLANDChampionship';
        if (l.includes('champions league')) return 'ChampionsLeague';
        if (l.includes('europa league')) return 'EuropaLeague';
        if (l.includes('conference league')) return 'ConferenceLeague';
        if (l.includes('superliga') && l.includes('roman')) return 'ROMANIASuperliga';
        if (l.includes('super lig') && l.includes('turk')) return 'TURKEYSuperLig';
        if (l.includes('primeira liga') || l.includes('liga portugal')) return 'PrimeiraLiga';
        if (l.includes('super league') && l.includes('swiss')) return 'SWITZERLANDSuperLeague';
        if (l.includes('super league') && l.includes('greece')) return 'GREECESuperLeague';
        if (l.includes('ekstraklasa')) return 'POLANDEkstraklasa';
        if (l.includes('2. bundesliga')) return 'GERMANY2Bundesliga';
        if (l.includes('la liga 2') || l.includes('laliga2')) return 'SPAINLaLiga2';
        if (l.includes('allsvenskan')) return 'SWEDENAllsvenskan';
        if (l.includes('eliteserien')) return 'Eliteserien';
        if (l.includes('jupiler')) return 'BELGIUMJupilerProLeague';
        if (l.includes('mozzart') || l.includes('serbia')) return 'SERBIAMozzartBetSuperLiga';
        if (l.includes('bundesliga') && l.includes('austria')) return 'AUSTRIABundesliga';
        if (l.includes('superliga') && l.includes('denmark')) return 'Superliga';
        if (l.includes('mls')) return 'USAMLS';
        if (l.includes('premiership') && l.includes('scot')) return 'SCOTLANDPremiership';
        if (l.includes('scottish')) return 'SCOTLANDPremiership';
        return null;
    }

    return { leagueToFilePattern, normalizeName };
})();

// Cache
let streakCache = {};
let statsCache = {};
let cacheTimestamp = 0;
const CACHE_TTL = 3600000; // 1 oră

function clearCacheIfExpired() {
    if (Date.now() - cacheTimestamp > CACHE_TTL) {
        streakCache = {};
        statsCache = {};
        cacheTimestamp = Date.now();
    }
}

/**
 * Încarcă meciurile dintr-un campionat, sortate cronologic
 */
function loadLeagueMatches(filePattern) {
    const cacheKey = `matches:${filePattern}`;
    if (streakCache[cacheKey]) return streakCache[cacheKey];

    try {
        const files = fs.readdirSync(SEASONS_DIR)
            .filter(f => f.includes(filePattern) && f.endsWith('.json') &&
                !f.includes('BACKUP') && !f.includes('OLD_FORMAT') && !f.includes('pre-'))
            .sort(); // Cronologic

        let allMatches = [];
        let totalTeams = null;

        for (const f of files) {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8'));
                const meciuri = (data.meciuri || []).filter(m =>
                    m.scor && m.scor.final_gazda !== null && m.scor.final_gazda !== undefined &&
                    m.echipa_gazda && m.echipa_oaspete
                );
                allMatches = allMatches.concat(meciuri);
                if (data.liga && data.liga.numar_echipe) totalTeams = data.liga.numar_echipe;
            } catch (e) { continue; }
        }

        // Sortare cronologică
        allMatches.sort((a, b) => {
            const dateA = a.data_ora ? a.data_ora.data : '';
            const dateB = b.data_ora ? b.data_ora.data : '';
            return dateA.localeCompare(dateB);
        });

        const result = { matches: allMatches, totalTeams };
        streakCache[cacheKey] = result;
        return result;
    } catch (e) {
        return { matches: [], totalTeams: null };
    }
}

/**
 * Verifică dacă o echipă e în top 50% al clasamentului la momentul meciului
 */
function isTopHalf(match, side) {
    if (side === 'gazda') {
        const pos = match.pozitie_clasament_gazda || (match.echipa_gazda && match.echipa_gazda.pozitie_clasament_inainte);
        const tier = match.tier_gazda;
        if (tier) return tier.startsWith('TOP') || tier.startsWith('MID');
        return pos && pos <= 10; // fallback
    } else {
        const pos = match.pozitie_clasament_oaspete || (match.echipa_oaspete && match.echipa_oaspete.pozitie_clasament_inainte);
        const tier = match.tier_oaspete;
        if (tier) return tier.startsWith('TOP') || tier.startsWith('MID');
        return pos && pos <= 10;
    }
}

/**
 * Obține seria curentă de victorii consecutive a unei echipe
 *
 * @param {string} leagueName - Numele ligii
 * @param {string} teamName - Numele echipei
 * @returns {{ currentWinStreak: number }} - 0 dacă nu e pe serie
 */
function getTeamStreak(leagueName, teamName) {
    clearCacheIfExpired();

    const filePattern = leagueToFilePattern(leagueName);
    if (!filePattern) return { currentWinStreak: 0 };

    const normalizedTeam = normalizeName(teamName);
    const cacheKey = `streak:${filePattern}:${normalizedTeam}`;
    if (streakCache[cacheKey] !== undefined) return streakCache[cacheKey];

    const { matches } = loadLeagueMatches(filePattern);
    if (matches.length === 0) return { currentWinStreak: 0 };

    // Găsim meciurile echipei, cronologic
    const teamMatches = matches.filter(m => {
        const homeN = normalizeName(m.echipa_gazda.nume);
        const awayN = normalizeName(m.echipa_oaspete.nume);
        return homeN === normalizedTeam || awayN === normalizedTeam ||
            (m.echipa_gazda.nume && normalizedTeam.includes(homeN)) ||
            (m.echipa_gazda.nume && homeN.includes(normalizedTeam)) ||
            (m.echipa_oaspete.nume && normalizedTeam.includes(awayN)) ||
            (m.echipa_oaspete.nume && awayN.includes(normalizedTeam));
    });

    // Numărăm seria de la coada spre cap
    let streak = 0;
    for (let i = teamMatches.length - 1; i >= 0; i--) {
        const m = teamMatches[i];
        const homeN = normalizeName(m.echipa_gazda.nume);
        const isHome = homeN === normalizedTeam ||
            (m.echipa_gazda.nume && normalizedTeam.includes(homeN)) ||
            (m.echipa_gazda.nume && homeN.includes(normalizedTeam));

        const won = isHome
            ? m.scor.final_gazda > m.scor.final_oaspete
            : m.scor.final_oaspete > m.scor.final_gazda;

        if (won) {
            streak++;
        } else {
            break;
        }
    }

    const result = { currentWinStreak: streak };
    streakCache[cacheKey] = result;
    return result;
}

/**
 * Calculează statisticile seriilor de victorii PER CAMPIONAT
 * Din câte serii de N victorii consecutive (echipe top 50%), câte au continuat cu victorie
 *
 * @param {string} leagueName - Numele ligii
 * @param {number} streakLength - Lungimea seriei (ex: 4, 5, 6)
 * @returns {{ won: number, total: number, rate: number } | null} - null dacă rata < 70% sau eșantion < 5
 */
function getStreakStats(leagueName, streakLength) {
    clearCacheIfExpired();

    const filePattern = leagueToFilePattern(leagueName);
    if (!filePattern) return null;

    const cacheKey = `stats:${filePattern}:${streakLength}`;
    if (statsCache[cacheKey] !== undefined) return statsCache[cacheKey];

    const { matches } = loadLeagueMatches(filePattern);
    if (matches.length === 0) { statsCache[cacheKey] = null; return null; }

    // Colectăm toate echipele unice
    const teams = new Set();
    for (const m of matches) {
        teams.add(normalizeName(m.echipa_gazda.nume));
        teams.add(normalizeName(m.echipa_oaspete.nume));
    }

    let totalStreaks = 0;
    let continuedWin = 0;

    for (const team of teams) {
        // Meciurile echipei, cronologic
        const teamMatches = matches.filter(m => {
            const homeN = normalizeName(m.echipa_gazda.nume);
            const awayN = normalizeName(m.echipa_oaspete.nume);
            return homeN === team || awayN === team;
        });

        // Parcurgem și detectăm serii de exact streakLength victorii
        let currentStreak = 0;
        for (let i = 0; i < teamMatches.length; i++) {
            const m = teamMatches[i];
            const homeN = normalizeName(m.echipa_gazda.nume);
            const isHome = homeN === team;

            // Verificăm top 50%
            if (!isTopHalf(m, isHome ? 'gazda' : 'oaspete')) {
                currentStreak = 0;
                continue;
            }

            const won = isHome
                ? m.scor.final_gazda > m.scor.final_oaspete
                : m.scor.final_oaspete > m.scor.final_gazda;

            if (won) {
                currentStreak++;

                // Dacă am atins exact lungimea dorită, verificăm următorul meci
                if (currentStreak === streakLength && i + 1 < teamMatches.length) {
                    const next = teamMatches[i + 1];
                    const nextHomeN = normalizeName(next.echipa_gazda.nume);
                    const nextIsHome = nextHomeN === team;
                    const nextWon = nextIsHome
                        ? next.scor.final_gazda > next.scor.final_oaspete
                        : next.scor.final_oaspete > next.scor.final_gazda;

                    totalStreaks++;
                    if (nextWon) continuedWin++;
                }
            } else {
                currentStreak = 0;
            }
        }
    }

    if (totalStreaks < 5) {
        statsCache[cacheKey] = null;
        return null;
    }

    const rate = Math.round((continuedWin / totalStreaks) * 1000) / 10; // 1 zecimală

    if (rate < 70) {
        statsCache[cacheKey] = null;
        return null;
    }

    const result = { won: continuedWin, total: totalStreaks, rate };
    statsCache[cacheKey] = result;
    return result;
}

// ============================================================
// SCORING STREAK — serie de meciuri consecutive cu 2+ goluri
// ============================================================

// Încarcă probabilitățile pre-calculate
let scoringStreakProbs = null;
function loadScoringStreakProbs() {
    if (scoringStreakProbs) return scoringStreakProbs;
    try {
        scoringStreakProbs = JSON.parse(
            fs.readFileSync(path.join(__dirname, 'data', 'scoring_streak_probabilities.json'), 'utf8')
        );
    } catch (e) {
        scoringStreakProbs = { global: {}, perLeague: {} };
    }
    return scoringStreakProbs;
}

/**
 * Obține seria curentă de meciuri consecutive cu 2+ goluri marcate
 *
 * @param {string} leagueName - Numele ligii
 * @param {string} teamName - Numele echipei
 * @returns {{ currentScoringStreak: number }} - 0 dacă nu e pe serie
 */
function getScoringStreak(leagueName, teamName) {
    clearCacheIfExpired();

    const filePattern = leagueToFilePattern(leagueName);
    if (!filePattern) return { currentScoringStreak: 0 };

    const normalizedTeam = normalizeName(teamName);
    const cacheKey = `scoringStreak:${filePattern}:${normalizedTeam}`;
    if (streakCache[cacheKey] !== undefined) return streakCache[cacheKey];

    const { matches } = loadLeagueMatches(filePattern);
    if (matches.length === 0) return { currentScoringStreak: 0 };

    // Meciurile echipei, cronologic
    const teamMatches = matches.filter(m => {
        const homeN = normalizeName(m.echipa_gazda.nume);
        const awayN = normalizeName(m.echipa_oaspete.nume);
        return homeN === normalizedTeam || awayN === normalizedTeam ||
            (m.echipa_gazda.nume && normalizedTeam.includes(homeN)) ||
            (m.echipa_gazda.nume && homeN.includes(normalizedTeam)) ||
            (m.echipa_oaspete.nume && normalizedTeam.includes(awayN)) ||
            (m.echipa_oaspete.nume && awayN.includes(normalizedTeam));
    });

    // Numărăm seria de la coada spre cap (2+ goluri per meci)
    let streak = 0;
    for (let i = teamMatches.length - 1; i >= 0; i--) {
        const m = teamMatches[i];
        const homeN = normalizeName(m.echipa_gazda.nume);
        const isHome = homeN === normalizedTeam ||
            (m.echipa_gazda.nume && normalizedTeam.includes(homeN)) ||
            (m.echipa_gazda.nume && homeN.includes(normalizedTeam));

        const goals = isHome ? m.scor.final_gazda : m.scor.final_oaspete;

        if (goals >= 2) {
            streak++;
        } else {
            break;
        }
    }

    const result = { currentScoringStreak: streak };
    streakCache[cacheKey] = result;
    return result;
}

/**
 * Obține probabilitatea ca echipa să marcheze 1+ gol în următorul meci,
 * având o serie de N meciuri consecutive cu 2+ goluri.
 *
 * Prioritate: date per campionat > date globale.
 * Încearcă seria exactă (5, 4, 3), ia prima care are date.
 *
 * @param {string} leagueName - Numele ligii (format din API, ex: "ENGLAND: Premier League")
 * @param {number} streakLength - Lungimea seriei curente (3, 4, 5+)
 * @param {string} tier - Tier-ul echipei: 'TOP', 'MID', 'LOW'
 * @returns {{ scored: number, total: number, rate: number, streakUsed: number, source: string } | null}
 */
function getScoringStreakStats(leagueName, streakLength, tier) {
    if (streakLength < 3) return null;

    const probs = loadScoringStreakProbs();
    if (!probs) return null;

    // Normalizăm tier-ul
    let normalizedTier = tier || 'MID';
    if (normalizedTier.startsWith('TOP')) normalizedTier = 'TOP';
    else if (normalizedTier.startsWith('MID')) normalizedTier = 'MID';
    else if (normalizedTier.startsWith('LOW')) normalizedTier = 'LOW';

    // Încearcă de la seria cea mai lungă (cap la 5) spre cea mai scurtă (3)
    const maxStreak = Math.min(streakLength, 5);

    for (let n = maxStreak; n >= 3; n--) {
        const key = n + 'W';

        // 1. Încearcă per campionat
        // Trebuie să potrivim leagueName din API cu cheile din JSON
        for (const [jsonLeague, streaks] of Object.entries(probs.perLeague || {})) {
            if (leagueNamesMatch(leagueName, jsonLeague)) {
                const tierData = streaks[key] && streaks[key][normalizedTier];
                if (tierData && tierData.total >= 5 && tierData.rate >= 70) {
                    return {
                        scored: tierData.scored,
                        total: tierData.total,
                        rate: tierData.rate,
                        streakUsed: n,
                        source: 'league'
                    };
                }
            }
        }

        // 2. Fallback pe global
        const globalData = probs.global[key] && probs.global[key][normalizedTier];
        if (globalData && globalData.total >= 5 && globalData.rate >= 70) {
            return {
                scored: globalData.scored,
                total: globalData.total,
                rate: globalData.rate,
                streakUsed: n,
                source: 'global'
            };
        }
    }

    return null;
}

/**
 * Compară numele ligilor (API vs JSON key)
 */
function leagueNamesMatch(apiName, jsonName) {
    if (!apiName || !jsonName) return false;
    const a = apiName.toLowerCase();
    const b = jsonName.toLowerCase();
    // Potrivire exactă sau conținere parțială
    if (a === b) return true;
    // "ENGLAND: Premier League" vs "ENGLAND: Premier League"
    if (a.includes(b) || b.includes(a)) return true;
    // Extrage doar partea de după ":"
    const aPart = a.includes(':') ? a.split(':')[1].trim() : a;
    const bPart = b.includes(':') ? b.split(':')[1].trim() : b;
    return aPart === bPart;
}

// ============================================================
// GOAL STREAK — serie de meciuri consecutive cu 1+ gol marcat
// ============================================================

let goalStreakProbs = null;
function loadGoalStreakProbs() {
    if (goalStreakProbs) return goalStreakProbs;
    try {
        goalStreakProbs = JSON.parse(
            fs.readFileSync(path.join(__dirname, 'data', 'goal_streak_probabilities.json'), 'utf8')
        );
    } catch (e) {
        goalStreakProbs = { global: {}, perLeague: {} };
    }
    return goalStreakProbs;
}

/**
 * Obține seria curentă de meciuri consecutive cu 1+ gol marcat
 *
 * @param {string} leagueName - Numele ligii
 * @param {string} teamName - Numele echipei
 * @returns {{ currentGoalStreak: number }} - 0 dacă nu e pe serie
 */
function getGoalStreak(leagueName, teamName) {
    clearCacheIfExpired();

    const filePattern = leagueToFilePattern(leagueName);
    if (!filePattern) return { currentGoalStreak: 0 };

    const normalizedTeam = normalizeName(teamName);
    const cacheKey = `goalStreak:${filePattern}:${normalizedTeam}`;
    if (streakCache[cacheKey] !== undefined) return streakCache[cacheKey];

    const { matches } = loadLeagueMatches(filePattern);
    if (matches.length === 0) return { currentGoalStreak: 0 };

    const teamMatches = matches.filter(m => {
        const homeN = normalizeName(m.echipa_gazda.nume);
        const awayN = normalizeName(m.echipa_oaspete.nume);
        return homeN === normalizedTeam || awayN === normalizedTeam ||
            (m.echipa_gazda.nume && normalizedTeam.includes(homeN)) ||
            (m.echipa_gazda.nume && homeN.includes(normalizedTeam)) ||
            (m.echipa_oaspete.nume && normalizedTeam.includes(awayN)) ||
            (m.echipa_oaspete.nume && awayN.includes(normalizedTeam));
    });

    let streak = 0;
    for (let i = teamMatches.length - 1; i >= 0; i--) {
        const m = teamMatches[i];
        const homeN = normalizeName(m.echipa_gazda.nume);
        const isHome = homeN === normalizedTeam ||
            (m.echipa_gazda.nume && normalizedTeam.includes(homeN)) ||
            (m.echipa_gazda.nume && homeN.includes(normalizedTeam));

        const goals = isHome ? m.scor.final_gazda : m.scor.final_oaspete;

        if (goals >= 1) {
            streak++;
        } else {
            break;
        }
    }

    const result = { currentGoalStreak: streak };
    streakCache[cacheKey] = result;
    return result;
}

/**
 * Obține probabilitatea ca echipa să marcheze 1+ gol în următorul meci,
 * având o serie de N meciuri consecutive cu 1+ gol.
 *
 * Prioritate: date per campionat > date globale.
 * Încearcă seria exactă (10, 9, ..., 5), ia prima care are date.
 *
 * @param {string} leagueName - Numele ligii
 * @param {number} streakLength - Lungimea seriei curente (5+)
 * @param {string} tier - Tier-ul echipei
 * @returns {{ scored: number, total: number, rate: number, streakUsed: number, source: string } | null}
 */
function getGoalStreakStats(leagueName, streakLength, tier) {
    if (streakLength < 5) return null;

    const probs = loadGoalStreakProbs();
    if (!probs) return null;

    let normalizedTier = tier || 'MID';
    if (normalizedTier.startsWith('TOP')) normalizedTier = 'TOP';
    else if (normalizedTier.startsWith('MID')) normalizedTier = 'MID';
    else if (normalizedTier.startsWith('LOW')) normalizedTier = 'LOW';

    const maxStreak = Math.min(streakLength, 10);

    for (let n = maxStreak; n >= 5; n--) {
        const key = n + 'W';

        // 1. Per campionat
        for (const [jsonLeague, streaks] of Object.entries(probs.perLeague || {})) {
            if (leagueNamesMatch(leagueName, jsonLeague)) {
                const tierData = streaks[key] && streaks[key][normalizedTier];
                if (tierData && tierData.total >= 5 && tierData.rate >= 70) {
                    return {
                        scored: tierData.scored,
                        total: tierData.total,
                        rate: tierData.rate,
                        streakUsed: n,
                        source: 'league'
                    };
                }
            }
        }

        // 2. Global
        const globalData = probs.global[key] && probs.global[key][normalizedTier];
        if (globalData && globalData.total >= 5 && globalData.rate >= 70) {
            return {
                scored: globalData.scored,
                total: globalData.total,
                rate: globalData.rate,
                streakUsed: n,
                source: 'global'
            };
        }
    }

    return null;
}

/**
 * Curăță cache-ul manual
 */
function clearCache() {
    streakCache = {};
    statsCache = {};
    scoringStreakProbs = null;
    goalStreakProbs = null;
    cacheTimestamp = Date.now();
}

module.exports = {
    getTeamStreak, getStreakStats,
    getScoringStreak, getScoringStreakStats,
    getGoalStreak, getGoalStreakStats,
    clearCache, leagueToFilePattern, normalizeName
};
