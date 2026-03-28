/**
 * API SMART 4 - Standings Scraper (Puppeteer)
 *
 * Scrapeăm clasamentul DOAR când găsim un pattern promițător
 * Folosește Puppeteer pentru site-uri JavaScript-heavy (Flashscore)
 */

const puppeteer = require('puppeteer');
const BrowserPool = require('./BROWSER_POOL');
const ProcenteLoader = require('./PROCENTE_LOADER');

// Inițializăm ProcenteLoader pentru tier detection
const procenteLoader = new ProcenteLoader();
procenteLoader.load();

// Cache pentru clasamente (1 oră succes, 24h eșec)
const standingsCache = {
    data: {},
    timestamp: {}
};

const CACHE_TTL = 60 * 60 * 1000; // 1 oră
const FAIL_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 ore - nu reîncerca URL-uri care eșuează
const failCache = {}; // URL -> timestamp ultima eșuare

/**
 * Helper: Construiește URL pentru clasament din league name și country
 * @param {string} leagueName - ex: "ENGLAND: Premier League"
 * @param {string} country - ex: "England"
 * @returns {string|null} - URL pentru clasament
 */
function buildStandingsURL(leagueName, country) {
    if (!leagueName) return null;

    // Extract country and league from leagueName (format: "COUNTRY: League Name")
    const parts = leagueName.split(':').map(p => p.trim());
    let countryPart = country || parts[0];
    let leaguePart = parts.length > 1 ? parts[1] : leagueName;

    // Normalize country and league to URL format
    const countrySlug = countryPart
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

    const leagueSlug = leaguePart
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

    // Construct URL (format din SMART 3)
    return `https://www.flashscore.ro/fotbal/${countrySlug}/${leagueSlug}/clasament/`;
}

/**
 * Scrapeăm clasamentul cu Puppeteer
 * @param {string} leagueName - Numele ligii (ex: "ENGLAND: Premier League")
 * @param {string} tournamentId - ID tournament din API (pentru cache)
 * @param {string} country - Țara ligii (opțional)
 * @returns {Array|null} - Array de echipe cu poziții
 */
async function scrapeStandingsWithPuppeteer(leagueName, tournamentId, country = null) {
    // Check cache
    const now = Date.now();
    const cacheKey = tournamentId || leagueName;

    if (standingsCache.data[cacheKey] &&
        standingsCache.timestamp[cacheKey] &&
        (now - standingsCache.timestamp[cacheKey]) < CACHE_TTL) {
        console.log(`   ♻️  Cache hit pentru ${leagueName}`);
        return standingsCache.data[cacheKey];
    }

    // Construim URL din league name + country
    const url = buildStandingsURL(leagueName, country);

    if (!url) {
        console.log(`   ⚠️  Cannot build standings URL for ${leagueName}`);
        return null;
    }

    // Verifică fail cache - nu reîncerca URL-uri care au eșuat recent
    if (failCache[url] && (now - failCache[url]) < FAIL_CACHE_TTL) {
        const hoursAgo = Math.round((now - failCache[url]) / 1000 / 60 / 60);
        console.log(`   ⏭️  SKIP scraping ${leagueName} - a eșuat acum ${hoursAgo}h, nu reîncerc (24h cooldown)`);
        return null;
    }

    let browser = null;

    try {
        console.log(`   🌐 Scraping cu Puppeteer: ${leagueName}...`);
        console.log(`   📡 URL: ${url}`);

        // Launch browser via BrowserPool (max 2 simultan)
        browser = await BrowserPool.launchBrowser();

        const page = await browser.newPage();

        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Navigate to page
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Wait a bit for dynamic content
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Wait for table to load (selectoare din SMART 3)
        await page.waitForSelector('.ui-table__row', { timeout: 10000 });

        // Extract standings data (EXACT ca în SMART 3)
        const standings = await page.evaluate(() => {
            const result = [];
            const rows = document.querySelectorAll('.ui-table__row');

            rows.forEach(row => {
                const teamEl = row.querySelector('.tableCellParticipant__name');
                if (!teamEl) return;

                const teamName = teamEl.textContent.trim();

                // Selectorul corect pentru poziție (din SMART 3)
                const positionEl = row.querySelector('.table__cell--rank');
                const positionText = positionEl ? positionEl.textContent.trim().replace('.', '') : null;
                const position = positionText ? parseInt(positionText) : null;

                // Punctele - încearcă mai multe selectoare
                let points = 0;

                // Încearcă selector specific pentru puncte
                const pointsEl = row.querySelector('.table__cell--points, .table__cell--value, [title="Points"]');
                if (pointsEl) {
                    points = parseInt(pointsEl.textContent.trim()) || 0;
                } else {
                    // Fallback: ultima coloană cu cifre
                    const cells = Array.from(row.querySelectorAll('.table__cell'));
                    const numericCells = cells.filter(cell => {
                        const text = cell.textContent.trim();
                        return !isNaN(text) && text !== '';
                    });
                    if (numericCells.length > 0) {
                        points = parseInt(numericCells[numericCells.length - 1].textContent.trim()) || 0;
                    }
                }

                if (!isNaN(position) && position > 0) {
                    result.push({
                        teamName,
                        position,
                        points
                    });
                }
            });

            return result;
        });

        await browser.close();

        if (!standings || standings.length === 0) {
            console.log(`   ⚠️  Nu am putut extrage clasament`);
            return null;
        }

        console.log(`   ✅ Extras ${standings.length} echipe din clasament`);

        // Cache results
        standingsCache.data[cacheKey] = standings;
        standingsCache.timestamp[cacheKey] = now;

        return standings;

    } catch (error) {
        console.error(`   ❌ Eroare la scraping:`, error.message);

        // Cachează eșecul - nu mai deschide browser degeaba pentru același URL
        failCache[url] = now;
        console.log(`   🚫 URL marcat ca eșuat (nu se reîncearcă 24h): ${url}`);

        if (browser) {
            await browser.close();
        }

        return null;
    }
}

