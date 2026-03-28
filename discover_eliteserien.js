/**
 * Discovery manual Eliteserien 2024 - fără verificare meciuri live
 * Scopul: să obținem toate matchId-urile din sezonul 2024
 */
const BrowserPool = require('./BROWSER_POOL');
const fs = require('fs');

const url = 'https://www.flashscore.com/football/norway/eliteserien-2024/results/';

async function discover() {
    console.log('Discovery Eliteserien 2024...');
    console.log('URL:', url);

    const browser = await BrowserPool.launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 3000));

    // Accept cookies
    try {
        const cookieBtn = await page.$('#onetrust-accept-btn-handler');
        if (cookieBtn) {
            await cookieBtn.click();
            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (e) {}

    // Click "Show more matches" repetat
    let clickCount = 0;
    while (clickCount < 30) {
        try {
            // Selector vechi
            let btn = await page.$('.event__more--static, a.event__more');

            // Selector nou
            if (!btn) {
                const handle = await page.evaluateHandle(() => {
                    const links = document.querySelectorAll('a');
                    for (const a of links) {
                        if (a.textContent.trim().toLowerCase().includes('show more matches')) return a;
                    }
                    return null;
                });
                if (handle && handle.asElement()) {
                    btn = handle.asElement();
                } else {
                    btn = null;
                }
            }

            if (!btn) {
                console.log(`Nu mai e buton "Show more" dupa ${clickCount} clickuri`);
                break;
            }

            await page.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), btn);
            await new Promise(r => setTimeout(r, 800));
            await btn.click();
            clickCount++;

            if (clickCount % 3 === 0) console.log(`  ... ${clickCount} clickuri`);
            await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));

        } catch (e) {
            console.log(`Buton disparut: ${e.message.substring(0, 50)}`);
            break;
        }
    }

    // Scroll complet
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
    await new Promise(r => setTimeout(r, 2000));

    // Extrage matchIds
    const matchIds = await page.evaluate(() => {
        const ids = [];
        const elements = document.querySelectorAll('[id^="g_1_"]');
        elements.forEach(el => {
            const id = el.id.replace('g_1_', '');
            if (id && id.length > 4) ids.push(id);
        });
        return ids;
    });

    console.log(`\nTotal meciuri gasite: ${matchIds.length}`);

    // Salvez în backfill_state
    const state = JSON.parse(fs.readFileSync('backfill_state.json', 'utf8'));
    const key = 'NORWAY: Eliteserien__2024';

    if (!state.leagues[key]) {
        state.leagues[key] = {
            discoveredIds: [],
            discoveredMatches: {},
            processedIds: [],
            failedIds: [],
            lastDiscovery: null,
            lastProcessing: null
        };
    }

    // Adaugă doar ID-uri noi
    const existing = new Set(state.leagues[key].discoveredIds);
    let newCount = 0;
    for (const id of matchIds) {
        if (!existing.has(id)) {
            state.leagues[key].discoveredIds.push(id);
            newCount++;
        }
    }
    state.leagues[key].lastDiscovery = new Date().toISOString();

    fs.writeFileSync('backfill_state.json', JSON.stringify(state, null, 2));
    console.log(`Noi: ${newCount}, Total în state: ${state.leagues[key].discoveredIds.length}`);
    console.log(`Deja procesate: ${state.leagues[key].processedIds.length}`);
    console.log(`De extras: ${state.leagues[key].discoveredIds.length - state.leagues[key].processedIds.length}`);

    await browser.close();
}

discover().catch(e => { console.error(e); process.exit(1); });
