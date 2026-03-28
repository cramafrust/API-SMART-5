/**
 * 🤖→👨 SUPERBET HUMAN SCRAPER
 *
 * Scraper Puppeteer care se comportă ca un utilizator UMAN real
 *
 * TEHNICI ANTI-DETECTION:
 * - Scroll natural pe pagină
 * - Mișcări mouse realiste
 * - Timpi variabili între acțiuni
 * - Pauze aleatorii
 * - Stealth mode (mascare Puppeteer)
 * - Headers realistice
 * - Viewport random
 */

const puppeteer = require('puppeteer');
const BrowserPool = require('./BROWSER_POOL');

/**
 * Generează delay random între min și max (simulare comportament uman)
 */
function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Simulează scroll uman pe pagină
 */
async function humanScroll(page) {
    console.log(`   🖱️  Scroll pe pagină (uman)...`);

    // Scroll în pași mici, ca un om
    const scrollSteps = randomDelay(3, 6);

    for (let i = 0; i < scrollSteps; i++) {
        const scrollAmount = randomDelay(200, 500);

        await page.evaluate((pixels) => {
            window.scrollBy(0, pixels);
        }, scrollAmount);

        // Pauză mică între scrolluri
        await page.waitForTimeout(randomDelay(300, 800));
    }

    // Scroll înapoi la început (ca un om care se uită)
    await page.evaluate(() => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    await page.waitForTimeout(randomDelay(500, 1000));
}

/**
 * Simulează mișcări mouse aleatorii
 */
async function randomMouseMovements(page, count = 3) {
    console.log(`   🖱️  Mișcări mouse aleatorii...`);

    for (let i = 0; i < count; i++) {
        const x = randomDelay(100, 1500);
        const y = randomDelay(100, 900);

        await page.mouse.move(x, y, {
            steps: randomDelay(10, 30) // Mișcare graduală
        });

        await page.waitForTimeout(randomDelay(200, 600));
    }
}

/**
 * Type ca un om (cu delay între caractere)
 */
async function humanType(page, selector, text) {
    const element = await page.$(selector);
    if (!element) return false;

    // Click pe element
    await element.click();
    await page.waitForTimeout(randomDelay(300, 700));

    // Type cu delay variabil între caractere
    for (const char of text) {
        await page.keyboard.type(char, {
            delay: randomDelay(80, 250)
        });
    }

    return true;
}

/**
 * Configurare stealth pentru Puppeteer (evită detectarea)
 */
async function setupStealth(page) {
    // Override navigator.webdriver
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false
        });

        // Override chrome runtime
        window.navigator.chrome = {
            runtime: {}
        };

        // Override permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );

        // Override plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5]
        });

        // Override languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['ro-RO', 'ro', 'en-US', 'en']
        });
    });
}

/**
 * Extrage cote Superbet cu comportament UMAN
 */
