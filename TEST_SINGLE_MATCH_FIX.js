/**
 * Test extragere UN meci cu fix-ul corect
 */
const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    const matchId = 'IJ17Yz1c'; // Primul meci fără stats

    console.log(`🧪 Test extragere pentru ${matchId}\n`);

    // Test Stats FT
    console.log('📊 Extragere Stats FT (cu domcontentloaded)...');
    try {
        await page.goto(`https://www.flashscore.com/match/${matchId}/#/match-summary/match-statistics/0`, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await new Promise(resolve => setTimeout(resolve, 5000));

        const statsFT = await page.evaluate(() => {
            const result = {};
            const statRows = document.querySelectorAll('[class*="row"]');

            statRows.forEach(row => {
                const rowText = row.textContent;
                const numberPattern = /(\d+)\s*([A-Za-z\s]+)\s*(\d+)/;
                const match = rowText.match(numberPattern);

                if (match && match[2]) {
                    const statName = match[2].trim().toLowerCase();
                    const homeValue = parseInt(match[1]);
                    const awayValue = parseInt(match[3]);

                    if (statName.includes('shots on goal')) {
                        result.shots_on_goal = { home: homeValue, away: awayValue };
                    } else if (statName.includes('corner')) {
                        result.corners = { home: homeValue, away: awayValue };
                    } else if (statName.includes('yellow card')) {
                        result.yellow_cards = { home: homeValue, away: awayValue };
                    }
                }
            });

            return result;
        });

        console.log('✅ Stats FT extras:');
        console.log('   Shots on goal:', statsFT.shots_on_goal || 'N/A');
        console.log('   Corners:', statsFT.corners || 'N/A');
        console.log('   Yellow cards:', statsFT.yellow_cards || 'N/A');

    } catch (e) {
        console.log(`❌ EROARE: ${e.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test Stats HT
    console.log('\n📊 Extragere Stats HT (cu domcontentloaded)...');
    try {
        await page.goto(`https://www.flashscore.com/match/${matchId}/#/match-summary/match-statistics/1`, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await new Promise(resolve => setTimeout(resolve, 5000));

        const statsHT = await page.evaluate(() => {
            const result = {};
            const statRows = document.querySelectorAll('[class*="row"]');

            statRows.forEach(row => {
                const rowText = row.textContent;
                const numberPattern = /(\d+)\s*([A-Za-z\s]+)\s*(\d+)/;
                const match = rowText.match(numberPattern);

                if (match && match[2]) {
                    const statName = match[2].trim().toLowerCase();
                    const homeValue = parseInt(match[1]);
                    const awayValue = parseInt(match[3]);

                    if (statName.includes('shots on goal')) {
                        result.shots_on_goal = { home: homeValue, away: awayValue };
                    } else if (statName.includes('corner')) {
                        result.corners = { home: homeValue, away: awayValue };
                    } else if (statName.includes('yellow card')) {
                        result.yellow_cards = { home: homeValue, away: awayValue };
                    }
                }
            });

            return result;
        });

        console.log('✅ Stats HT extras:');
        console.log('   Shots on goal:', statsHT.shots_on_goal || 'N/A');
        console.log('   Corners:', statsHT.corners || 'N/A');
        console.log('   Yellow cards:', statsHT.yellow_cards || 'N/A');

    } catch (e) {
        console.log(`❌ EROARE: ${e.message}`);
    }

    await browser.close();
    console.log('\n✅ Test finalizat!');
})();
