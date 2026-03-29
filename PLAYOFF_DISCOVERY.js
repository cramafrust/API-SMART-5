/**
 * PLAYOFF_DISCOVERY.js
 *
 * Descoperă meciuri de playoff România care lipsesc din feed-ul FlashScore API.
 *
 * PROBLEMA: FlashScore feed principal (f_1_0_2_en_1) nu include întotdeauna
 * meciurile din Championship Group. Le descoperim prin:
 *   1. Puppeteer — scraping pagina fixtures FlashScore
 *   2. Live feed — check r_1_1 pentru echipe playoff cunoscute
 *
 * USAGE:
 *   const { discoverPlayoffMatches, checkLiveForPlayoff } = require('./PLAYOFF_DISCOVERY');
 *   await discoverPlayoffMatches(); // Puppeteer — la 08:05
 *   await checkLiveForPlayoff();    // Live feed — la fiecare ciclu
 */

const fs = require('fs');
const path = require('path');
const { fetchFromAPI, fetchMainFeed, parseFlashscoreData } = require('./flashscore-api');
const { ROMANIA_PLAYOFF_TEAMS, fixRomaniaLeagueName } = require('./DAILY_MATCHES');
const logger = require('./LOG_MANAGER');

// URL FlashScore pentru fixtures Championship Group România
const PLAYOFF_FIXTURES_URL = 'https://www.flashscore.com/football/romania/superliga-championship-group/fixtures/';
const PLAYOFF_PAGE_URL = 'https://www.flashscore.com/football/romania/superliga-championship-group/';

/**
 * Citește fișierul zilnic de meciuri
 */
function getTodayMatchesPath() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return path.join(__dirname, `meciuri-${y}-${m}-${d}.json`);
}

function readTodayMatches() {
    const filePath = getTodayMatchesPath();
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch { return null; }
}

function saveTodayMatches(data) {
    fs.writeFileSync(getTodayMatchesPath(), JSON.stringify(data, null, 2), 'utf8');
}

/**
 * METODA 1: Puppeteer Discovery
 * Merge pe pagina FlashScore și extrage matchId-uri pentru meciuri din azi
 */
async function discoverPlayoffMatches() {
    logger.info('\n🇷🇴 PLAYOFF DISCOVERY — Puppeteer');
    logger.info('='.repeat(60));

    let browser = null;
    let page = null;

    try {
        const BrowserPool = require('./BROWSER_POOL');
        browser = await BrowserPool.launchBrowser();
        page = await browser.newPage();

        // Anti-detectie
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1400, height: 800 });

        // Blocare resurse grele
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        // Încearcă fixtures, apoi pagina principală
        let url = PLAYOFF_FIXTURES_URL;
        logger.info(`   URL: ${url}`);

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 3000));

        // Accept cookies
        try {
            const cookieBtn = await page.$('#onetrust-accept-btn-handler');
            if (cookieBtn) { await cookieBtn.click(); await new Promise(r => setTimeout(r, 1000)); }
        } catch {}

        // Extrage match IDs din DOM
        const matchIds = await page.evaluate(() => {
            const elements = document.querySelectorAll('[id^="g_1_"]');
            return Array.from(elements).map(el => el.id.replace('g_1_', ''));
        });

        logger.info(`   Găsite ${matchIds.length} meciuri pe pagina Championship Group`);

        if (matchIds.length === 0) {
            // Încearcă pagina principală
            logger.info(`   Încerc pagina principală: ${PLAYOFF_PAGE_URL}`);
            await page.goto(PLAYOFF_PAGE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(r => setTimeout(r, 3000));

            const matchIds2 = await page.evaluate(() => {
                const elements = document.querySelectorAll('[id^="g_1_"]');
                return Array.from(elements).map(el => el.id.replace('g_1_', ''));
            });
            logger.info(`   Găsite ${matchIds2.length} meciuri pe pagina principală`);
            matchIds.push(...matchIds2);
        }

        if (matchIds.length === 0) {
            logger.info('   Niciun meci găsit pe FlashScore Championship Group');
            return { added: 0, discovered: 0 };
        }

        // Filtrăm doar meciurile din azi și adăugăm la fișierul zilnic
        const todayData = readTodayMatches();
        if (!todayData) {
            logger.info('   Fișierul zilnic nu există încă — skip');
            return { added: 0, discovered: matchIds.length };
        }

        const existingIds = new Set(todayData.meciuri.map(m => m.matchId));
        let added = 0;
        const MAX_DISCOVER = 10; // Championship Group are max 3 meciuri per etapă — safety limit

        for (const matchId of matchIds) {
            if (added >= MAX_DISCOVER) {
                logger.warn(`   ⚠️  Limita de ${MAX_DISCOVER} meciuri atinsă — opresc discovery`);
                break;
            }
            if (existingIds.has(matchId)) continue;

            try {
                // Fetch detalii meci via API
                const rawCore = await fetchFromAPI(`https://global.flashscore.ninja/2/x/feed/dc_1_${matchId}`);
                const rawHH = await fetchFromAPI(`https://global.flashscore.ninja/2/x/feed/df_hh_1_${matchId}`);

                // Extragem echipele din H2H
                const homeMatch = rawHH.match(/KJ÷\*?([^¬]+)/);
                const awayMatch = rawHH.match(/KK÷([^¬]+)/);
                const homeTeam = homeMatch ? homeMatch[1].replace('*', '') : null;
                const awayTeam = awayMatch ? awayMatch[1] : null;

                // VALIDARE: skip dacă nu avem echipe valide
                if (!homeTeam || !awayTeam || homeTeam === 'Unknown' || awayTeam === 'Unknown') {
                    logger.warn(`   ⚠️  Skip ${matchId}: echipe invalide (${homeTeam} vs ${awayTeam})`);
                    continue;
                }

                // Extragem timestamp din core
                const dcMatch = rawCore.match(/DC÷(\d+)/);
                const timestamp = dcMatch ? parseInt(dcMatch[1]) : 0;

                // VALIDARE: skip dacă timestamp invalid
                if (!timestamp || timestamp < 1000000000) {
                    logger.warn(`   ⚠️  Skip ${matchId}: timestamp invalid (${timestamp})`);
                    continue;
                }

                // Verificăm dacă e azi
                const matchDate = new Date(timestamp * 1000);
                const today = new Date();
                if (matchDate.getDate() !== today.getDate() ||
                    matchDate.getMonth() !== today.getMonth() ||
                    matchDate.getFullYear() !== today.getFullYear()) {
                    continue; // Nu e de azi
                }

                const ora = matchDate.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });

                todayData.meciuri.push({
                    matchId,
                    homeTeam,
                    awayTeam,
                    liga: fixRomaniaLeagueName('ROMANIA: Superliga - Championship Group', homeTeam, awayTeam),
                    ora,
                    timestamp,
                    finished: false,
                    discoveredBy: 'PLAYOFF_DISCOVERY'
                });

                added++;
                logger.info(`   ➕ DESCOPERIT: ${homeTeam} vs ${awayTeam} | ${ora} | ${matchId}`);
            } catch (e) {
                logger.warn(`   ⚠️  Eroare fetch detalii ${matchId}: ${e.message}`);
            }

            // Delay între request-uri
            await new Promise(r => setTimeout(r, 1000));
        }

        if (added > 0) {
            todayData.meciuri.sort((a, b) => a.timestamp - b.timestamp);
            todayData.totalMatches = todayData.meciuri.length;
            todayData.lastPlayoffDiscovery = new Date().toISOString();
            saveTodayMatches(todayData);
            logger.info(`   ✅ Adăugate ${added} meciuri playoff la fișierul zilnic`);
        } else {
            logger.info(`   ✅ Toate meciurile playoff erau deja în fișierul zilnic`);
        }

        return { added, discovered: matchIds.length };

    } catch (e) {
        logger.error(`   ❌ Eroare Puppeteer discovery: ${e.message}`);
        return { added: 0, discovered: 0, error: e.message };
    } finally {
        if (page) try { await page.close(); } catch {}
        if (browser) try { await browser.close(); } catch {}
    }
}