async function scrapeSuperbetHuman(homeTeam, awayTeam, options = {}) {
    console.log(`\n🤖→👨 SUPERBET HUMAN SCRAPER\n`);
    console.log('='.repeat(60));
    console.log(`⚽ Meci: ${homeTeam} vs ${awayTeam}`);
    console.log(`⏱️  Mod: SIMULARE COMPORTAMENT UMAN`);

    let browser;
    try {
        browser = await BrowserPool.launchBrowser({
            defaultViewport: null,
            ignoreHTTPSErrors: true
        });
        const page = await browser.newPage();

        // Setup stealth
        await setupStealth(page);

        // Viewport random (ca un utilizator real)
        const viewportWidth = randomDelay(1366, 1920);
        const viewportHeight = randomDelay(768, 1080);

        await page.setViewport({
            width: viewportWidth,
            height: viewportHeight
        });

        console.log(`   🖥️  Viewport: ${viewportWidth}x${viewportHeight}`);

        // User agent realist
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];

        const selectedUA = userAgents[randomDelay(0, userAgents.length - 1)];
        await page.setUserAgent(selectedUA);

        console.log(`   👤 User-Agent: ${selectedUA.substring(0, 60)}...`);

        // Extra headers realistice
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        });

        console.log(`\n📥 Accesare Superbet.ro...`);
        console.log(`   ⏳ Comportament uman: pauze, scroll, mișcări mouse\n`);

        // PASUL 1: Accesare pagină cu timeout mare
        try {
            await page.goto('https://www.superbet.ro/', {
                waitUntil: 'domcontentloaded',
                timeout: 90000 // 90 secunde
            });

            console.log(`   ✅ Pagină principală încărcată`);

        } catch (error) {
            console.log(`   ⚠️  Prima încărcare eșuată, retry...`);

            // Retry
            await page.goto('https://www.superbet.ro/', {
                waitUntil: 'load',
                timeout: 90000
            });

            console.log(`   ✅ Pagină încărcată (retry)`);
        }

        // PASUL 2: Pauză ca un utilizator care se uită pe pagină
        const lookingTime = randomDelay(3000, 6000);
        console.log(`\n   👀 Privesc pagina (${lookingTime}ms)...`);
        await page.waitForTimeout(lookingTime);

        // PASUL 3: Scroll pe pagină (comportament uman)
        await humanScroll(page);

        // PASUL 4: Mișcări mouse aleatorii
        await randomMouseMovements(page, randomDelay(2, 4));

        // PASUL 5: Navigare către fotbal (dacă nu suntem deja acolo)
        console.log(`\n   ⚽ Navigare către secțiunea fotbal...`);

        try {
            // Caută link-ul către fotbal
            const fotbalLink = await page.$('a[href*="fotbal"]');

            if (fotbalLink) {
                // Mișcare mouse către link (ca un om)
                const box = await fotbalLink.boundingBox();
                if (box) {
                    await page.mouse.move(
                        box.x + box.width / 2,
                        box.y + box.height / 2,
                        { steps: randomDelay(15, 30) }
                    );

                    await page.waitForTimeout(randomDelay(500, 1200));

                    // Click
                    await fotbalLink.click();
                    console.log(`   ✅ Click pe link fotbal`);

                    await page.waitForTimeout(randomDelay(3000, 5000));
                }
            } else {
                // Navigare directă
                await page.goto('https://www.superbet.ro/fotbal', {
                    waitUntil: 'domcontentloaded',
                    timeout: 90000
                });

                console.log(`   ✅ Navigat direct la /fotbal`);
            }

        } catch (error) {
            console.log(`   ⚠️  Nu pot naviga la fotbal: ${error.message}`);
        }

        // PASUL 6: Așteaptă încărcarea completă
        await page.waitForTimeout(randomDelay(4000, 7000));

        // PASUL 7: Scroll din nou (ca un om care explorează)
        await humanScroll(page);

        // PASUL 8: Căutare meci
        console.log(`\n   🔍 Căutare meci: ${homeTeam} vs ${awayTeam}...`);

        // Încearcă să găsească câmp de căutare
        const searchSelectors = [
            'input[type="search"]',
            'input[placeholder*="Caută"]',
            'input[placeholder*="Căutare"]',
            'input[placeholder*="Search"]',
            '.search-input',
            'input.search',
            '#search',
            '[data-testid="search-input"]',
            '[aria-label*="Search"]'
        ];

        let searchFound = false;

        for (const selector of searchSelectors) {
            try {
                const searchInput = await page.$(selector);

                if (searchInput) {
                    console.log(`   ✅ Găsit câmp search: ${selector}`);

                    // Mișcare mouse către search box
                    const box = await searchInput.boundingBox();
                    if (box) {
                        await page.mouse.move(
                            box.x + box.width / 2,
                            box.y + box.height / 2,
                            { steps: randomDelay(20, 40) }
                        );
                    }

                    await page.waitForTimeout(randomDelay(800, 1500));

                    // Type ca un om
                    await searchInput.click();
                    await page.waitForTimeout(randomDelay(500, 1000));

                    // Type echipele cu delay uman
                    const searchText = `${homeTeam} ${awayTeam}`;
                    for (const char of searchText) {
                        await page.keyboard.type(char, {
                            delay: randomDelay(100, 300)
                        });
                    }

                    console.log(`   ✅ Tastat: "${searchText}"`);

                    await page.waitForTimeout(randomDelay(1000, 2000));

                    // Enter
                    await page.keyboard.press('Enter');

                    await page.waitForTimeout(randomDelay(3000, 5000));

                    searchFound = true;
                    break;
                }

            } catch (error) {
                // Continuă la următorul selector
            }
        }

        if (!searchFound) {
            console.log(`   ⚠️  Nu am găsit câmp search, caut direct în pagină...`);
        }

        // PASUL 9: Scroll pentru a vedea rezultatele
        await humanScroll(page);

        // PASUL 10: Caută meciul în pagină
        console.log(`\n   🎯 Căutare meci în pagină...`);

        const matchClicked = await page.evaluate((home, away) => {
            const normalize = (text) => text.toLowerCase().trim();

            // Caută toate elementele care conțin numele echipelor
            const allElements = Array.from(document.querySelectorAll('*'));

            const matchElements = allElements.filter(el => {
                const text = normalize(el.textContent || '');
                return text.includes(normalize(home)) && text.includes(normalize(away));
            });

            if (matchElements.length > 0) {
                console.log('Găsite', matchElements.length, 'elemente cu meciul');

                // Găsește elementul clickable (a, button, sau cu onclick)
                for (const el of matchElements) {
                    const clickable = el.closest('a') ||
                                     el.closest('button') ||
                                     el.closest('[onclick]') ||
                                     el;

                    if (clickable) {
                        clickable.scrollIntoView({ behavior: 'smooth', block: 'center' });

                        setTimeout(() => {
                            clickable.click();
                        }, 500);

                        return true;
                    }
                }
            }

            return false;

        }, homeTeam, awayTeam);

        if (matchClicked) {
            console.log(`   ✅ Meci găsit și click executat`);
            await page.waitForTimeout(randomDelay(5000, 8000));

        } else {
            console.log(`   ⚠️  Meciul nu a fost găsit în pagină`);
        }

        // PASUL 11: Screenshot pentru debugging
        if (options.screenshot) {
            const screenshotPath = `/home/florian/API SMART 5/superbet-human-${Date.now()}.png`;
            await page.screenshot({
                path: screenshotPath,
                fullPage: false
            });
            console.log(`\n   📸 Screenshot salvat: ${screenshotPath}`);
        }

        // PASUL 12: Extragere cote din pagină
        console.log(`\n   💰 Extragere cote...`);

        const odds = await page.evaluate(() => {
            const result = {
                available: false,
                match_result: {},
                over_under: {},
                btts: {},
                team_goals: {},
                raw_odds: []
            };

            // Caută toate elementele care pot conține cote
            const possibleOddSelectors = [
                '[class*="odd"]',
                '[class*="quote"]',
                '[class*="coefficient"]',
                '[class*="price"]',
                '[data-odd]',
                '.odd-value',
                '.quote-value'
            ];

            const oddElements = [];
            possibleOddSelectors.forEach(selector => {
                try {
                    const elements = Array.from(document.querySelectorAll(selector));
                    oddElements.push(...elements);
                } catch {}
            });

            oddElements.forEach(el => {
                const text = el.textContent.trim();
                const odd = parseFloat(text.replace(',', '.'));

                if (!isNaN(odd) && odd >= 1.01 && odd <= 100) {
                    result.raw_odds.push({
                        value: odd,
                        context: el.closest('[class*="market"]')?.textContent?.substring(0, 50) || ''
                    });

                    result.available = true;
                }
            });

            return result;
        });

        console.log(`\n   ${odds.available ? '✅' : '⚠️ '} Cote extrase: ${odds.raw_odds.length} găsite`);

        if (odds.raw_odds.length > 0) {
            console.log(`   📊 Preview cote:`);
            odds.raw_odds.slice(0, 10).forEach((odd, i) => {
                console.log(`      ${i + 1}. ${odd.value} (${odd.context.substring(0, 30)}...)`);
            });
        }

        console.log('\n' + '='.repeat(60));

        return {
            success: odds.available,
            homeTeam: homeTeam,
            awayTeam: awayTeam,
            bookmaker: 'Superbet',
            oddsCount: odds.raw_odds.length,
            odds: odds,
            extractedAt: new Date().toISOString()
        };

    } catch (error) {
        console.error(`\n❌ EROARE: ${error.message}`);

        return {
            success: false,
            error: error.message
        };

    } finally {
        if (browser) await browser.close();
    }
}

