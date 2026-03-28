/**
 * 🎯 SUPERBET LIVE SCRAPER - FINAL VERSION
 *
 * Extrage cote LIVE de la Superbet pentru pronosticuri incrementale:
 * - Next Goal (se va mai marca 1+ gol)
 * - 2nd Half Goals (goluri în repriza 2)
 * - 2nd Half GG (o echipă va marca în R2)
 * - Corners (încă X+ cornere)
 * - Cards (încă X+ cartonașe)
 *
 * INTEGRARE:
 * - Apelat din email-notifier.js când trimitem notificare la pauză
 * - Primește nume echipe, caută meciul pe Superbet
 * - Returnează cote live pentru tracking
 */

const puppeteer = require('puppeteer');
const BrowserPool = require('./BROWSER_POOL');

/**
 * Normalizează nume echipă pentru căutare
 */
function normalizeTeamName(name) {
    return name
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Extrage cote LIVE pentru un meci
 */
async function scrapeSuperbetLiveOdds(homeTeam, awayTeam, options = {}) {
    console.log(`\n🎯 SUPERBET LIVE ODDS SCRAPER\n`);
    console.log('='.repeat(70));
    console.log(`⚽ Meci: ${homeTeam} vs ${awayTeam}`);

    let browser;
    try {
        browser = await BrowserPool.launchBrowser({
            ignoreHTTPSErrors: true
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Anti-detection
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
            Object.defineProperty(navigator, 'languages', { get: () => ['ro-RO', 'ro', 'en'] });
        });

        console.log(`\n📥 Accesare Superbet.ro...`);
        await page.goto('https://superbet.ro/', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        await page.waitForTimeout(3000);

        // Search for match
        console.log(`\n🔍 Căutare meci: ${homeTeam} vs ${awayTeam}...`);

        const searchSelectors = [
            'input[type="search"]',
            'input[placeholder*="Caută"]',
            'input[placeholder*="Search"]',
            '.search-input',
            '#search'
        ];

        let searchInput = null;
        for (const selector of searchSelectors) {
            try {
                searchInput = await page.$(selector);
                if (searchInput) {
                    console.log(`   ✅ Găsit câmp search: ${selector}`);
                    break;
                }
            } catch {}
        }

        if (!searchInput) {
            console.log(`   ⚠️  Nu am găsit câmp search`);
            return createEmptyResult(homeTeam, awayTeam, 'Search input not found');
        }

        // Type search query
        const query = `${homeTeam} ${awayTeam}`;
        await searchInput.type(query, { delay: 100 });
        await page.waitForTimeout(2000);
        await searchInput.press('Enter');
        await page.waitForTimeout(3000);

        // Check if we're on a match page
        const pageText = await page.evaluate(() => document.body.innerText);

        if (!pageText.includes(homeTeam) || !pageText.includes(awayTeam)) {
            console.log(`   ⚠️  Meciul nu a fost găsit pe Superbet`);
            return createEmptyResult(homeTeam, awayTeam, 'Match not found');
        }

        console.log(`   ✅ Meci găsit!`);

        // Extract odds
        const result = {
            homeTeam,
            awayTeam,
            bookmaker: 'Superbet',
            success: true,
            odds: {},
            extractedAt: new Date().toISOString()
        };

        // STEP 1: Extract Next Goal (visible by default)
        console.log(`\n💰 Extragere: Next Goal...`);

        result.odds.nextGoal = await extractNextGoal(page);

        if (result.odds.nextGoal) {
            console.log(`   ✅ ${result.odds.nextGoal.homeOdd} / ${result.odds.nextGoal.noGoalOdd} / ${result.odds.nextGoal.awayOdd}`);
        } else {
            console.log(`   ⚠️  Nu s-a putut extrage`);
        }

        // STEP 2: Extract 2nd Half markets
        console.log(`\n🖱️  Click pe tab "Reprize"...`);

        await page.evaluate(() => {
            const all = Array.from(document.querySelectorAll('*'));
            const tab = all.find(el => el.textContent.trim() === 'Reprize');
            if (tab) tab.click();
        });

        await page.waitForTimeout(3000);

        console.log(`💰 Extragere: Goluri Repriza 2...`);
        result.odds.secondHalfGoals = await extractSecondHalfGoals(page);

        if (result.odds.secondHalfGoals) {
            console.log(`   ✅ Under: ${result.odds.secondHalfGoals.under}, Over: ${result.odds.secondHalfGoals.over}`);
        } else {
            console.log(`   ⚠️  Nu s-a putut extrage`);
        }

        console.log(`💰 Extragere: GG Repriza 2...`);
        result.odds.secondHalfGG = await extractSecondHalfGG(page);

        if (result.odds.secondHalfGG) {
            console.log(`   ✅ DA: ${result.odds.secondHalfGG.yes}, NU: ${result.odds.secondHalfGG.no}`);
        } else {
            console.log(`   ⚠️  Nu s-a putut extrage`);
        }

        // STEP 3: Extract Corners
        console.log(`\n🖱️  Click pe tab "Cornere"...`);

        await page.evaluate(() => {
            const all = Array.from(document.querySelectorAll('*'));
            const tab = all.find(el => el.textContent.trim() === 'Cornere');
            if (tab) tab.click();
        });

        await page.waitForTimeout(3000);

        console.log(`📐 Extragere: Cornere...`);
        result.odds.corners = await extractCorners(page);

        if (result.odds.corners) {
            console.log(`   ✅ Under: ${result.odds.corners.under}, Over: ${result.odds.corners.over}`);
        } else {
            console.log(`   ⚠️  Nu s-a putut extrage`);
        }

        // STEP 4: Extract Cards
        console.log(`\n🖱️  Click pe tab "Cartonașe"...`);

        await page.evaluate(() => {
            const all = Array.from(document.querySelectorAll('*'));
            const tab = all.find(el => el.textContent.trim() === 'Cartonașe');
            if (tab) tab.click();
        });

        await page.waitForTimeout(3000);

        console.log(`🟨 Extragere: Cartonașe...`);
        result.odds.cards = await extractCards(page);

        if (result.odds.cards) {
            console.log(`   ✅ Under: ${result.odds.cards.under}, Over: ${result.odds.cards.over}`);
        } else {
            console.log(`   ⚠️  Nu s-a putut extrage`);
        }

        console.log('\n' + '='.repeat(70));
        return result;

    } catch (error) {
        console.error(`\n❌ EROARE: ${error.message}`);
        return createEmptyResult(homeTeam, awayTeam, error.message);

    } finally {
        if (browser) await browser.close();
    }
}

/**
 * Extract Next Goal odds
 */
async function extractNextGoal(page) {
    return await page.evaluate(() => {
        const lines = document.body.innerText.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.match(/^Golul \d+$/)) {
                let homeTeam = null, homeOdd = null;
                let noGoalOdd = null;
                let awayTeam = null, awayOdd = null;

                for (let j = 1; j <= 10 && i + j < lines.length; j++) {
                    const nextLine = lines[i + j].trim();

                    // Skip dashes
                    if (nextLine === '-') continue;

                    if (!homeTeam && nextLine.length > 3 && !nextLine.match(/^\d+\.\d+$/)) {
                        homeTeam = nextLine;
                    } else if (homeTeam && !homeOdd && nextLine.match(/^\d+\.\d+$/)) {
                        homeOdd = nextLine;
                    } else if (nextLine === 'Niciun gol') {
                        if (i + j + 1 < lines.length && lines[i + j + 1].trim() !== '-') {
                            noGoalOdd = lines[i + j + 1].trim();
                        }
                    } else if (homeOdd && noGoalOdd && !awayTeam && nextLine.length > 3 && !nextLine.match(/^\d+\.\d+$/)) {
                        awayTeam = nextLine;
                    } else if (awayTeam && !awayOdd && nextLine.match(/^\d+\.\d+$/)) {
                        awayOdd = nextLine;
                        break;
                    }
                }

                if (homeTeam && homeOdd && noGoalOdd && awayTeam && awayOdd) {
                    return { homeTeam, homeOdd, noGoalOdd, awayTeam, awayOdd };
                }
            }
        }

        return null;
    });
}

