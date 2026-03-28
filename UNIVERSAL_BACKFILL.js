#!/usr/bin/env node
/**
 * UNIVERSAL_BACKFILL.js
 *
 * Completare automata meciuri lipsa din toate campionatele urmarite.
 *
 * Abordare in 2 faze:
 *   Faza 1 (Puppeteer): Scrape pagina FlashScore results -> extrage matchId-uri
 *   Faza 2 (HTTP API):  Pentru fiecare matchId NOU, extrage statistici via API
 *
 * Protectii:
 *   - Validare stricta date (fara NULL, 0, valori lipsa)
 *   - Pauza cand sunt meciuri live in desfasurare
 *   - Resurse limitate (max 1 browser, CPU/RAM check)
 *   - Comportament uman (delays, scroll, UA rotativ)
 *   - State management (reluare din punctul unde s-a oprit)
 *
 * USAGE:
 *   node UNIVERSAL_BACKFILL.js                              # Discover + extract 50 meciuri
 *   node UNIVERSAL_BACKFILL.js --phase=1                    # Doar discover matchIds
 *   node UNIVERSAL_BACKFILL.js --phase=2 --batch=100        # Doar extract, 100 meciuri
 *   node UNIVERSAL_BACKFILL.js --league="SPAIN: LaLiga"     # Un singur campionat
 *   node UNIVERSAL_BACKFILL.js --season=2023-2024           # Un singur sezon
 *   node UNIVERSAL_BACKFILL.js --status                     # Arata progres
 *   node UNIVERSAL_BACKFILL.js --reset                      # Reseteaza state
 */

const fs = require('fs');
const path = require('path');
const { fetchMatchDetails, fetchFromAPI, parseFlashscoreData, fetchLiveMatches } = require('./flashscore-api');
const { parseStatistics, extractScores } = require('./FINAL_STATS_EXTRACTOR');
const { saveMatchData } = require('./CHAMPIONSHIP_JSON_MANAGER');
const { BACKFILL_LEAGUES, buildResultsURL, getSeasonFilePath, getLeaguesByPriority, findLeague } = require('./BACKFILL_LEAGUE_CONFIG');
const memoryThrottle = require('./MEMORY_THROTTLE');

// ═══════════════════════════════════════════════
// CONSTANTE
// ═══════════════════════════════════════════════

const STATE_FILE = path.join(__dirname, 'backfill_state.json');
const DEFAULT_BATCH_SIZE = 50;
const DELAY_BETWEEN_MATCHES_MIN = 3000;  // 3s
const DELAY_BETWEEN_MATCHES_MAX = 5000;  // 5s
const DELAY_LONG_PAUSE = 15000;          // 15s pauza lunga
const DELAY_LONG_PAUSE_MAX = 25000;      // 25s pauza lunga max
const MATCHES_BEFORE_LONG_PAUSE = 15;
const MAX_SHOW_MORE_CLICKS = 30;
const LIVE_CHECK_INTERVAL = 300000;      // Verificare meciuri live la fiecare 5 min

// User-Agents rotativi
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

// Statistici minime pe care le asteptam (case-insensitive matching)
const REQUIRED_STATS_LOWER = ['total shots', 'shots on target', 'corner kicks', 'ball possession', 'fouls'];
const MIN_STATS_COUNT = 4; // Minim 4 din cele 5 categorii trebuie sa aiba valori reale

// ═══════════════════════════════════════════════
// UTILURI
// ═══════════════════════════════════════════════

function randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}

function getRandomUA() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function log(msg) {
    const ts = new Date().toLocaleString('ro-RO');
    console.log(`[${ts}] ${msg}`);
}

function logError(msg) {
    const ts = new Date().toLocaleString('ro-RO');
    console.error(`[${ts}] ${msg}`);
}

// ═══════════════════════════════════════════════
// STATE MANAGEMENT
// ═══════════════════════════════════════════════

function loadState() {
    if (fs.existsSync(STATE_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        } catch (e) {
            logError(`Eroare citire state: ${e.message}`);
        }
    }
    return { leagues: {}, lastRun: null, totalProcessed: 0 };
}

