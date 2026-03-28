/**
 * Test extragere cu scriptul corect (URL românești + selectori corecți)
 */
const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    const matchId = 'ChmsCBPa'; // Meci care ARE stats: 5-2 suturi, 5-6 cornere

    console.log(`🧪 Test cu URL-uri românești și selectori corecți\n`);
    console.log(`📋 Meci ID: ${matchId} (ar trebui să aibă 5-2 suturi, 5-6 cornere)\n`);

    // Test Stats FT
    const url = `https://www.flashscore.ro/meci/${matchId}/#/sumar/statistici/0`;
    console.log(`🌐 URL: ${url}\n`);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Scroll
    for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, 400));
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    const stats = await page.evaluate(() => {
        const homeStats = {};
        const awayStats = {};

        const rows = document.querySelectorAll('.wcl-row_2oCpS');

        rows.forEach(row => {
            const container = row.querySelector('.wcl-category_Ydwqh');
            if (!container) return;

            const categoryEl = container.querySelector('.wcl-category_6sT1J');
            if (!categoryEl) return;
            const category = categoryEl.textContent.trim();

            const homeValueEl = container.querySelector('[class*="wcl-homeValue"]');
            const awayValueEl = container.querySelector('[class*="wcl-awayValue"]');

            if (homeValueEl && awayValueEl) {
                homeStats[category] = homeValueEl.textContent.trim();
                awayStats[category] = awayValueEl.textContent.trim();
            }
        });

        return { homeStats, awayStats };
    });

    console.log('📊 Statistici extrase:\n');
    console.log('   Șuturi pe poartă:', stats.homeStats['Șuturi pe poartă'] || 'N/A', '-', stats.awayStats['Șuturi pe poartă'] || 'N/A');
    console.log('   Cornere:', stats.homeStats['Cornere'] || 'N/A', '-', stats.awayStats['Cornere'] || 'N/A');
    console.log('   Cartonașe galbene:', stats.homeStats['Cartonașe galbene'] || 'N/A', '-', stats.awayStats['Cartonașe galbene'] || 'N/A');

    console.log('\n📋 Toate statisticile găsite:');
    Object.keys(stats.homeStats).forEach(key => {
        console.log(`   ${key}: ${stats.homeStats[key]} - ${stats.awayStats[key]}`);
    });

    await browser.close();
    console.log('\n✅ Test finalizat!');
})();
