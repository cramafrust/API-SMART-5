/**
 * FETCH_FINAL_SCORES.js
 * 
 * Extrage scorurile finale pentru meciuri terminate
 */

const puppeteer = require('puppeteer');
const BrowserPool = require('./BROWSER_POOL');
const fs = require('fs');

async function getFinalScore(matchId) {
    let browser;
    try {
        browser = await BrowserPool.launchBrowser();
        const page = await browser.newPage();
        const url = `https://www.flashscore.ro/meci/${matchId}/#/rezumat-meci`;
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
        await page.waitForTimeout(2000);

        // Extrage scorul
        const scoreData = await page.evaluate(() => {
            // Scor final
            const scoreEl = document.querySelector('.detailScore__wrapper');
            if (!scoreEl) return null;

            const scoreText = scoreEl.textContent.trim();
            const parts = scoreText.split('-').map(s => s.trim());
            
            if (parts.length !== 2) return null;

            return {
                home: parseInt(parts[0]),
                away: parseInt(parts[1])
            };
        });

        return scoreData;
    } catch (err) {
        return null;
    } finally {
        if (browser) await browser.close();
    }
}

// Test
(async () => {
    const matchId = process.argv[2] || '8fV2pEqn';
    console.log(`Extrag scor pentru: ${matchId}`);
    const score = await getFinalScore(matchId);
    console.log('Scor:', score);
})();
