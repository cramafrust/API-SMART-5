/**
 * Testează structura URL-urilor pentru Conference League
 */
const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    console.log('🔍 Încărcare pagină rezultate Conference League...\n');

    await page.goto('https://www.flashscore.com/football/europe/conference-league-2024-2025/results/', {
        waitUntil: 'networkidle2',
        timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Extrage link-urile meciurilor
    const matches = await page.evaluate(() => {
        const results = [];
        const rows = document.querySelectorAll('.event__match');

        rows.forEach((row, idx) => {
            if (idx >= 3) return; // Doar primele 3

            const idAttr = row.getAttribute('id');
            const matchId = idAttr ? idAttr.replace('g_1_', '') : null;

            // Caută link-ul real de pe pagină
            const link = row.querySelector('a[href*="/match/"]');
            const href = link ? link.getAttribute('href') : null;

            // Extrage echipele
            const homeOld = row.querySelector('.event__participant--home')?.textContent?.trim();
            const awayOld = row.querySelector('.event__participant--away')?.textContent?.trim();

            results.push({
                index: idx,
                matchId: matchId,
                href: href,
                homeTeam: homeOld,
                awayTeam: awayOld
            });
        });

        return results;
    });

    console.log('📊 Primele 3 meciuri găsite:\n');
    matches.forEach(m => {
        console.log(`${m.index + 1}. ${m.homeTeam} vs ${m.awayTeam}`);
        console.log(`   ID din attribute: ${m.matchId}`);
        console.log(`   HREF găsit: ${m.href}`);
        console.log('');
    });

    // Testează primul meci - accesează pagina direct
    if (matches.length > 0 && matches[0].matchId) {
        const testId = matches[0].matchId;

        console.log(`🧪 TESTARE URL-uri pentru meci ID: ${testId}\n`);

        // Test 1: Summary
        console.log('1️⃣  Test Summary...');
        try {
            await page.goto(`https://www.flashscore.com/match/${testId}/#/match-summary`, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            console.log('   ✅ Summary - încărcat OK');
        } catch (e) {
            console.log(`   ❌ Summary - EROARE: ${e.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 2: Statistics tab
        console.log('\n2️⃣  Test Statistics tab...');
        try {
            await page.goto(`https://www.flashscore.com/match/${testId}/#/match-summary/match-statistics`, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            console.log('   ✅ Statistics - încărcat OK');

            // Verifică dacă există date
            const hasStats = await page.evaluate(() => {
                const rows = document.querySelectorAll('[class*="row"]');
                return rows.length > 0;
            });
            console.log(`   📊 Rows găsite: ${hasStats ? 'DA' : 'NU'}`);
        } catch (e) {
            console.log(`   ❌ Statistics - EROARE: ${e.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 3: Statistics/0 (Full Time)
        console.log('\n3️⃣  Test Statistics/0 (FT)...');
        try {
            await page.goto(`https://www.flashscore.com/match/${testId}/#/match-summary/match-statistics/0`, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            console.log('   ✅ Statistics/0 - încărcat OK');
        } catch (e) {
            console.log(`   ❌ Statistics/0 - EROARE: ${e.message}`);
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test 4: Statistics/1 (HT)
        console.log('\n4️⃣  Test Statistics/1 (HT)...');
        try {
            await page.goto(`https://www.flashscore.com/match/${testId}/#/match-summary/match-statistics/1`, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            console.log('   ✅ Statistics/1 - încărcat OK');
        } catch (e) {
            console.log(`   ❌ Statistics/1 - EROARE: ${e.message}`);
        }
    }

    await browser.close();
    console.log('\n✅ Test finalizat!');
})();
