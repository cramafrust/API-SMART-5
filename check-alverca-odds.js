const puppeteer = require('puppeteer');

async function checkAlvercaOdds() {
    console.log('🔍 Căutare cote pentru Alverca vs Estrela...\n');

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // Navighează la Superbet
        console.log('📱 Deschid Superbet...');
        await page.goto('https://www.superbet.ro/fotbal-pariuri-sportive/', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        await page.waitForTimeout(2000);

        // Caută "Alverca" în live
        console.log('🔎 Caut meciul Alverca vs Estrela...');

        // Verifică dacă meciul este live
        const matchFound = await page.evaluate(() => {
            const allText = document.body.innerText;
            return allText.includes('Alverca') || allText.includes('Estrela');
        });

        if (!matchFound) {
            console.log('❌ Meciul Alverca vs Estrela nu este găsit pe Superbet');
            console.log('   Posibil că meciul nu este disponibil pentru pariuri live');
            return null;
        }

        console.log('✅ Meci găsit!');

        // Încearcă să găsească cotele pentru "Total Goluri"
        const odds = await page.evaluate(() => {
            const results = {};

            // Caută toate elementele care conțin cote
            const allElements = document.querySelectorAll('[class*="odd"], [class*="quota"], [class*="coef"]');

            allElements.forEach(el => {
                const text = el.innerText || el.textContent;
                const parentText = el.parentElement ? el.parentElement.innerText : '';

                // Caută pattern-uri relevante
                if (parentText.includes('Total Goluri') || parentText.includes('Peste') || parentText.includes('Sub')) {
                    results[parentText.substring(0, 50)] = text;
                }
            });

            return results;
        });

        console.log('\n📊 COTE GĂSITE:');
        console.log(JSON.stringify(odds, null, 2));

        // Screenshot pentru verificare
        await page.screenshot({ path: 'alverca-superbet.png', fullPage: true });
        console.log('\n📸 Screenshot salvat: alverca-superbet.png');

        return odds;

    } catch (error) {
        console.error('❌ Eroare:', error.message);
        return null;
    } finally {
        await browser.close();
    }
}

// Rulează
checkAlvercaOdds()
    .then(odds => {
        if (odds && Object.keys(odds).length > 0) {
            console.log('\n✅ Cote extrase cu succes!');
        } else {
            console.log('\n⚠️  Nu am putut extrage cote - verifică screenshot-ul');
        }
    })
    .catch(err => {
        console.error('Fatal error:', err);
    });