/**
 * Extract 2nd Half Goals
 */
async function extractSecondHalfGoals(page) {
    return await page.evaluate(() => {
        const lines = document.body.innerText.split('\n');

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() === 'A doua repriză - Total goluri') {
                let foundSub = false;
                let underOdd = null, overOdd = null;

                for (let j = 1; j <= 20 && i + j < lines.length; j++) {
                    const line = lines[i + j].trim();

                    if (line === 'SUB') {
                        foundSub = true;
                    } else if (line === '-') {
                        continue;
                    } else if (foundSub && !underOdd && line.match(/^\d+\.\d+$/)) {
                        underOdd = line;
                    } else if (underOdd && !overOdd && line.match(/^\d+\.\d+$/)) {
                        overOdd = line;
                        return { under: underOdd, over: overOdd };
                    }
                }
            }
        }

        return null;
    });
}

/**
 * Extract 2nd Half GG
 */
async function extractSecondHalfGG(page) {
    return await page.evaluate(() => {
        const lines = document.body.innerText.split('\n');

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().includes('A doua repriză') && lines[i].trim().includes('Ambele echipe marchează')) {
                let foundDA = false;
                let yesOdd = null, noOdd = null;

                for (let j = 1; j <= 20 && i + j < lines.length; j++) {
                    const line = lines[i + j].trim();

                    if (line === 'DA') {
                        foundDA = true;
                    } else if (line === '-') {
                        continue;
                    } else if (foundDA && !yesOdd && line.match(/^\d+\.\d+$/)) {
                        yesOdd = line;
                    } else if (yesOdd && !noOdd && line.match(/^\d+\.\d+$/)) {
                        noOdd = line;
                        return { yes: yesOdd, no: noOdd };
                    }
                }
            }
        }

        return null;
    });
}