function saveState(state) {
    state.lastRun = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function getLeagueSeasonKey(leagueName, seasonId) {
    return `${leagueName}__${seasonId}`;
}

function getLeagueSeasonState(state, leagueName, seasonId) {
    const key = getLeagueSeasonKey(leagueName, seasonId);
    if (!state.leagues[key]) {
        state.leagues[key] = {
            discoveredIds: [],
            discoveredMatches: {},  // matchId -> { home, away } (echipe din DOM)
            processedIds: [],
            failedIds: [],
            lastDiscovery: null,
            lastProcessing: null
        };
    }
    // Migrare: adauga discoveredMatches daca lipseste
    if (!state.leagues[key].discoveredMatches) {
        state.leagues[key].discoveredMatches = {};
    }
    return state.leagues[key];
}

// ═══════════════════════════════════════════════
// EXISTING MATCH IDs - Citeste din JSON-urile existente
// ═══════════════════════════════════════════════

function getExistingMatchIds(seasonFilePath) {
    const existingIds = new Set();
    if (!fs.existsSync(seasonFilePath)) {
        return existingIds;
    }

    try {
        const data = JSON.parse(fs.readFileSync(seasonFilePath, 'utf8'));
        if (data.meciuri && Array.isArray(data.meciuri)) {
            for (const match of data.meciuri) {
                if (match.id_flashscore) {
                    existingIds.add(match.id_flashscore);
                }
                if (match.id_meci) {
                    existingIds.add(match.id_meci);
                }
            }
        }
    } catch (e) {
        logError(`Eroare citire JSON ${seasonFilePath}: ${e.message}`);
    }

    return existingIds;
}

// ═══════════════════════════════════════════════
// LIVE MATCH CHECK - Pauza DOAR cand sunt meciuri din ligile NOASTRE in desfasurare
// ═══════════════════════════════════════════════

let lastLiveCheck = 0;
let cachedLiveStatus = false;

async function areOurMatchesLive() {
    const now = Date.now();

    // Cache verificarea la fiecare 5 min
    if (now - lastLiveCheck < LIVE_CHECK_INTERVAL) {
        return cachedLiveStatus;
    }

    try {
        // Verificam din fisierul de verificari daca avem meciuri NOASTRE in desfasurare
        const today = new Date().toISOString().split('T')[0];
        const verifFile = path.join(__dirname, `verificari-${today}.json`);
        let ourLiveCount = 0;

        if (fs.existsSync(verifFile)) {
            const verifData = JSON.parse(fs.readFileSync(verifFile, 'utf8'));
            const nowTimestamp = Math.floor(Date.now() / 1000);

            for (const v of (verifData.verificari || [])) {
                // Meciul e "live" daca a inceput (timestamp < now) si nu e completat
                // Si nu a trecut mai mult de 2h de la start (meci terminat dar neverificat)
                const matchStarted = v.timestampStart && nowTimestamp > v.timestampStart;
                const matchNotTooOld = v.timestampStart && (nowTimestamp - v.timestampStart) < 7200; // 2h
                const notCompleted = v.status !== 'completat';

                if (matchStarted && matchNotTooOld && notCompleted) {
                    ourLiveCount++;
                }
            }
        }

        lastLiveCheck = now;
        cachedLiveStatus = ourLiveCount > 0;

        if (cachedLiveStatus) {
            log(`   ${ourLiveCount} meciuri din ligile NOASTRE in desfasurare - PAUZA backfill`);
        }

        return cachedLiveStatus;
    } catch (e) {
        // Daca nu putem verifica, continuam
        return false;
    }
}

async function waitForLiveMatchesToEnd() {
    while (await areOurMatchesLive()) {
        log('   Meciuri din ligile noastre in desfasurare. Astept 5 minute...');
        await new Promise(resolve => setTimeout(resolve, LIVE_CHECK_INTERVAL));
        // Forteaza re-check
        lastLiveCheck = 0;
    }
}

// ═══════════════════════════════════════════════
// VALIDARE STRICTA DATE MECI
// ═══════════════════════════════════════════════

function validateMatchData(matchData, matchId) {
    const issues = [];

    // 1. Verificare echipe - nu null, nu Unknown, nu goale, minim 2 caractere
    const ht = matchData.match.homeTeam;
    const at = matchData.match.awayTeam;
    if (!ht || ht === 'Unknown' || ht.trim().length < 2) {
        issues.push(`Echipa gazda invalida: "${ht}"`);
    }
    if (!at || at === 'Unknown' || at.trim().length < 2) {
        issues.push(`Echipa oaspete invalida: "${at}"`);
    }
    // Echipele nu pot fi identice
    if (ht && at && ht === at) {
        issues.push(`Echipe identice: "${ht}"`);
    }

    // 2. Verificare scor FT - trebuie sa fie numere valide >= 0
    const ftHome = matchData.fulltime.score.home;
    const ftAway = matchData.fulltime.score.away;
    if (ftHome === null || ftHome === undefined || ftAway === null || ftAway === undefined) {
        issues.push('Scor FT null');
    } else {
        const ftH = parseInt(ftHome);
        const ftA = parseInt(ftAway);
        if (isNaN(ftH) || isNaN(ftA) || ftH < 0 || ftA < 0 || ftH > 20 || ftA > 20) {
            issues.push(`Scor FT invalid: ${ftHome}-${ftAway}`);
        }
    }

    // 3. Verificare scor HT - numere valide >= 0 si <= scor FT
    const htHome = matchData.halftime.score.home;
    const htAway = matchData.halftime.score.away;
    if (htHome === null || htHome === undefined || htAway === null || htAway === undefined) {
        issues.push('Scor HT null');
    } else {
        const htH = parseInt(htHome);
        const htA = parseInt(htAway);
        if (isNaN(htH) || isNaN(htA) || htH < 0 || htA < 0 || htH > 20 || htA > 20) {
            issues.push(`Scor HT invalid: ${htHome}-${htAway}`);
        }
        // HT nu poate fi mai mare ca FT
        if (!isNaN(htH) && !isNaN(parseInt(ftHome)) && htH > parseInt(ftHome)) {
            issues.push(`Scor HT gazda (${htH}) > FT (${ftHome})`);
        }
        if (!isNaN(htA) && !isNaN(parseInt(ftAway)) && htA > parseInt(ftAway)) {
            issues.push(`Scor HT oaspete (${htA}) > FT (${ftAway})`);
        }
    }

    // 4. Verificare data meciului - trebuie sa fie valida si in trecut
    if (!matchData.match.date || matchData.match.date === 'Invalid Date') {
        issues.push('Data meciului invalida');
    }

    // 5. Verificare statistici FT - minim 4 categorii cu valori NUMERICE reale
    const ftStats = matchData.fulltime.statistics;
    if (!ftStats || !ftStats.home) {
        issues.push('Statistici FT lipsa complet');
    } else {
        const ftHomeLower = {};
        const ftAwayLower = {};
        for (const [k, v] of Object.entries(ftStats.home)) { ftHomeLower[k.toLowerCase()] = v; }
        for (const [k, v] of Object.entries(ftStats.away)) { ftAwayLower[k.toLowerCase()] = v; }

        let validStatsCount = 0;
        for (const statName of REQUIRED_STATS_LOWER) {
            const homeVal = ftHomeLower[statName];
            const awayVal = ftAwayLower[statName];
            // Valoarea trebuie sa fie un numar valid (nu string gol, nu null, nu NaN)
            const hNum = parseFloat(homeVal);
            const aNum = parseFloat(awayVal);
            if (!isNaN(hNum) && !isNaN(aNum)) {
                validStatsCount++;
            }
        }
        if (validStatsCount < MIN_STATS_COUNT) {
            issues.push(`Doar ${validStatsCount}/${MIN_STATS_COUNT} statistici FT valide`);
        }

        // Verificare posesie - trebuie sa existe si sa dea ~100%
        const posHome = parseFloat(ftHomeLower['ball possession'] || 0);
        const posAway = parseFloat(ftAwayLower['ball possession'] || 0);
        if (posHome === 0 && posAway === 0) {
            issues.push('Posesie 0-0 (date suspecte)');
        }
        if (posHome > 0 && posAway > 0 && Math.abs(posHome + posAway - 100) > 2) {
            issues.push(`Posesie invalida: ${posHome}+${posAway}=${posHome + posAway} (trebuie ~100)`);
        }

        // Verificare ca suturi pe poarta <= total suturi
        const shotsOnTarget = parseInt(ftHomeLower['shots on target'] || 0) + parseInt(ftAwayLower['shots on target'] || 0);
        const totalShots = parseInt(ftHomeLower['total shots'] || 0) + parseInt(ftAwayLower['total shots'] || 0);
        if (totalShots > 0 && shotsOnTarget > totalShots) {
            issues.push(`Suturi pe poarta (${shotsOnTarget}) > total suturi (${totalShots})`);
        }
    }

    // 6. Verificare statistici HT - minim 4 categorii cu valori numerice
    const htStats = matchData.halftime.statistics;
    if (!htStats || !htStats.home) {
        issues.push('Statistici HT lipsa complet');
    } else {
        const htHomeLower = {};
        const htAwayLower = {};
        for (const [k, v] of Object.entries(htStats.home)) { htHomeLower[k.toLowerCase()] = v; }
        for (const [k, v] of Object.entries(htStats.away)) { htAwayLower[k.toLowerCase()] = v; }

        let validHTCount = 0;
        for (const statName of REQUIRED_STATS_LOWER) {
            const hNum = parseFloat(htHomeLower[statName]);
            const aNum = parseFloat(htAwayLower[statName]);
            if (!isNaN(hNum) && !isNaN(aNum)) {
                validHTCount++;
            }
        }
        if (validHTCount < MIN_STATS_COUNT) {
            issues.push(`Doar ${validHTCount}/${MIN_STATS_COUNT} statistici HT valide`);
        }

        // Verificare consistenta HT <= FT pentru statistici cumulative
        if (ftStats && ftStats.home) {
            const ftHomeLower2 = {};
            const ftAwayLower2 = {};
            for (const [k, v] of Object.entries(ftStats.home)) { ftHomeLower2[k.toLowerCase()] = v; }
            for (const [k, v] of Object.entries(ftStats.away)) { ftAwayLower2[k.toLowerCase()] = v; }

            for (const stat of ['corner kicks', 'total shots', 'shots on target', 'fouls', 'yellow cards']) {
                const htVal = parseInt(htHomeLower[stat] || 0) + parseInt(htAwayLower[stat] || 0);
                const ftVal = parseInt(ftHomeLower2[stat] || 0) + parseInt(ftAwayLower2[stat] || 0);
                if (htVal > 0 && ftVal > 0 && htVal > ftVal) {
                    issues.push(`HT ${stat} (${htVal}) > FT (${ftVal})`);
                }
            }
        }
    }

    // 7. Verificare secondhalf - trebuie sa existe
    if (!matchData.secondhalf || !matchData.secondhalf.statistics || !matchData.secondhalf.statistics.home) {
        issues.push('Statistici repriza 2 lipsa');
    }

    if (issues.length > 0) {
        return { valid: false, issues };
    }
    return { valid: true, issues: [] };
}

// ═══════════════════════════════════════════════
// DETERMINARE SEZON DIN DATA
// ═══════════════════════════════════════════════

function matchBelongsToSeason(matchTimestamp, seasonId) {
    if (!matchTimestamp || matchTimestamp === 0) return false; // Fara data = respingem

    const matchDate = new Date(matchTimestamp * 1000);
    const year = matchDate.getFullYear();
    const month = matchDate.getMonth() + 1; // 1-12

    // Sezon cu format "2024-2025"
    if (seasonId.includes('-')) {
        const parts = seasonId.split('-');
        const startYear = parseInt(parts[0]);
        const endYear = parseInt(parts[1]);

        // Sezonul european: iulie startYear -> iunie endYear
        // Ex: "2024-2025" = iulie 2024 - iunie 2025
        if (year === startYear && month >= 7) return true;  // aug-dec anul start
        if (year === endYear && month <= 6) return true;    // ian-iunie anul end

        return false;
    }

    // Sezon calendar (ex: "2024" pentru Brazilia, Norvegia)
    const seasonYear = parseInt(seasonId);
    return year === seasonYear;
}

// ═══════════════════════════════════════════════
// FAZA 1: DISCOVER MATCH IDs (Puppeteer)
// ═══════════════════════════════════════════════

async function discoverMatchIds(leagueConfig, season) {
    const url = buildResultsURL(leagueConfig, season);
    log(`\n   FAZA 1: Discover matchIds pentru ${leagueConfig.name} ${season.id}`);
    log(`   URL: ${url}`);

    let browser = null;
    let page = null;

    try {
        const BrowserPool = require('./BROWSER_POOL');
        browser = await BrowserPool.launchBrowser();
        page = await browser.newPage();

        // Anti-detectie
        const ua = getRandomUA();
        await page.setUserAgent(ua);
        await page.setViewport({ width: 1366 + Math.floor(Math.random() * 200), height: 768 + Math.floor(Math.random() * 100) });

        // Blocare resurse grele (imagini, fonturi, CSS)
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Override webdriver detection
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        });

        // Navigare cu timeout generos
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Asteptare initala - comportament uman
        await randomDelay(2000, 4000);

        // Accept cookies daca apare
        try {
            const cookieBtn = await page.$('#onetrust-accept-btn-handler');
            if (cookieBtn) {
                await cookieBtn.click();
                await randomDelay(1000, 2000);
            }
        } catch (e) { /* Nu e problema daca nu gaseste */ }

        // Click repetat pe "Show more" pana dispare
        let clickCount = 0;
        let prevMatchCount = await page.evaluate(() => document.querySelectorAll('[id^="g_1_"]').length);
        log(`   Meciuri inițiale în DOM: ${prevMatchCount}`);

        while (clickCount < MAX_SHOW_MORE_CLICKS) {
            try {
                // Cauta butonul "Show more" - multiple strategii
                let showMoreBtn = null;

                // Strategia 1: Selectoare vechi FlashScore (pre-2026)
                showMoreBtn = await page.$('.event__more--static, a.event__more');

                // Strategia 2: Selector nou FlashScore (2026+) - <a> cu class wclButtonLink în .sportName
                if (!showMoreBtn) {
                    showMoreBtn = await page.$('.sportName > a.wclButtonLink');
                }

                // Strategia 3: Orice <a> direct copil al .sportName (butonul e ultimul element)
                if (!showMoreBtn) {
                    showMoreBtn = await page.$('.sportName > a[href*="#"]');
                }

                // Strategia 4: Căutare text-based - "Show more matches" sau "show more"
                if (!showMoreBtn) {
                    const handle = await page.evaluateHandle(() => {
                        // Caută în container-ul sportName mai întâi
                        const container = document.querySelector('.sportName');
                        if (container) {
                            const links = container.querySelectorAll('a');
                            for (const a of links) {
                                const text = a.textContent.trim().toLowerCase();
                                if (text.includes('show more')) return a;
                            }
                        }
                        // Fallback: caută în tot documentul
                        const allLinks = document.querySelectorAll('a');
                        for (const a of allLinks) {
                            const text = a.textContent.trim().toLowerCase();
                            if (text === 'show more matches' || text === 'show more') return a;
                        }
                        return null;
                    });
                    // evaluateHandle returnează JSHandle - verificăm dacă e un element valid
                    const element = handle.asElement();
                    if (element) {
                        showMoreBtn = element;
                    } else {
                        await handle.dispose();
                    }
                }

                if (!showMoreBtn) {
                    log(`   Nu mai exista buton "Show more" dupa ${clickCount} clickuri`);
                    break;
                }

                // Scroll la buton (comportament uman)
                await page.evaluate(el => {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, showMoreBtn);
                await randomDelay(500, 1200);

                // Click cu fallback - încearcă click normal, apoi evaluate click
                try {
                    await showMoreBtn.click();
                } catch (clickErr) {
                    // Fallback: click prin JavaScript
                    await page.evaluate(el => el.click(), showMoreBtn);
                }
                clickCount++;

                // Așteaptă ca noi meciuri să apară în DOM (max 8 secunde)
                const waitStart = Date.now();
                let newMatchCount = prevMatchCount;
                while (Date.now() - waitStart < 8000) {
                    await new Promise(r => setTimeout(r, 500));
                    newMatchCount = await page.evaluate(() => document.querySelectorAll('[id^="g_1_"]').length);
                    if (newMatchCount > prevMatchCount) break;
                }

                if (newMatchCount > prevMatchCount) {
                    log(`   Click ${clickCount}: ${prevMatchCount} → ${newMatchCount} meciuri (+${newMatchCount - prevMatchCount})`);
                    prevMatchCount = newMatchCount;
                } else {
                    log(`   Click ${clickCount}: fără meciuri noi (total: ${newMatchCount}), opresc`);
                    break;
                }

                // Delay uman intre clickuri
                await randomDelay(1500, 3000);

                // Scroll in jos dupa click (natural)
                await page.evaluate(() => {
                    window.scrollBy({ top: 300 + Math.random() * 200, behavior: 'smooth' });
                });
                await randomDelay(800, 1500);

            } catch (e) {
                // Butonul a disparut sau eroare click
                log(`   Buton "Show more" disparut dupa ${clickCount} clickuri (${e.message.substring(0, 80)})`);
                break;
            }
        }

        const finalCount = await page.evaluate(() => document.querySelectorAll('[id^="g_1_"]').length);
        log(`   Total meciuri dupa "Show more": ${finalCount} (${clickCount} clickuri)`);


        // Scroll sus si apoi jos pentru a incarca tot (comportament uman)
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
        await randomDelay(1000, 2000);
        await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
        await randomDelay(1000, 2000);

        // Extrage matchId-uri + echipe din DOM
        const matchEntries = await page.evaluate(() => {
            const entries = [];
            let currentRound = null;

            // Parcurgem TOATE elementele din container-ul de rezultate
            // ca sa gasim header-ele de round inainte de meciuri
            const container = document.querySelector('.sportName');
            if (container) {
                const allChildren = container.children;
                for (const child of allChildren) {
                    // Header de round: "Round 33", "Matchday 15", etc.
                    const roundHeader = child.querySelector('.event__round');
                    if (roundHeader) {
                        const roundText = roundHeader.textContent.trim();
                        // Extrage numarul: "Round 33" -> 33
                        const roundMatch = roundText.match(/(\d+)/);
                        currentRound = roundMatch ? parseInt(roundMatch[1]) : roundText;
                    }

                    // Meci
                    if (child.id && child.id.startsWith('g_1_')) {
                        const id = child.id.replace('g_1_', '');
                        if (id && id.length >= 6) {
                            const homeEl = child.querySelector('.event__participant--home');
                            const awayEl = child.querySelector('.event__participant--away');
                            const home = homeEl ? homeEl.textContent.trim() : '';
                            const away = awayEl ? awayEl.textContent.trim() : '';
                            entries.push({ id, home, away, round: currentRound });
                        }
                    }
                }
            }

            // Fallback daca container-ul nu exista
            if (entries.length === 0) {
                const elements = document.querySelectorAll('[id^="g_1_"]');
                elements.forEach(el => {
                    const id = el.id.replace('g_1_', '');
                    if (id && id.length >= 6) {
                        const homeEl = el.querySelector('.event__participant--home');
                        const awayEl = el.querySelector('.event__participant--away');
                        const home = homeEl ? homeEl.textContent.trim() : '';
                        const away = awayEl ? awayEl.textContent.trim() : '';
                        entries.push({ id, home, away, round: null });
                    }
                });
            }

            return entries;
        });

        log(`   Gasite ${matchEntries.length} meciuri din DOM`);

        return matchEntries;

    } catch (error) {
        logError(`   EROARE Faza 1 pentru ${leagueConfig.name} ${season.id}: ${error.message}`);
        return [];
    } finally {
        if (browser) {
            try { await browser.close(); } catch (e) { /* ignore */ }
        }
    }
}