/**
 * METODA 2: Live Feed Check
 * Verifică feed-ul live (r_1_1) pentru echipe playoff România
 * Rulează la fiecare ciclu de monitorizare
 */
async function checkLiveForPlayoff() {
    try {
        const rawLive = await fetchFromAPI('https://global.flashscore.ninja/2/x/feed/r_1_1');
        const records = parseFlashscoreData(rawLive);

        // Caută meciuri cu echipe playoff România
        const playoffLive = records.filter(r => {
            const home = (r.AE || '').trim();
            const away = (r.AF || '').trim();
            return ROMANIA_PLAYOFF_TEAMS.some(t => home.includes(t) || t.includes(home)) &&
                   ROMANIA_PLAYOFF_TEAMS.some(t => away.includes(t) || t.includes(away));
        });

        if (playoffLive.length === 0) return { found: 0, added: 0 };

        const todayData = readTodayMatches();
        if (!todayData) return { found: playoffLive.length, added: 0 };

        const existingIds = new Set(todayData.meciuri.map(m => m.matchId));
        let added = 0;

        for (const match of playoffLive) {
            const matchId = match.AA;
            if (!matchId || existingIds.has(matchId)) continue;

            const homeTeam = (match.AE || 'Unknown').trim();
            const awayTeam = (match.AF || 'Unknown').trim();
            const timestamp = parseInt(match.AD) || 0;
            const ora = new Date(timestamp * 1000).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });

            todayData.meciuri.push({
                matchId,
                homeTeam,
                awayTeam,
                liga: 'ROMANIA: Superliga - Championship Group',
                ora,
                timestamp,
                finished: false,
                discoveredBy: 'LIVE_FEED_CHECK'
            });

            added++;
            logger.info(`   🇷🇴 LIVE DISCOVERY: ${homeTeam} vs ${awayTeam} | ${matchId}`);
        }

        if (added > 0) {
            todayData.meciuri.sort((a, b) => a.timestamp - b.timestamp);
            todayData.totalMatches = todayData.meciuri.length;
            saveTodayMatches(todayData);
            logger.info(`   ✅ ${added} meciuri playoff adăugate din live feed`);

            // Regenerează schedule-ul
            try {
                const { generateCheckSchedule } = require('./GENERATE_CHECK_SCHEDULE');
                generateCheckSchedule(getTodayMatchesPath());
                logger.info('   ✅ Program verificări regenerat');
            } catch (e) {
                logger.warn(`   ⚠️  Eroare regenerare schedule: ${e.message}`);
            }
        }

        return { found: playoffLive.length, added };
    } catch (e) {
        // Silent fail — nu blocăm monitorizarea
        return { found: 0, added: 0 };
    }
}

module.exports = {
    discoverPlayoffMatches,
    checkLiveForPlayoff
};

// CLI usage
if (require.main === module) {
    (async () => {
        console.log('Rulare PLAYOFF_DISCOVERY...\n');
        const result = await discoverPlayoffMatches();
        console.log('\nRezultat:', JSON.stringify(result));
        process.exit(0);
    })().catch(e => {
        console.error('Eroare:', e.message);
        process.exit(1);
    });
}
