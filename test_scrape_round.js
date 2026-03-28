/**
 * TEST: Scrapează etapa unui meci real
 */

const puppeteer = require('puppeteer');

async function test() {
    // Meci real Premier League - știm că ar trebui să aibă etapă
    const matchId = 'AFilY12h';
    const url = `https://www.flashscore.ro/meci/${matchId}/#/rezumat-meci`;

    console.log(`🔍 Testare scraping etapă pentru: ${url}\n`);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Screenshot
    await page.screenshot({ path: 'flashscore_round_debug.png', fullPage: true });
    console.log('📸 Screenshot salvat: flashscore_round_debug.png');

    // Extrage TOT textul de pe pagină
    const allText = await page.evaluate(() => document.body.innerText);
    console.log('\n📋 TOT TEXTUL de pe pagină:\n');
    console.log(allText.substring(0, 2000));

    // Caută "Round" în text
    const roundMatches = allText.match(/Round \d+/gi) || [];
    console.log(`\n🎯 Găsit "Round" în text: ${roundMatches.length} instanțe`);
    roundMatches.forEach(match => console.log(`   - ${match}`));

    await browser.close();
    console.log('\n✅ Test complet!');
}

test();
