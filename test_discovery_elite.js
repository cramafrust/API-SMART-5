const BrowserPool = require('./BROWSER_POOL');

async function test() {
    const url = 'https://www.flashscore.com/football/norway/eliteserien-2024/results/';
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

    // Caută toate butoanele posibile "Show more" / "Arată mai multe"
    const buttons = await page.evaluate(() => {
        const all = document.querySelectorAll('a, button, div');
        const results = [];
        all.forEach(el => {
            const text = el.textContent.trim().toLowerCase();
            const cls = el.className || '';
            if (text.includes('more') || text.includes('mai mult') || text.includes('show') ||
                cls.includes('more') || cls.includes('event__more')) {
                results.push({
                    tag: el.tagName,
                    class: cls.substring(0, 100),
                    text: text.substring(0, 80),
                    href: el.href || ''
                });
            }
        });
        return results;
    });

    console.log('\nButoane/linkuri cu "more":');
    buttons.forEach(b => console.log(`  <${b.tag}> class="${b.class}" text="${b.text}"`));

    // Numără meciurile vizibile
    const matchCount = await page.evaluate(() => {
        return document.querySelectorAll('.event__match, [id^="g_1_"]').length;
    });
    console.log('\nMeciuri vizibile:', matchCount);

    // Verifică dacă selectorul original există
    const origBtn = await page.$('.event__more--static, a.event__more');
    console.log('Selector original găsit:', !!origBtn);

    // Verifică și alte selectoare posibile
    const altBtns = await page.evaluate(() => {
        const selectors = [
            '.event__more--static',
            'a.event__more',
            '.event__more',
            '[class*="showMore"]',
            '[class*="more"]',
            'a[href="#"]'
        ];
        const results = {};
        for (const s of selectors) {
            const el = document.querySelector(s);
            results[s] = el ? el.textContent.trim().substring(0, 50) : null;
        }
        return results;
    });
    console.log('\nSelectoare testate:');
    Object.entries(altBtns).forEach(([s, v]) => console.log(`  ${s}: ${v || 'NOT FOUND'}`));

    await browser.close();
}

test().catch(e => { console.error(e.message); process.exit(1); });
