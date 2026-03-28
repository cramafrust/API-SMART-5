/**
 * Salvează HTML-ul paginii de statistici pentru debug
 */
const puppeteer = require('puppeteer');
const BrowserPool = require('./BROWSER_POOL');
const fs = require('fs').promises;

(async () => {
    let browser;
    try {
    browser = await BrowserPool.launchBrowser();

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    const matchId = 'IJ17Yz1c';

    console.log(`📄 Salvare HTML pentru meci ${matchId}...\n`);

    // Stats FT
    await page.goto(`https://www.flashscore.com/match/${matchId}/#/match-summary/match-statistics/0`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });
    await new Promise(resolve => setTimeout(resolve, 5000));

    const html = await page.content();
    await fs.writeFile('/home/florian/API SMART 5/stats-page.html', html);

    // Screenshot
    await page.screenshot({ path: '/home/florian/API SMART 5/stats-page.png', fullPage: true });

    // Extrage toate clasele care conțin "stat" sau "row"
    const classes = await page.evaluate(() => {
        const allElements = document.querySelectorAll('*');
        const classSet = new Set();

        allElements.forEach(el => {
            const classList = el.className;
            if (typeof classList === 'string' && classList.length > 0) {
                const classes = classList.split(' ');
                classes.forEach(cls => {
                    if (cls.toLowerCase().includes('stat') ||
                        cls.toLowerCase().includes('row') ||
                        cls.toLowerCase().includes('category')) {
                        classSet.add(cls);
                    }
                });
            }
        });

        return Array.from(classSet).sort();
    });

    console.log('📋 Clase CSS găsite cu "stat", "row" sau "category":');
    classes.forEach(cls => console.log(`   - ${cls}`));

    // Caută textul "Shots on Goal"
    const shotsText = await page.evaluate(() => {
        const allElements = document.querySelectorAll('*');
        const results = [];

        allElements.forEach(el => {
            const text = el.textContent;
            if (text && text.toLowerCase().includes('shots on goal')) {
                results.push({
                    tag: el.tagName,
                    class: el.className,
                    text: text.trim().substring(0, 100)
                });
            }
        });

        return results.slice(0, 5);
    });

    console.log('\n🔍 Elemente care conțin "Shots on Goal":');
    shotsText.forEach((el, idx) => {
        console.log(`\n${idx + 1}. <${el.tag}> class="${el.class}"`);
        console.log(`   Text: ${el.text}`);
    });

    console.log('\n✅ Salvat: stats-page.html și stats-page.png');
    } finally {
        if (browser) await browser.close();
    }
})();