/**
 * Găsește poziția unei echipe în clasament
 * @param {string} leagueName - Numele ligii
 * @param {string} teamName - Numele echipei
 * @param {string} tournamentId - ID tournament (opțional)
 * @returns {Object|null} - { position, teamName, points, totalTeams } sau null
 */
async function getTeamPosition(leagueName, teamName, tournamentId = null) {
    const standings = await scrapeStandingsWithPuppeteer(leagueName, tournamentId);

    if (!standings || standings.length === 0) {
        return null;
    }

    // Funcție helper pentru normalizare avansată (elimină prefixe comune)
    const normalizeTeamName = (name) => {
        let normalized = name.toLowerCase().trim().replace(/\s+/g, ' ');

        // Elimină prefixe comune de cluburi
        const prefixes = ['fc ', 'fk ', 'cs ', 'csm ', 'fcv ', 'fcs ', 'afc ', 'sc ', 'as ', 'ac ', 'cf '];
        for (const prefix of prefixes) {
            if (normalized.startsWith(prefix)) {
                normalized = normalized.substring(prefix.length);
            }
        }

        // Elimină sufixe comune
        const suffixes = [' fc', ' fk', ' cs', ' csm'];
        for (const suffix of suffixes) {
            if (normalized.endsWith(suffix)) {
                normalized = normalized.substring(0, normalized.length - suffix.length);
            }
        }

        return normalized.trim();
    };

    // Caută echipa cu normalizare avansată
    const normalizedSearchName = normalizeTeamName(teamName);

    // Extrage cuvinte cheie din numele căutat (pentru matching parțial mai inteligent)
    const searchWords = normalizedSearchName.split(' ').filter(w => w.length > 2);

    const team = standings.find(t => {
        const normalizedTeamName = normalizeTeamName(t.teamName);

        // Match exact
        if (normalizedTeamName === normalizedSearchName) {
            return true;
        }

        // Match cu includes
        if (normalizedTeamName.includes(normalizedSearchName) ||
            normalizedSearchName.includes(normalizedTeamName)) {
            return true;
        }

        // Match pe cuvinte cheie (dacă toate cuvintele cheie apar în numele din clasament)
        if (searchWords.length > 0) {
            const allWordsMatch = searchWords.every(word => normalizedTeamName.includes(word));
            if (allWordsMatch) {
                return true;
            }
        }

        return false;
    });

    if (!team) {
        console.log(`   ⚠️  Echipa "${teamName}" nu a fost găsită în clasament`);
        console.log(`   📋 Echipe disponibile: ${standings.map(t => t.teamName).join(', ')}`);
        return null;
    }

    return {
        position: team.position,
        teamName: team.teamName,
        points: team.points,
        totalTeams: standings.length
    };
}

/**
 * Determină tier-ul bazat pe poziție
 * @param {number} position - Poziția în clasament
 * @param {number} totalTeams - Total echipe
 * @param {string} leagueName - Numele campionatului (opțional, pentru tier-uri specifice)
 * @returns {string} - Tier (TOP_1-5, MID_6-10, etc.)
 */
function getTierFromPosition(position, totalTeams = 20, leagueName = null) {
    // Folosește ProcenteLoader care citește tier-urile corecte din JSON PROCENTE
    return procenteLoader.detectTierFromPosition(position, totalTeams, leagueName);
}

module.exports = {
    scrapeStandingsWithPuppeteer,
    getTeamPosition,
    getTierFromPosition
};
