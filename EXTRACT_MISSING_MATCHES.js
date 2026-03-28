/**
 * Extrage doar meciurile care lipsesc din JSON-CONFERENCE-LEAGUE.json
 */
const puppeteer = require('puppeteer');
const BrowserPool = require('./BROWSER_POOL');
const fs = require('fs').promises;

const LEAGUE_CONFIG = {
    url: 'https://www.flashscore.com/football/europe/conference-league-2024-2025/results/',
    file: '/home/florian/API SMART 5/JSON-CONFERENCE-LEAGUE.json'
};

const CAMPIONAT_INFO = {
    sezon: "2024-2025",
    data_start_sezon: "2024-10-03",
    data_sfarsit_sezon: "2025-05-28"
};

class MissingMatchesScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.minDelay = 2000;
        this.maxDelay = 4000;
    }

    randomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    async simulateHumanMouse() {
        const x = Math.floor(Math.random() * 800) + 100;
        const y = Math.floor(Math.random() * 600) + 100;
        await this.page.mouse.move(x, y, { steps: 10 });
        await new Promise(resolve => setTimeout(resolve, this.randomDelay(100, 500)));
    }

    async humanScroll(scrollAmount, times) {
        for (let i = 0; i < times; i++) {
            const randomScrollAmount = scrollAmount + Math.floor(Math.random() * 200) - 100;
            await this.page.evaluate((amount) => window.scrollBy(0, amount), randomScrollAmount);
            await new Promise(resolve => setTimeout(resolve, this.randomDelay(300, 800)));
            if (Math.random() > 0.7) {
                await this.simulateHumanMouse();
            }
        }
    }

    async init() {
        console.log('🔍 Identificare meciuri lipsă...\n');

        this.browser = await BrowserPool.launchBrowser();

        this.page = await this.browser.newPage();
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await this.page.setViewport({ width: 1920, height: 1080 });
        await this.page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });
    }

    async getAllMatchIds() {
        console.log('📥 Încărcare pagină rezultate...');
        await this.page.goto(LEAGUE_CONFIG.url, { waitForNetil: 'networkidle2', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, this.randomDelay(this.minDelay, this.maxDelay)));

        // Scroll pentru a încărca toate meciurile
        await this.humanScroll(500, 3);

        // Click pe "Show more matches" dacă există
        let clickedShowMore = false;
        try {
            const showMoreButton = await this.page.$('.event__more--static');
            if (showMoreButton) {
                await showMoreButton.click();
                console.log('✅ Am dat click pe "Show more matches"');
                await new Promise(resolve => setTimeout(resolve, this.randomDelay(this.minDelay, this.maxDelay)));
                clickedShowMore = true;
            }
        } catch (e) {
            console.log('ℹ️  Nu am găsit buton "Show more matches"');
        }

        // Scroll după click
        if (clickedShowMore) {
            await this.humanScroll(500, 5);
        }

        // Extrage toate ID-urile de meciuri
        const allMatches = await this.page.evaluate(() => {
            const results = [];
            const rows = document.querySelectorAll('.event__match');

            rows.forEach(row => {
                const idAttr = row.getAttribute('id');
                if (!idAttr) return;

                const matchId = idAttr.replace('g_1_', '');
                const timeElement = row.querySelector('.event__time');
                const time = timeElement ? timeElement.textContent.trim() : '';

                results.push({ id: matchId, time });
            });

            return results;
        });

        console.log(`📊 Total meciuri pe pagină: ${allMatches.length}`);

        // Filtrează pentru sezonul 2024-2025
        const dataStartSezon = new Date(CAMPIONAT_INFO.data_start_sezon);
        const dataFinalSezon = new Date(CAMPIONAT_INFO.data_sfarsit_sezon);

        const seasonMatches = allMatches.filter(m => {
            if (!m.time) return false;
            try {
                const datePart = m.time.split(' ')[0];
                const [day, month] = datePart.split('.').filter(x => x);

                let year = 2024;
                const monthNum = parseInt(month);
                if (monthNum >= 1 && monthNum <= 5) {
                    year = 2025;
                } else if (monthNum >= 10 && monthNum <= 12) {
                    year = 2024;
                } else {
                    return false;
                }

                const matchDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
                return matchDate >= dataStartSezon && matchDate <= dataFinalSezon;
            } catch (e) {
                return false;
            }
        });

        console.log(`✅ Meciuri din sezon 2024-2025: ${seasonMatches.length}`);
        return seasonMatches.map(m => m.id);
    }

    async getExistingMatchIds() {
        try {
            const jsonContent = await fs.readFile(LEAGUE_CONFIG.file, 'utf8');
            const data = JSON.parse(jsonContent);
            return data.meciuri.map(m => m.id_meci);
        } catch (e) {
            return [];
        }
    }

    async extractMatchDetails(matchId, index, total) {
        console.log(`\n[${index + 1}/${total}] 🔄 Extras meci ID: ${matchId}`);

        const matchUrl = `https://www.flashscore.com/match/${matchId}/#/match-summary/match-summary`;

        try {
            await this.page.goto(matchUrl, { waitForNetil: 'networkidle2', timeout: 60000 });
            await new Promise(resolve => setTimeout(resolve, this.randomDelay(this.minDelay, this.maxDelay)));
            await this.simulateHumanMouse();

            // Extrage scor
            const scor = await this.page.evaluate(() => {
                const homeScore = document.querySelector('.detailScore__wrapper span:first-child');
                const awayScore = document.querySelector('.detailScore__wrapper span:last-child');
                return {
                    final_gazda: homeScore ? parseInt(homeScore.textContent.trim()) : null,
                    final_oaspete: awayScore ? parseInt(awayScore.textContent.trim()) : null
                };
            });

            // Click pe HT score
            let scorPauza = { pauza_gazda: null, pauza_oaspete: null };
            try {
                await this.page.click('._tab_1bcnl_5._selected_1bcnl_30');
                await new Promise(resolve => setTimeout(resolve, 1000));

                scorPauza = await this.page.evaluate(() => {
                    const htScoreElement = document.querySelector('._value_jo4zd_9');
                    if (!htScoreElement) return { pauza_gazda: null, pauza_oaspete: null };

                    const htText = htScoreElement.textContent.trim();
                    const match = htText.match(/\((\d+)\s*-\s*(\d+)\)/);
                    if (!match) return { pauza_gazda: null, pauza_oaspete: null };

                    return {
                        pauza_gazda: parseInt(match[1]),
                        pauza_oaspete: parseInt(match[2])
                    };
                });
            } catch (e) {
                console.log(`  ⚠️  Nu am putut extrage scorul de la pauză: ${e.message}`);
            }

            // Click pe Statistics
            let statistici = {};
            try {
                await this.page.click('a[href*="#/match-summary/match-statistics"]');
                await new Promise(resolve => setTimeout(resolve, this.randomDelay(2000, 3000)));

                // Click Repriza 1
                try {
                    await this.page.click('._category_pywky_17._category_1h1x3_17._selected_pywky_27._selected_1h1x3_27');
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    const stats1H = await this.page.evaluate(() => {
                        const stats = {};
                        const rows = document.querySelectorAll('._row_1yicb_8');

                        rows.forEach(row => {
                            const categoryEl = row.querySelector('._category_1yicb_29');
                            if (!categoryEl) return;

                            const category = categoryEl.textContent.trim().toLowerCase();
                            const homeVal = row.querySelector('._homeValue_1yicb_86');
                            const awayVal = row.querySelector('._awayValue_1yicb_91');

                            const homeValue = homeVal ? parseInt(homeVal.textContent.trim()) : null;
                            const awayValue = awayVal ? parseInt(awayVal.textContent.trim()) : null;

                            if (category.includes('shots on goal')) {
                                stats.suturi_pe_poarta_1h = { r1_gazda: homeValue, r1_oaspete: awayValue };
                            } else if (category.includes('corner')) {
                                stats.cornere_1h = { r1_gazda: homeValue, r1_oaspete: awayValue };
                            } else if (category.includes('yellow card')) {
                                stats.cartonase_galbene_1h = { r1_gazda: homeValue, r1_oaspete: awayValue };
                            }
                        });

                        return stats;
                    });

                    statistici = { ...statistici, ...stats1H };
                } catch (e) {
                    console.log(`  ⚠️  Eroare la extragere Repriza 1: ${e.message}`);
                }

                // Click Repriza 2
                try {
                    await this.page.click('._category_pywky_17._category_1h1x3_17:nth-child(3)');
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    const stats2H = await this.page.evaluate(() => {
                        const stats = {};
                        const rows = document.querySelectorAll('._row_1yicb_8');

                        rows.forEach(row => {
                            const categoryEl = row.querySelector('._category_1yicb_29');
                            if (!categoryEl) return;

                            const category = categoryEl.textContent.trim().toLowerCase();
                            const homeVal = row.querySelector('._homeValue_1yicb_86');
                            const awayVal = row.querySelector('._awayValue_1yicb_91');

                            const homeValue = homeVal ? parseInt(homeVal.textContent.trim()) : null;
                            const awayValue = awayVal ? parseInt(awayVal.textContent.trim()) : null;

                            if (category.includes('shots on goal')) {
                                stats.suturi_pe_poarta_2h = { r2_gazda: homeValue, r2_oaspete: awayValue };
                            } else if (category.includes('corner')) {
                                stats.cornere_2h = { r2_gazda: homeValue, r2_oaspete: awayValue };
                            } else if (category.includes('yellow card')) {
                                stats.cartonase_galbene_2h = { r2_gazda: homeValue, r2_oaspete: awayValue };
                            }
                        });

                        return stats;
                    });

                    statistici = { ...statistici, ...stats2H };
                } catch (e) {
                    console.log(`  ⚠️  Eroare la extragere Repriza 2: ${e.message}`);
                }

                // Click Full Time pentru total
                try {
                    await this.page.click('._category_pywky_17._category_1h1x3_17:nth-child(1)');
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    const statsTotal = await this.page.evaluate(() => {
                        const stats = {};
                        const rows = document.querySelectorAll('._row_1yicb_8');

                        rows.forEach(row => {
                            const categoryEl = row.querySelector('._category_1yicb_29');
                            if (!categoryEl) return;

                            const category = categoryEl.textContent.trim().toLowerCase();
                            const homeVal = row.querySelector('._homeValue_1yicb_86');
                            const awayVal = row.querySelector('._awayValue_1yicb_91');

                            const homeValue = homeVal ? parseInt(homeVal.textContent.trim()) : null;
                            const awayValue = awayVal ? parseInt(awayVal.textContent.trim()) : null;

                            if (category.includes('shots on goal')) {
                                stats.suturi_pe_poarta_total = { total_gazda: homeValue, total_oaspete: awayValue };
                            } else if (category.includes('corner')) {
                                stats.cornere_total = { total_gazda: homeValue, total_oaspete: awayValue };
                            } else if (category.includes('yellow card')) {
                                stats.cartonase_galbene_total = { total_gazda: homeValue, total_oaspete: awayValue };
                            }
                        });

                        return stats;
                    });

                    statistici = { ...statistici, ...statsTotal };
                } catch (e) {
                    console.log(`  ⚠️  Eroare la extragere Full Time stats: ${e.message}`);
                }

            } catch (e) {
                console.log(`  ⚠️  Eroare la extragere statistici: ${e.message}`);
            }

            const matchData = {
                id_meci: matchId,
                scor: {
                    final_gazda: scor.final_gazda,
                    final_oaspete: scor.final_oaspete,
                    pauza_gazda: scorPauza.pauza_gazda,
                    pauza_oaspete: scorPauza.pauza_oaspete
                },
                statistici: {
                    suturi_pe_poarta: statistici.suturi_pe_poarta_total || { total_gazda: null, total_oaspete: null },
                    suturi_pe_poarta_repriza_1: statistici.suturi_pe_poarta_1h || { r1_gazda: null, r1_oaspete: null },
                    suturi_pe_poarta_repriza_2: statistici.suturi_pe_poarta_2h || { r2_gazda: null, r2_oaspete: null },
                    cornere: statistici.cornere_total || { total_gazda: null, total_oaspete: null },
                    cornere_repriza_1: statistici.cornere_1h || { r1_gazda: null, r1_oaspete: null },
                    cornere_repriza_2: statistici.cornere_2h || { r2_gazda: null, r2_oaspete: null },
                    cartonase_galbene: statistici.cartonase_galbene_total || { total_gazda: null, total_oaspete: null },
                    cartonase_galbene_repriza_1: statistici.cartonase_galbene_1h || { r1_gazda: null, r1_oaspete: null },
                    cartonase_galbene_repriza_2: statistici.cartonase_galbene_2h || { r2_gazda: null, r2_oaspete: null }
                }
            };

            console.log(`  ✅ Extras cu succes: ${scor.final_gazda}-${scor.final_oaspete} (HT: ${scorPauza.pauza_gazda}-${scorPauza.pauza_oaspete})`);
            return matchData;

        } catch (error) {
            console.error(`  ❌ EROARE la extragere: ${error.message}`);
            return null;
        }
    }

    async run() {
        try {
            await this.init();

            // Găsește toate ID-urile de pe pagină
            const allIds = await this.getAllMatchIds();
            console.log(`\n📋 Total meciuri în sezon: ${allIds.length}`);

            // Citește ID-urile existente
            const existingIds = await this.getExistingMatchIds();
            console.log(`💾 Meciuri deja extrase: ${existingIds.length}`);

            // Găsește meciurile lipsă
            const missingIds = allIds.filter(id => !existingIds.includes(id));
            console.log(`\n🎯 Meciuri LIPSĂ: ${missingIds.length}`);

            if (missingIds.length === 0) {
                console.log('\n✅ Nu lipsește niciun meci! JSON complet.');
                await this.browser.close();
                return;
            }

            console.log(`📝 ID-uri lipsă: ${missingIds.join(', ')}\n`);
            console.log('🚀 Încep extragerea...\n');

            // Extrage doar meciurile lipsă
            const newMatches = [];
            for (let i = 0; i < missingIds.length; i++) {
                const matchData = await this.extractMatchDetails(missingIds[i], i, missingIds.length);
                if (matchData) {
                    newMatches.push(matchData);
                }

                // Delay între meciuri
                if (i < missingIds.length - 1) {
                    const delay = this.randomDelay(this.minDelay, this.maxDelay);
                    console.log(`  ⏳ Aștept ${(delay / 1000).toFixed(1)}s...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            // Adaugă meciurile noi la JSON existent
            if (newMatches.length > 0) {
                const jsonContent = await fs.readFile(LEAGUE_CONFIG.file, 'utf8');
                const data = JSON.parse(jsonContent);

                data.meciuri.push(...newMatches);

                await fs.writeFile(
                    LEAGUE_CONFIG.file,
                    JSON.stringify(data, null, 2),
                    'utf8'
                );

                console.log(`\n✅ Am adăugat ${newMatches.length} meciuri noi în JSON!`);
                console.log(`📊 Total meciuri acum: ${data.meciuri.length}`);
            }

            await this.browser.close();
            console.log('\n🎉 GATA! Toate meciurile lipsă au fost extrase.');

        } catch (error) {
            console.error('❌ Eroare fatală:', error);
            if (this.browser) await this.browser.close();
            process.exit(1);
        }
    }
}

// Rulează
const scraper = new MissingMatchesScraper();
scraper.run();
