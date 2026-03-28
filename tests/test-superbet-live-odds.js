/**
 * TEST EXTRAGERE COTE LIVE SUPERBET
 *
 * Extrage cote pentru:
 * - Next Goal (Golul următor)
 * - 2nd Half Goals (Goluri repriza 2)
 * - 2nd Half GG (Ambele marchează R2)
 * - Corners (Cornere)
 * - Cards (Cartonașe)
 */

const puppeteer = require('puppeteer');

async function extractSuperbetLiveOdds(matchUrl) {
    console.log('\n🎯 SUPERBET LIVE ODDS EXTRACTOR\n');
    console.log('='.repeat(70));

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        console.log(`\n📥 Accesare: ${matchUrl}`);
        await page.goto(matchUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        await page.waitForTimeout(8000);

        const result = {
            nextGoal: null,
            secondHalfGoals: null,
            secondHalfGG: null,
            corners: null,
            cards: null
        };

        // STEP 1: Extract Next Goal (visible by default)
        console.log('\n💰 EXTRAGERE: Next Goal (Golul următor)...');

        result.nextGoal = await page.evaluate(() => {
            const text = document.body.innerText;

            // More flexible pattern
            const lines = text.split('\n');
            let foundGolul = false;
            let homeTeam = null, homeOdd = null;
            let noGoalOdd = null;
            let awayTeam = null, awayOdd = null;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                if (line.match(/^Golul \d+$/)) {
                    foundGolul = true;

                    // Next 5-6 lines should contain: Team1, Odd1, "Niciun gol", Odd2, Team2, Odd3
                    for (let j = 1; j <= 10 && i + j < lines.length; j++) {
                        const nextLine = lines[i + j].trim();

                        // Check for team names (not a number)
                        if (!homeTeam && nextLine.length > 3 && !nextLine.match(/^\d+\.\d+$/)) {
                            homeTeam = nextLine;
                        } else if (homeTeam && !homeOdd && nextLine.match(/^\d+\.\d+$/)) {
                            homeOdd = nextLine;
                        } else if (nextLine === 'Niciun gol') {
                            // Next line is the no-goal odd
                            if (i + j + 1 < lines.length) {
                                noGoalOdd = lines[i + j + 1].trim();
                            }
                        } else if (homeOdd && noGoalOdd && !awayTeam && nextLine.length > 3 && !nextLine.match(/^\d+\.\d+$/)) {
                            awayTeam = nextLine;
                        } else if (awayTeam && !awayOdd && nextLine.match(/^\d+\.\d+$/)) {
                            awayOdd = nextLine;
                            break;
                        }
                    }

                    break;
                }
            }

            if (foundGolul && homeTeam && homeOdd && noGoalOdd && awayTeam && awayOdd) {
                return {
                    homeTeam,
                    homeOdd,
                    noGoalOdd,
                    awayTeam,
                    awayOdd
                };
            }

            return null;
        });

        if (result.nextGoal) {
            console.log(`   ✅ ${result.nextGoal.homeTeam}: ${result.nextGoal.homeOdd}`);
            console.log(`   ✅ Niciun gol: ${result.nextGoal.noGoalOdd}`);
            console.log(`   ✅ ${result.nextGoal.awayTeam}: ${result.nextGoal.awayOdd}`);
        } else {
            console.log('   ⚠️  Nu s-a putut extrage');
        }

        // STEP 2: Click on "Reprize" tab
        console.log('\n🖱️  Click pe tab "Reprize"...');

        await page.evaluate(() => {
            const allElements = Array.from(document.querySelectorAll('button, a, div, span'));
            const reprizaTab = allElements.find(el => el.textContent.trim() === 'Reprize');
            if (reprizaTab) {
                reprizaTab.click();
            }
        });

        await page.waitForTimeout(3000);

        // STEP 3: Extract 2nd Half markets
        console.log('\n💰 EXTRAGERE: Piețe Repriza 2...');

        const secondHalfData = await page.evaluate(() => {
            // Get all odd buttons on page
            const allOddButtons = document.querySelectorAll('.odd-button__odd-value');
            const allOdds = Array.from(allOddButtons).map(btn => {
                const odd = btn.textContent.trim();

                // Find parent container with market info
                let parent = btn.parentElement;
                let marketText = '';

                for (let i = 0; i < 20 && parent; i++) {
                    const text = parent.textContent;
                    if (text.includes('A doua repriză')) {
                        marketText = text.substring(0, 200);
                        break;
                    }
                    parent = parent.parentElement;
                }

                return { odd, marketText };
            });

            // Filter for 2nd half markets
            const goals = allOdds.filter(item =>
                item.marketText.includes('A doua repriză') &&
                item.marketText.includes('Total goluri') &&
                !item.marketText.includes('echipă')
            );

            const gg = allOdds.filter(item =>
                item.marketText.includes('A doua repriză') &&
                item.marketText.includes('Ambele echipe')
            );

            return {
                goals: goals.map(item => item.odd).filter(o => o && o !== ''),
                gg: gg.map(item => item.odd).filter(o => o && o !== '')
            };
        });

        console.log(`   Goluri R2: ${secondHalfData.goals.length} cote găsite`);
        console.log(`   GG R2: ${secondHalfData.gg.length} cote găsite`);

        // STEP 4: Click on "Cornere" tab
        console.log('\n🖱️  Click pe tab "Cornere"...');

        await page.evaluate(() => {
            const allElements = Array.from(document.querySelectorAll('button, a, div, span'));
            const tab = allElements.find(el => el.textContent.trim() === 'Cornere');
            if (tab) tab.click();
        });

        await page.waitForTimeout(3000);

        // Extract corners
        console.log('\n📐 EXTRAGERE: Cornere...');

        result.corners = await page.evaluate(() => {
            const text = document.body.innerText;
            const lines = text.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                if (line === 'Total cornere') {
                    // Next lines should have: CORNERE, SUB, PESTE, then line numbers and odds
                    let foundSub = false;
                    let underOdd = null, overOdd = null;

                    for (let j = 1; j <= 15 && i + j < lines.length; j++) {
                        const nextLine = lines[i + j].trim();

                        if (nextLine === 'SUB') {
                            foundSub = true;
                        } else if (foundSub && !underOdd && nextLine.match(/^\d+\.\d+$/)) {
                            underOdd = nextLine;
                        } else if (underOdd && !overOdd && nextLine.match(/^\d+\.\d+$/)) {
                            overOdd = nextLine;
                            break;
                        }
                    }

                    if (underOdd && overOdd) {
                        return { under: underOdd, over: overOdd };
                    }
                }
            }
            return null;
        });

        if (result.corners) {
            console.log(`   ✅ Under: ${result.corners.under}, Over: ${result.corners.over}`);
        } else {
            console.log('   ⚠️  Nu s-a putut extrage');
        }

        // STEP 5: Click on "Cartonașe" tab
        console.log('\n🖱️  Click pe tab "Cartonașe"...');

        await page.evaluate(() => {
            const allElements = Array.from(document.querySelectorAll('button, a, div, span'));
            const tab = allElements.find(el => el.textContent.trim() === 'Cartonașe');
            if (tab) tab.click();
        });

        await page.waitForTimeout(3000);

        // Extract cards
        console.log('\n🟨 EXTRAGERE: Cartonașe...');

        result.cards = await page.evaluate(() => {
            const text = document.body.innerText;
            const lines = text.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                if (line === 'Total cartonașe') {
                    let foundSub = false;
                    let underOdd = null, overOdd = null;

                    for (let j = 1; j <= 15 && i + j < lines.length; j++) {
                        const nextLine = lines[i + j].trim();

                        if (nextLine === 'SUB') {
                            foundSub = true;
                        } else if (foundSub && !underOdd && nextLine.match(/^\d+\.\d+$/)) {
                            underOdd = nextLine;
                        } else if (underOdd && !overOdd && nextLine.match(/^\d+\.\d+$/)) {
                            overOdd = nextLine;
                            break;
                        }
                    }

                    if (underOdd && overOdd) {
                        return { under: underOdd, over: overOdd };
                    }
                }
            }
            return null;
        });

        if (result.cards) {
            console.log(`   ✅ Under: ${result.cards.under}, Over: ${result.cards.over}`);
        } else {
            console.log('   ⚠️  Nu s-a putut extrage');
        }

        console.log('\n' + '='.repeat(70));
        console.log('\n📊 REZULTATE FINALE:\n');
        console.log(JSON.stringify(result, null, 2));

        return result;

    } finally {
        await browser.close();
    }
}

// Run
if (require.main === module) {
    const matchUrl = process.argv[2] || 'https://superbet.ro/cote/fotbal/voluntari-vs-sepsi-sfantu-gheorghe-8888915/?t=P-superLive&mdt=o';

    extractSuperbetLiveOdds(matchUrl)
        .then(result => {
            console.log('\n✅ FINALIZAT!\n');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ EROARE:', error.message);
            process.exit(1);
        });
}

module.exports = { extractSuperbetLiveOdds };