// ═══════════════════════════════════════════════
// FAZA 2: EXTRACT MATCH STATS (API HTTP)
// ═══════════════════════════════════════════════

async function extractMatchStatsAPI(matchId, leagueConfig, season, teamInfo = null) {
    try {
        // Fetch detalii complete meci (3 requesturi HTTP)
        const matchDetails = await fetchMatchDetails(matchId);

        if (!matchDetails || !matchDetails.core) {
            return { success: false, error: 'Nu s-au putut extrage detaliile meciului', matchId };
        }

        // Verificare meci terminat (DC_1 endpoint: AZ=1 = finished)
        if (!matchDetails.core.AZ) {
            return { success: false, error: 'Meciul nu este terminat', matchId };
        }

        // Echipele vin din DOM (state) sau din df_hh_1_ endpoint
        let homeTeam = teamInfo ? teamInfo.home : null;
        let awayTeam = teamInfo ? teamInfo.away : null;

        if (!homeTeam || !awayTeam || homeTeam === 'Unknown') {
            // Fallback: extrage din head-to-head endpoint
            try {
                const hhUrl = `https://global.flashscore.ninja/2/x/feed/df_hh_1_${matchId}`;
                const hhData = await fetchFromAPI(hhUrl);
                const hhParsed = parseFlashscoreData(hhData);
                // Primul record cu KJ/KK contine echipele meciului curent
                for (const rec of hhParsed) {
                    if (rec.KJ && rec.KK) {
                        homeTeam = rec.KJ.replace(/^\*/, ''); // Elimina * prefix
                        awayTeam = rec.KK.replace(/^\*/, '');
                        break;
                    }
                }
            } catch (e) {
                // Ignora - va folosi Unknown
            }
        }

        if (!homeTeam) homeTeam = 'Unknown';
        if (!awayTeam) awayTeam = 'Unknown';

        // DC = Unix timestamp meci (din dc_1_ endpoint)
        const matchTimestamp = parseInt(matchDetails.core.DC) || 0;

        // Verificare ca meciul apartine sezonului
        if (!matchBelongsToSeason(matchTimestamp, season.id)) {
            return { success: false, error: `Meciul din ${new Date(matchTimestamp * 1000).toLocaleDateString('ro-RO')} nu apartine sezonului ${season.id}`, matchId };
        }

        // Extrage scoruri
        const scores = extractScores(matchDetails.core, matchDetails.summary);

        // Parseaza statistici
        const stats = parseStatistics(matchDetails.statsData);

        // Formateaza data
        const matchDate = new Date(matchTimestamp * 1000);
        const dateFormatted = matchDate.toLocaleString('ro-RO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Construieste obiectul in formatul asteptat de CHAMPIONSHIP_JSON_MANAGER
        const matchData = {
            match: {
                homeTeam: homeTeam,
                awayTeam: awayTeam,
                date: dateFormatted,
                league: leagueConfig.name,
                country: leagueConfig.name.split(':')[0].trim(),
                season: season.id,
                round: teamInfo && teamInfo.round ? `Round ${teamInfo.round}` : null,
                roundNumber: teamInfo && teamInfo.round ? teamInfo.round : null,
                homePositionBefore: null,
                awayPositionBefore: null,
                homeTier: null,
                awayTier: null
            },
            halftime: {
                teams: { home: homeTeam, away: awayTeam },
                score: {
                    home: scores.halftime.home || '0',
                    away: scores.halftime.away || '0'
                },
                statistics: stats.halftime
            },
            fulltime: {
                teams: { home: homeTeam, away: awayTeam },
                score: {
                    home: scores.fulltime.home || '0',
                    away: scores.fulltime.away || '0'
                },
                statistics: stats.fulltime
            },
            secondhalf: {
                teams: { home: homeTeam, away: awayTeam },
                statistics: stats.secondhalf
            },
            htScoreReal: null,
            metadata: {
                matchId: matchId,
                extractedAt: new Date().toISOString(),
                source: 'FlashScore API (Backfill)'
            }
        };

        // VALIDARE STRICTA
        const validation = validateMatchData(matchData, matchId);
        if (!validation.valid) {
            return {
                success: false,
                error: `Validare esuata: ${validation.issues.join('; ')}`,
                matchId,
                homeTeam,
                awayTeam
            };
        }

        return {
            success: true,
            data: matchData,
            matchId,
            homeTeam,
            awayTeam,
            date: dateFormatted
        };

    } catch (error) {
        return { success: false, error: error.message, matchId };
    }
}

// ═══════════════════════════════════════════════
// ORCHESTRATOR PRINCIPAL
// ═══════════════════════════════════════════════

class UniversalBackfill {
    constructor(options = {}) {
        this.state = loadState();
        this.batchSize = options.batch || DEFAULT_BATCH_SIZE;
        this.targetLeague = options.league || null;
        this.targetSeason = options.season || null;
        this.phase = options.phase || null; // null = ambele faze
        this.stats = {
            discovered: 0,
            extracted: 0,
            saved: 0,
            skipped: 0,
            failed: 0,
            duplicates: 0,
            invalidData: 0
        };
    }

    /**
     * Filtreaza ligile conform optiunilor CLI
     */
    getTargetLeagues() {
        let leagues = getLeaguesByPriority();

        if (this.targetLeague) {
            const found = findLeague(this.targetLeague);
            if (!found) {
                logError(`Liga "${this.targetLeague}" nu a fost gasita in config!`);
                logError(`Ligi disponibile:`);
                leagues.forEach(l => logError(`  - ${l.name}`));
                process.exit(1);
            }
            leagues = [found];
        }

        return leagues;
    }

    /**
     * Filtreaza sezoanele conform optiunilor CLI
     */
    getTargetSeasons(leagueConfig) {
        if (this.targetSeason) {
            const found = leagueConfig.seasons.find(s => s.id === this.targetSeason);
            if (!found) {
                return [];
            }
            return [found];
        }
        return leagueConfig.seasons;
    }

    /**
     * FAZA 1: Discover matchIds pentru toate ligile/sezoanele
     */
    async runPhase1() {
        log('\n' + '='.repeat(60));
        log('FAZA 1: DISCOVER MATCH IDs (Puppeteer)');
        log('='.repeat(60));

        const leagues = this.getTargetLeagues();

        for (const leagueConfig of leagues) {
            const seasons = this.getTargetSeasons(leagueConfig);
            if (seasons.length === 0) continue;

            for (const season of seasons) {
                // Faza 1 = browser = prag mic (10 meciuri live)
                await waitForLiveMatchesToEnd();

                const lsState = getLeagueSeasonState(this.state, leagueConfig.name, season.id);

                // Daca am descoperit deja recent (in ultimele 24h), skip
                if (lsState.lastDiscovery) {
                    const hoursSince = (Date.now() - new Date(lsState.lastDiscovery).getTime()) / (1000 * 60 * 60);
                    if (hoursSince < 24) {
                        log(`\n   SKIP ${leagueConfig.name} ${season.id} - descoperit acum ${Math.round(hoursSince)}h`);
                        continue;
                    }
                }

                // Discover
                const matchEntries = await discoverMatchIds(leagueConfig, season);

                if (matchEntries.length > 0) {
                    // Citeste matchIds existente din JSON
                    const seasonFilePath = getSeasonFilePath(season);
                    const existingIds = getExistingMatchIds(seasonFilePath);

                    // Adauga si cele deja procesate din state
                    const processedSet = new Set(lsState.processedIds);

                    // Filtreaza doar cele NOI
                    const newEntries = matchEntries.filter(e => !existingIds.has(e.id) && !processedSet.has(e.id));

                    // Merge cu cele existente in state (nu suprascrie)
                    const existingDiscovered = new Set(lsState.discoveredIds);
                    newEntries.forEach(e => {
                        existingDiscovered.add(e.id);
                        // Salveaza echipele in state
                        if (e.home && e.away) {
                            lsState.discoveredMatches[e.id] = { home: e.home, away: e.away, round: e.round || null };
                        }
                    });
                    lsState.discoveredIds = Array.from(existingDiscovered);

                    lsState.lastDiscovery = new Date().toISOString();
                    this.stats.discovered += newEntries.length;

                    log(`   ${leagueConfig.name} ${season.id}: ${matchEntries.length} total, ${existingIds.size} existente, ${newEntries.length} NOI de descarcat`);
                }

                saveState(this.state);

                // Delay intre campionate
                await randomDelay(3000, 6000);
            }
        }

        log(`\n   FAZA 1 COMPLETA: ${this.stats.discovered} matchId-uri noi descoperite`);
    }

    /**
     * FAZA 2: Extract stats pentru matchIds descoperite
     */
    async runPhase2() {
        log('\n' + '='.repeat(60));
        log('FAZA 2: EXTRACT MATCH STATS (API HTTP)');
        log(`Batch size: ${this.batchSize}`);
        log('='.repeat(60));

        const leagues = this.getTargetLeagues();
        let totalProcessed = 0;

        for (const leagueConfig of leagues) {
            const seasons = this.getTargetSeasons(leagueConfig);
            if (seasons.length === 0) continue;

            for (const season of seasons) {
                if (totalProcessed >= this.batchSize) {
                    log(`\n   Batch limit atins (${this.batchSize})`);
                    return;
                }

                const lsState = getLeagueSeasonState(this.state, leagueConfig.name, season.id);

                // Citeste matchIds existente din JSON (pentru a evita duplicate la re-run)
                const seasonFilePath = getSeasonFilePath(season);
                const existingIds = getExistingMatchIds(seasonFilePath);

                // Determina ce trebuie procesat
                const processedSet = new Set(lsState.processedIds);
                const failedSet = new Set(lsState.failedIds);
                const pendingIds = lsState.discoveredIds.filter(id =>
                    !processedSet.has(id) && !existingIds.has(id)
                );

                // Include si failed IDs pentru retry (max 1 retry)
                const retryIds = lsState.failedIds.filter(id =>
                    !processedSet.has(id) && !existingIds.has(id)
                );

                const allPending = [...new Set([...pendingIds, ...retryIds])];

                if (allPending.length === 0) continue;

                log(`\n   ${leagueConfig.name} ${season.id}: ${allPending.length} meciuri de procesat`);

                let matchCounter = 0;

                for (const matchId of allPending) {
                    if (totalProcessed >= this.batchSize) break;

                    // Faza 2 = HTTP only, nu interfereaza cu meciuri live
                    // Nu mai asteptam - Phase 2 foloseste API HTTP, nu browser

                    // Pauza lunga periodica
                    if (matchCounter > 0 && matchCounter % MATCHES_BEFORE_LONG_PAUSE === 0) {
                        log(`   ... Pauza lunga dupa ${matchCounter} meciuri ...`);
                        await randomDelay(DELAY_LONG_PAUSE, DELAY_LONG_PAUSE_MAX);
                    }

                    // Extract - folosim echipele din DOM (stocate in state)
                    const teamInfo = lsState.discoveredMatches[matchId] || null;
                    const result = await extractMatchStatsAPI(matchId, leagueConfig, season, teamInfo);

                    if (result.success) {
                        // Salvare via CHAMPIONSHIP_JSON_MANAGER
                        try {
                            const saveResult = saveMatchData(result.data);

                            if (saveResult.success) {
                                this.stats.saved++;
                                log(`   [${totalProcessed + 1}/${this.batchSize}] SALVAT: ${result.homeTeam} vs ${result.awayTeam} (${result.date})`);
                            } else if (saveResult.reason === 'duplicate') {
                                this.stats.duplicates++;
                                log(`   [${totalProcessed + 1}/${this.batchSize}] DUPLICAT: ${result.homeTeam} vs ${result.awayTeam}`);
                            } else {
                                this.stats.failed++;
                                logError(`   [${totalProcessed + 1}/${this.batchSize}] EROARE SALVARE: ${saveResult.error}`);

                                // Adauga la failed pentru retry
                                if (!failedSet.has(matchId)) {
                                    lsState.failedIds.push(matchId);
                                }
                            }

                            // Marcare ca procesat (indiferent de rezultat)
                            if (!processedSet.has(matchId)) {
                                lsState.processedIds.push(matchId);
                                processedSet.add(matchId);
                            }

                            // Sterge din failedIds daca a reusit
                            if (saveResult.success || saveResult.reason === 'duplicate') {
                                lsState.failedIds = lsState.failedIds.filter(id => id !== matchId);
                            }

                        } catch (saveError) {
                            this.stats.failed++;
                            logError(`   EROARE SALVARE: ${saveError.message}`);
                            if (!failedSet.has(matchId)) {
                                lsState.failedIds.push(matchId);
                            }
                        }
                    } else {
                        if (result.error && result.error.includes('Validare esuata')) {
                            this.stats.invalidData++;
                            logError(`   [${totalProcessed + 1}/${this.batchSize}] INVALID: ${matchId} - ${result.error}`);
                        } else if (result.error && result.error.includes('nu apartine sezonului')) {
                            this.stats.skipped++;
                            log(`   [${totalProcessed + 1}/${this.batchSize}] SKIP SEZON: ${matchId} - ${result.error}`);
                        } else {
                            this.stats.failed++;
                            logError(`   [${totalProcessed + 1}/${this.batchSize}] EROARE: ${matchId} - ${result.error}`);
                        }

                        // Marcare ca procesat sau failed
                        if (result.error && (result.error.includes('nu apartine') || result.error.includes('Validare esuata'))) {
                            // Marcare ca procesat (nu mai incerca)
                            if (!processedSet.has(matchId)) {
                                lsState.processedIds.push(matchId);
                                processedSet.add(matchId);
                            }
                        } else {
                            // Eroare de retea - adauga la failed pentru retry
                            if (!failedSet.has(matchId)) {
                                lsState.failedIds.push(matchId);
                            }
                        }
                    }

                    totalProcessed++;
                    matchCounter++;
                    this.stats.extracted++;

                    // Salvare state periodic (la fiecare 10 meciuri)
                    if (totalProcessed % 10 === 0) {
                        lsState.lastProcessing = new Date().toISOString();
                        this.state.totalProcessed = (this.state.totalProcessed || 0) + 10;
                        saveState(this.state);
                    }

                    // Memory throttle — pauză când RAM > 7GB
                    memoryThrottle.check();
                    if (memoryThrottle.isThrottled) {
                        log(`   ⏸️  MEMORY THROTTLE — pauză backfill (RAM > ${memoryThrottle.THROTTLE_THRESHOLD_MB} MB)`);
                        // Salvează state înainte de pauză
                        lsState.lastProcessing = new Date().toISOString();
                        saveState(this.state);
                        // Așteaptă până scade memoria
                        while (memoryThrottle.isThrottled) {
                            await randomDelay(30000, 45000); // check la 30-45s
                            memoryThrottle.check();
                        }
                        log(`   ▶️  MEMORY THROTTLE dezactivat — reiau backfill`);
                    }

                    // Delay intre meciuri
                    if (totalProcessed < this.batchSize) {
                        await randomDelay(DELAY_BETWEEN_MATCHES_MIN, DELAY_BETWEEN_MATCHES_MAX);
                    }
                }

                // Salvare state finala pentru acest sezon
                lsState.lastProcessing = new Date().toISOString();
                saveState(this.state);
            }
        }

        // Salvare state finala
        this.state.totalProcessed = (this.state.totalProcessed || 0) + totalProcessed;
        saveState(this.state);

        log(`\n   FAZA 2 COMPLETA: ${totalProcessed} meciuri procesate`);
    }

    /**
     * Afiseaza status progres
     */
    showStatus() {
        const state = loadState();
        console.log('\n' + '='.repeat(70));
        console.log('   UNIVERSAL BACKFILL - STATUS PROGRES');
        console.log('='.repeat(70));
        console.log(`\n   Ultima rulare: ${state.lastRun || 'Niciodata'}`);
        console.log(`   Total meciuri procesate (toate rulari): ${state.totalProcessed || 0}\n`);

        const leagues = getLeaguesByPriority();

        for (const leagueConfig of leagues) {
            for (const season of leagueConfig.seasons) {
                const key = getLeagueSeasonKey(leagueConfig.name, season.id);
                const ls = state.leagues[key];

                if (!ls) {
                    console.log(`   [P${leagueConfig.priority}] ${leagueConfig.name} ${season.id}: -- nu a fost scanat --`);
                    continue;
                }

                const discovered = ls.discoveredIds.length;
                const processed = ls.processedIds.length;
                const failed = ls.failedIds.length;
                const pending = discovered - processed;

                // Citeste si din JSON
                const seasonFilePath = getSeasonFilePath(season);
                const existingCount = getExistingMatchIds(seasonFilePath).size;
                const coverage = season.expectedMatches > 0
                    ? ((existingCount / season.expectedMatches) * 100).toFixed(1)
                    : '?';

                let statusIcon = '   ';
                if (pending === 0 && discovered > 0) statusIcon = ' V ';
                else if (pending > 0) statusIcon = '...';
                else statusIcon = ' - ';

                console.log(`   [${statusIcon}] ${leagueConfig.name} ${season.id}: ${existingCount}/${season.expectedMatches} meciuri (${coverage}%) | Descoperite: ${discovered} | Procesate: ${processed} | Pending: ${pending} | Failed: ${failed}`);
            }
        }

        console.log('\n' + '='.repeat(70));
    }

    /**
     * Reseteaza state
     */
    resetState() {
        if (fs.existsSync(STATE_FILE)) {
            // Backup inainte de reset
            const backupPath = STATE_FILE.replace('.json', `.backup-${Date.now()}.json`);
            fs.copyFileSync(STATE_FILE, backupPath);
            log(`Backup state salvat in: ${backupPath}`);
        }

        fs.writeFileSync(STATE_FILE, JSON.stringify({ leagues: {}, lastRun: null, totalProcessed: 0 }, null, 2));
        log('State resetat cu succes!');
    }

    /**
     * Ruleaza workflow-ul complet
     */
    async run() {
        const startTime = Date.now();

        console.log('\n');
        console.log('='.repeat(60));
        console.log('   UNIVERSAL BACKFILL - Completare Meciuri Lipsa');
        console.log('='.repeat(60));
        console.log(`   Faza: ${this.phase || 'AMBELE (1+2)'}`);
        console.log(`   Batch: ${this.batchSize}`);
        if (this.targetLeague) console.log(`   Liga: ${this.targetLeague}`);
        if (this.targetSeason) console.log(`   Sezon: ${this.targetSeason}`);
        console.log('='.repeat(60));

        try {
            // Verificare meciuri live la start (doar pentru Phase 1 = browser)
            if (!this.phase || this.phase === '1') {
                await waitForLiveMatchesToEnd();
            }

            // Faza 1: Discover (daca nu e --phase=2)
            if (!this.phase || this.phase === '1') {
                await this.runPhase1();
            }

            // Faza 2: Extract (daca nu e --phase=1)
            if (!this.phase || this.phase === '2') {
                await this.runPhase2();
            }

        } catch (error) {
            logError(`EROARE FATALA: ${error.message}`);
            logError(error.stack);
        }

        // Sumar final
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log('\n' + '='.repeat(60));
        console.log('   SUMAR FINAL');
        console.log('='.repeat(60));
        console.log(`   Durata: ${duration}s`);
        console.log(`   Descoperite (noi): ${this.stats.discovered}`);
        console.log(`   Extrase: ${this.stats.extracted}`);
        console.log(`   Salvate cu succes: ${this.stats.saved}`);
        console.log(`   Duplicate (skip): ${this.stats.duplicates}`);
        console.log(`   Skip sezon gresit: ${this.stats.skipped}`);
        console.log(`   Date invalide: ${this.stats.invalidData}`);
        console.log(`   Erori: ${this.stats.failed}`);
        console.log('='.repeat(60));

        // Exit code conventional
        if (this.stats.saved === 0 && this.stats.extracted === 0 && this.stats.discovered === 0) {
            // Nimic de facut
            process.exit(2);
        }

        process.exit(0);
    }
}

// ═══════════════════════════════════════════════
// CLI PARSING
// ═══════════════════════════════════════════════

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {};

    for (const arg of args) {
        if (arg === '--status') {
            options.status = true;
        } else if (arg === '--reset') {
            options.reset = true;
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else if (arg.startsWith('--phase=')) {
            options.phase = arg.split('=')[1];
        } else if (arg.startsWith('--batch=')) {
            options.batch = parseInt(arg.split('=')[1]) || DEFAULT_BATCH_SIZE;
        } else if (arg.startsWith('--league=')) {
            options.league = arg.split('=').slice(1).join('='); // Permite = in nume
        } else if (arg.startsWith('--season=')) {
            options.season = arg.split('=')[1];
        }
    }

    return options;
}

function showHelp() {
    console.log(`
UNIVERSAL BACKFILL - Completare Automata Meciuri Lipsa

USAGE:
  node UNIVERSAL_BACKFILL.js                              # Discover + extract 50 meciuri
  node UNIVERSAL_BACKFILL.js --phase=1                    # Doar discover matchIds
  node UNIVERSAL_BACKFILL.js --phase=2 --batch=100        # Doar extract, 100 meciuri
  node UNIVERSAL_BACKFILL.js --league="SPAIN: LaLiga"     # Un singur campionat
  node UNIVERSAL_BACKFILL.js --season=2023-2024           # Un singur sezon
  node UNIVERSAL_BACKFILL.js --status                     # Arata progres
  node UNIVERSAL_BACKFILL.js --reset                      # Reseteaza state
  node UNIVERSAL_BACKFILL.js --help                       # Acest mesaj

OPTIONS:
  --phase=1|2       Ruleaza doar Faza 1 (discover) sau Faza 2 (extract)
  --batch=N         Numarul maxim de meciuri de procesat in Faza 2 (default: 50)
  --league="NOME"   Proceseaza doar un campionat specific
  --season=ID       Proceseaza doar un sezon specific (ex: 2024-2025)
  --status          Afiseaza progresul curent
  --reset           Reseteaza state-ul (cu backup)

PROTECTII:
  - Validare stricta: fara NULL, 0, date lipsa
  - Pauza la meciuri live: nu interfereaza cu monitorizarea
  - Resurse: max 1 browser, delay-uri intre requesturi
  - Anti-detectie: UA rotativ, delays random, scroll natural
  - Reluare: salveaza progresul, continua de unde a ramas
`);
}

// ═══════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════

if (require.main === module) {
    const options = parseArgs();

    if (options.help) {
        showHelp();
        process.exit(0);
    }

    if (options.status) {
        const backfill = new UniversalBackfill(options);
        backfill.showStatus();
        process.exit(0);
    }

    if (options.reset) {
        const backfill = new UniversalBackfill(options);
        backfill.resetState();
        process.exit(0);
    }

    const backfill = new UniversalBackfill(options);
    backfill.run().catch(err => {
        logError(`EROARE CRITICA: ${err.message}`);
        process.exit(1);
    });
}

module.exports = { UniversalBackfill };