// Export
module.exports = {
    scrapeSuperbetHuman,
    humanScroll,
    humanType,
    randomMouseMovements
};

// CLI
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log(`
📖 USAGE:

   node SUPERBET_HUMAN_SCRAPER.js <homeTeam> <awayTeam> [--show] [--screenshot]

📝 EXEMPLE:

   node SUPERBET_HUMAN_SCRAPER.js "Liverpool" "Chelsea"
   node SUPERBET_HUMAN_SCRAPER.js "Real Madrid" "Barcelona" --show --screenshot

FLAGS:
   --show        Browser vizibil (pentru debugging)
   --screenshot  Salvează screenshot
`);
        process.exit(0);
    }

    const homeTeam = args[0];
    const awayTeam = args[1];
    const show = args.includes('--show');
    const screenshot = args.includes('--screenshot');

    (async () => {
        try {
            const result = await scrapeSuperbetHuman(homeTeam, awayTeam, {
                headless: !show,
                screenshot: screenshot
            });

            console.log(`\n📊 REZULTAT FINAL:\n`);
            console.log(JSON.stringify(result, null, 2));

            process.exit(result.success ? 0 : 1);

        } catch (error) {
            console.error(`\n❌ EROARE FATALĂ: ${error.message}\n`);
            process.exit(1);
        }
    })();
}
