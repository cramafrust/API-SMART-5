/**
 * 🎯 SUPERBET PUPPETEER SCRAPER
 *
 * Extrage cote REALE de la Superbet.ro folosind browser automation
 *
 * FUNCȚIONALITATE:
 * - Deschide browser headless
 * - Caută meciul pe Superbet
 * - Extrage cotele din pagină
 * - Returnează JSON structurat
 *
 * COTE EXTRASE:
 * - Match Result (1X2)
 * - Over/Under 2.5 goluri
 * - BTTS (Both Teams To Score)
 * - Team Total Goals
 * - Corners, Cards (dacă disponibile)
 */

const puppeteer = require('puppeteer');
const ResourceOptimizer = require('./RESOURCE_OPTIMIZER'); // ADĂUGAT: Optimizări resurse
const BrowserPool = require('./BROWSER_POOL'); // ADĂUGAT: Pool cu limită concurență

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
 * Extrage cote pentru un meci de pe Superbet
 */
async function scrapeSuperbetOdds(homeTeam, awayTeam, options = {}) {
    console.log(`\n🎯 EXTRAGERE COTE SUPERBET (Puppeteer - POOL)\n`);
    console.log('='.repeat(60));
    console.log(`⚽ Meci: ${homeTeam} vs ${awayTeam}`);

    // CORECTAT: Folosește BROWSER POOL (limită MAX 2 browsere simultan!)
    const launchOptions = {
        headless: options.headless !== false ? true : false,
        ignoreHTTPSErrors: true
    };

    console.log(`🔧 Browser Pool: MAX ${ResourceOptimizer.browserPool.maxConcurrent} browsere simultan`);

    const browser = await BrowserPool.launchBrowser(launchOptions); // POOL!

    try {
        const page = await browser.newPage();

        // Set viewport
        await page.setViewport({ width: 1920, height: 1080 });

        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log(`\n📥 Accesare Superbet.ro...`);

        // Go to Superbet fotbal page with longer timeout and different strategy
        try {
            await page.goto('https://www.superbet.ro/fotbal', {
                waitUntil: 'domcontentloaded', // Changed from networkidle2 (faster)
                timeout: 60000 // Increased timeout to 60s
            });
            console.log(`✅ Pagină încărcată`);

        } catch (error) {
            console.log(`⚠️  Timeout la încărcare, încerc fallback...`);

            // Try just the main page
            await page.goto('https://www.superbet.ro/', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            console.log(`✅ Pagină principală încărcată`);
        }

        // Wait for page to load
        await page.waitForTimeout(2000);

        // Search for match
        console.log(`\n🔍 Căutare meci: ${homeTeam} vs ${awayTeam}...`);

        // Try to find search input
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

        if (searchInput) {
            // Type team names
            await searchInput.type(`${homeTeam} ${awayTeam}`, { delay: 100 });
            await page.waitForTimeout(1500);

            // Press Enter or wait for results
            await searchInput.press('Enter');
            await page.waitForTimeout(2000);

        } else {
            console.log(`   ⚠️  Nu am găsit câmp search, caut direct în pagină...`);
        }

        // Look for match in page
        console.log(`\n📊 Căutare cote în pagină...`);

        // Try to find match element
        const matchFound = await page.evaluate((home, away) => {
            const normalizeText = (text) => text.toLowerCase().trim();

            const youthKw = ['u19', 'u21', 'u23', 'u20', 'u18', 'u17', 'u16', 'under ', 'youth', 'reserve', 'women', 'feminin'];
            const matchElements = Array.from(document.querySelectorAll('div, a, span')).filter(el => {
                const text = normalizeText(el.textContent || '');
                if (!text.includes(normalizeText(home)) || !text.includes(normalizeText(away))) return false;
                // Exclude meciuri youth/reserve
                return !youthKw.some(kw => text.includes(kw));
            });

            if (matchElements.length > 0) {
                // Click on first match (youth already filtered)
                const matchEl = matchElements[0];
                const clickable = matchEl.closest('a') || matchEl.closest('[onclick]') || matchEl;
                clickable.click();
                return true;
            }

            return false;

        }, homeTeam, awayTeam);

        if (matchFound) {
            console.log(`   ✅ Meci găsit, aștept încărcare cote...`);
            await page.waitForTimeout(3000);

        } else {
            console.log(`   ⚠️  Meciul nu a fost găsit automat`);
        }

        // Extract odds from page
        console.log(`\n💰 Extragere cote...`);

        const odds = await page.evaluate(() => {
            const result = {
                match_result: {},
                over_under: {},
                btts: {},
                team_goals: {},
                corners: {},
                cards: {},
                timestamp: new Date().toISOString()
            };

            // Helper to extract odd value
            const extractOdd = (element) => {
                if (!element) return null;
                const text = element.textContent.trim();
                const odd = parseFloat(text.replace(',', '.'));
                return isNaN(odd) ? null : odd;
            };

            // Try to find odds in various formats
            const oddElements = document.querySelectorAll('[class*="odd"], [class*="quote"], [class*="coefficient"]');

            oddElements.forEach(el => {
                const odd = extractOdd(el);
                if (odd && odd >= 1.01 && odd <= 100) {
                    // Try to determine market from context
                    const context = el.closest('[class*="market"], [class*="row"]');
                    const contextText = context ? context.textContent.toLowerCase() : '';

                    // Match Result (1X2)
                    if (contextText.includes('1x2') || contextText.includes('match result') || contextText.includes('rezultat final')) {
                        const label = el.getAttribute('data-label') || el.closest('[data-label]')?.getAttribute('data-label') || '';

                        if (label.includes('1') || el.textContent.includes('1')) {
                            result.match_result.home = odd;
                        } else if (label.includes('X') || label.includes('draw')) {
                            result.match_result.draw = odd;
                        } else if (label.includes('2')) {
                            result.match_result.away = odd;
                        }
                    }

                    // Over/Under 2.5
                    if (contextText.includes('over') || contextText.includes('under') || contextText.includes('2.5')) {
                        if (contextText.includes('over') || el.textContent.toLowerCase().includes('over')) {
                            result.over_under.over_2_5 = odd;
                        } else if (contextText.includes('under') || el.textContent.toLowerCase().includes('under')) {
                            result.over_under.under_2_5 = odd;
                        }
                    }

                    // BTTS
                    if (contextText.includes('btts') || contextText.includes('ambele echipe') || contextText.includes('both teams')) {
                        if (contextText.includes('yes') || contextText.includes('da')) {
                            result.btts.yes = odd;
                        } else if (contextText.includes('no') || contextText.includes('nu')) {
                            result.btts.no = odd;
                        }
                    }

                    // CARDS (Cartonașe)
                    if (contextText.includes('cards') || contextText.includes('cartonase') || contextText.includes('cartoane')) {
                        // Over/Under 2.5 cards
                        if (contextText.includes('2.5')) {
                            if (contextText.includes('over') || contextText.includes('peste')) {
                                result.cards.over_2_5 = odd;
                            } else if (contextText.includes('under') || contextText.includes('sub')) {
                                result.cards.under_2_5 = odd;
                            }
                        }
                        // Over/Under 3.5 cards
                        else if (contextText.includes('3.5')) {
                            if (contextText.includes('over') || contextText.includes('peste')) {
                                result.cards.over_3_5 = odd;
                            } else if (contextText.includes('under') || contextText.includes('sub')) {
                                result.cards.under_3_5 = odd;
                            }
                        }
                        // Over/Under 4.5 cards
                        else if (contextText.includes('4.5')) {
                            if (contextText.includes('over') || contextText.includes('peste')) {
                                result.cards.over_4_5 = odd;
                            } else if (contextText.includes('under') || contextText.includes('sub')) {
                                result.cards.under_4_5 = odd;
                            }
                        }
                        // Over/Under 5.5 cards
                        else if (contextText.includes('5.5')) {
                            if (contextText.includes('over') || contextText.includes('peste')) {
                                result.cards.over_5_5 = odd;
                            } else if (contextText.includes('under') || contextText.includes('sub')) {
                                result.cards.under_5_5 = odd;
                            }
                        }
                    }
                }
            });

            return result;
        });

        console.log(`\n✅ Cote extrase:`);
        console.log(JSON.stringify(odds, null, 2));

        // Check if we got any odds
        const hasOdds = Object.values(odds).some(market =>
            Object.keys(market).length > 0
        );

        if (!hasOdds) {
            console.log(`\n⚠️  Nu s-au putut extrage cote automat`);
            console.log(`   Probabil meciul nu e disponibil sau selectors-ii s-au schimbat`);

            // Take screenshot for debugging
            if (options.screenshot) {
                const screenshotPath = `/home/florian/API SMART 5/superbet-debug-${Date.now()}.png`;
                await page.screenshot({ path: screenshotPath });
                console.log(`   📸 Screenshot salvat: ${screenshotPath}`);
            }
        }

        console.log('\n' + '='.repeat(60));

        return {
            success: hasOdds,
            homeTeam: homeTeam,
            awayTeam: awayTeam,
            bookmaker: 'Superbet',
            odds: odds,
            extractedAt: new Date().toISOString()
        };

    } catch (error) {
        console.error(`\n❌ EROARE: ${error.message}`);
        throw error;

    } finally {
        await browser.close();
    }
}

/**
 * Extrage cote pentru multiple meciuri
 */
async function scrapeMultipleMatches(matches, delayMs = 5000) {
    console.log(`\n📦 EXTRAGERE BATCH: ${matches.length} meciuri\n`);
    console.log('='.repeat(60));

    const results = [];

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];

        console.log(`\n[${i + 1}/${matches.length}] ${match.homeTeam} vs ${match.awayTeam}`);

        try {
            const odds = await scrapeSuperbetOdds(match.homeTeam, match.awayTeam, {
                headless: true,
                screenshot: false
            });

            results.push(odds);

        } catch (error) {
            console.error(`   ❌ Eroare: ${error.message}`);
            results.push({
                success: false,
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
                error: error.message
            });
        }

        // Delay between matches
        if (i < matches.length - 1) {
            console.log(`   ⏳ Delay ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n✅ FINALIZAT: ${results.filter(r => r.success).length}/${matches.length} succesful`);

    return results;
}

// Export
module.exports = {
    scrapeSuperbetOdds,
    scrapeMultipleMatches
};

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log(`
📖 USAGE:

   node SUPERBET_PUPPETEER_SCRAPER.js <homeTeam> <awayTeam> [--show]

📝 EXEMPLE:

   node SUPERBET_PUPPETEER_SCRAPER.js "Liverpool" "Chelsea"
   node SUPERBET_PUPPETEER_SCRAPER.js "Real Madrid" "Barcelona" --show

FLAGS:
   --show        Rulează browser vizibil (pentru debugging)
   --screenshot  Salvează screenshot dacă nu găsește cote
`);
        process.exit(0);
    }

    const homeTeam = args[0];
    const awayTeam = args[1];
    const showBrowser = args.includes('--show');
    const screenshot = args.includes('--screenshot');

    (async () => {
        try {
            const result = await scrapeSuperbetOdds(homeTeam, awayTeam, {
                headless: !showBrowser,
                screenshot: screenshot
            });

            console.log(`\n📊 REZULTAT FINAL:\n`);
            console.log(JSON.stringify(result, null, 2));

        } catch (error) {
            console.error(`\n❌ EROARE: ${error.message}\n`);
            process.exit(1);
        }
    })();
}