/**
 * Extract Corners
 */
async function extractCorners(page) {
    return await page.evaluate(() => {
        const lines = document.body.innerText.split('\n');

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() === 'Total cornere') {
                let foundSub = false;
                let underOdd = null, overOdd = null;

                for (let j = 1; j <= 20 && i + j < lines.length; j++) {
                    const line = lines[i + j].trim();

                    if (line === 'SUB') {
                        foundSub = true;
                    } else if (line === '-') {
                        continue;
                    } else if (foundSub && !underOdd && line.match(/^\d+\.\d+$/)) {
                        underOdd = line;
                    } else if (underOdd && !overOdd && line.match(/^\d+\.\d+$/)) {
                        overOdd = line;
                        return { under: underOdd, over: overOdd };
                    }
                }
            }
        }

        return null;
    });
}

/**
 * Extract Cards
 */
async function extractCards(page) {
    return await page.evaluate(() => {
        const lines = document.body.innerText.split('\n');

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() === 'Total cartonașe') {
                let foundSub = false;
                let underOdd = null, overOdd = null;

                for (let j = 1; j <= 20 && i + j < lines.length; j++) {
                    const line = lines[i + j].trim();

                    if (line === 'SUB') {
                        foundSub = true;
                    } else if (line === '-') {
                        continue;
                    } else if (foundSub && !underOdd && line.match(/^\d+\.\d+$/)) {
                        underOdd = line;
                    } else if (underOdd && !overOdd && line.match(/^\d+\.\d+$/)) {
                        overOdd = line;
                        return { under: underOdd, over: overOdd };
                    }
                }
            }
        }

        return null;
    });
}

/**
 * Create empty result structure
 */
function createEmptyResult(homeTeam, awayTeam, error) {
    return {
        homeTeam,
        awayTeam,
        bookmaker: 'Superbet',
        success: false,
        error,
        odds: {
            nextGoal: null,
            secondHalfGoals: null,
            secondHalfGG: null,
            corners: null,
            cards: null
        },
        extractedAt: new Date().toISOString()
    };
}

// Export
module.exports = {
    scrapeSuperbetLiveOdds
};

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log(`
📖 USAGE:

   node SUPERBET_LIVE_SCRAPER_FINAL.js <homeTeam> <awayTeam> [--show]

📝 EXEMPLE:

   node SUPERBET_LIVE_SCRAPER_FINAL.js "Voluntari" "Sepsi"
   node SUPERBET_LIVE_SCRAPER_FINAL.js "FCSB" "CFR Cluj" --show

FLAGS:
   --show  Rulează browser vizibil (pentru debugging)
`);
        process.exit(0);
    }

    const homeTeam = args[0];
    const awayTeam = args[1];
    const showBrowser = args.includes('--show');

    (async () => {
        try {
            const result = await scrapeSuperbetLiveOdds(homeTeam, awayTeam, {
                headless: !showBrowser
            });

            console.log(`\n📊 REZULTAT FINAL:\n`);
            console.log(JSON.stringify(result, null, 2));

        } catch (error) {
            console.error(`\n❌ EROARE: ${error.message}\n`);
            process.exit(1);
        }
    })();
}
