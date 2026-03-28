/**
 * Fix meciurile lipsă și cele fără HT/statistici din Conference League
 * Folosește metodele corecte de extragere
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

class MatchFixer {
    constructor() {
        this.browser = null;
        this.page = null;
        this.minDelay = 4000; // Măresc la 4-8s pentru a nu suprasolicita serverul
        this.maxDelay = 8000;
        this.navigationTimeout = 180000; // 3 minute pentru pagini lente
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

    async init() {
        console.log('🔧 Fix meciuri lipsă și incomplete...\n');

        this.browser = await BrowserPool.launchBrowser();

        this.page = await this.browser.newPage();
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await this.page.setViewport({ width: 1920, height: 1080 });
        await this.page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });
    }

    /**
     * Extrage HT Score din pagina Summary - URL românesc
     */
    async extractHTScore(matchId) {
        const url = `https://www.flashscore.ro/meci/${matchId}/#/sumar`;

        try {
            await this.page.goto(url, { waitUntil: 'networkidle2', timeout: this.navigationTimeout });
            await new Promise(resolve => setTimeout(resolve, 4000));

            const htScore = await this.page.evaluate(() => {
                const result = { home: null, away: null, found: false };

                // Caută în headerSections
                const headerSections = document.querySelectorAll('[class*="headerSection"]');
                headerSections.forEach(section => {
                    const text = section.textContent;
                    if (text && text.includes('1st Half')) {
                        const scoreMatch = text.match(/1st Half\s*(\d+)\s*-\s*(\d+)/i);
                        if (scoreMatch && !result.found) {
                            result.home = parseInt(scoreMatch[1]);
                            result.away = parseInt(scoreMatch[2]);
                            result.found = true;
                        }
                    }
                });

                // Backup - caută în toate elementele
                if (!result.found) {
                    const allElements = document.querySelectorAll('*');
                    allElements.forEach(el => {
                        const text = el.textContent;
                        if (text && text.length < 50 && text.includes('1st Half')) {
                            const scoreMatch = text.match(/1st Half\s*(\d+)\s*-\s*(\d+)/i);
                            if (scoreMatch && !result.found) {
                                result.home = parseInt(scoreMatch[1]);
                                result.away = parseInt(scoreMatch[2]);
                                result.found = true;
                            }
                        }
                    });
                }

                return result;
            });

            return htScore;

        } catch (error) {
            console.log(`  ⚠️  Eroare extragere HT: ${error.message}`);
            return { home: null, away: null, found: false };
        }
    }

    /**
     * Extrage statistici dintr-un URL de stats - EXACT ca scriptul original
     */
    async extractStats(matchId, period) {
        const periodNum = period === 'HT' ? '1' : '0';
        // URL românesc cu /meci/ și /sumar/statistici/
        const url = `https://www.flashscore.ro/meci/${matchId}/#/sumar/statistici/${periodNum}`;

        try {
            await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
            await new Promise(resolve => setTimeout(resolve, 4000)); // Wait 4s ca în scriptul original

            // Scroll pentru a încărca statisticile
            for (let i = 0; i < 3; i++) {
                await this.page.evaluate(() => window.scrollBy(0, 400));
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            const stats = await this.page.evaluate(() => {
                const homeStats = {};
                const awayStats = {};

                // Selectori EXACT ca în scriptul original
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

            // Parse statisticile în română
            const parseIntSafe = (val) => {
                if (val === null || val === undefined || val === '') return null;
                const parsed = parseInt(val);
                return isNaN(parsed) ? null : parsed;
            };

            const result = {
                shots_on_goal: {
                    home: parseIntSafe(stats.homeStats['Șuturi pe poartă']),
                    away: parseIntSafe(stats.awayStats['Șuturi pe poartă'])
                },
                corners: {
                    home: parseIntSafe(stats.homeStats['Cornere']),
                    away: parseIntSafe(stats.awayStats['Cornere'])
                },
                yellow_cards: {
                    home: parseIntSafe(stats.homeStats['Cartonașe galbene']),
                    away: parseIntSafe(stats.awayStats['Cartonașe galbene'])
                }
            };

            return result;

        } catch (error) {
            console.log(`  ⚠️  Eroare extragere stats ${period}: ${error.message}`);
            return {};
        }
    }

    /**
     * Extrage scor final din pagina principală - URL românesc
     */
    async extractFinalScore(matchId) {
        const url = `https://www.flashscore.ro/meci/${matchId}/#/sumar`;

        try {
            await this.page.goto(url, { waitUntil: 'networkidle2', timeout: this.navigationTimeout });
            await new Promise(resolve => setTimeout(resolve, 4000));

            const score = await this.page.evaluate(() => {
                const scoreSpans = document.querySelectorAll('.detailScore__wrapper span');
                if (scoreSpans.length >= 3) {
                    return {
                        home: parseInt(scoreSpans[0]?.textContent?.trim()),
                        away: parseInt(scoreSpans[2]?.textContent?.trim())
                    };
                }
                return { home: null, away: null };
            });

            return score;

        } catch (error) {
            console.log(`  ⚠️  Eroare extragere scor final: ${error.message}`);
            return { home: null, away: null };
        }
    }

    /**
     * Extrage complet un meci
     */
    async extractMatchComplete(matchId, index, total) {
        console.log(`\n[${index + 1}/${total}] 🔄 Extragere completă: ${matchId}`);

        // 1. Scor final
        const finalScore = await this.extractFinalScore(matchId);
        console.log(`  📊 Scor final: ${finalScore.home}-${finalScore.away}`);

        await new Promise(resolve => setTimeout(resolve, this.randomDelay(1000, 2000)));

        // 2. HT Score
        const htScore = await this.extractHTScore(matchId);
        if (htScore.found) {
            console.log(`  ✅ HT Score: ${htScore.home}-${htScore.away}`);
        } else {
            console.log(`  ⚠️  HT Score: nu am găsit`);
        }

        await new Promise(resolve => setTimeout(resolve, this.randomDelay(1000, 2000)));

        // 3. Statistici Full Time
        const statsFT = await this.extractStats(matchId, 'FT');
        console.log(`  📈 Stats FT: shots=${statsFT.shots_on_goal ? 'OK' : 'N/A'}, corners=${statsFT.corners ? 'OK' : 'N/A'}, yellows=${statsFT.yellow_cards ? 'OK' : 'N/A'}`);

        await new Promise(resolve => setTimeout(resolve, this.randomDelay(1000, 2000)));

        // 4. Statistici Half Time (Repriza 1)
        const statsHT = await this.extractStats(matchId, 'HT');
        console.log(`  📈 Stats R1: shots=${statsHT.shots_on_goal ? 'OK' : 'N/A'}, corners=${statsHT.corners ? 'OK' : 'N/A'}, yellows=${statsHT.yellow_cards ? 'OK' : 'N/A'}`);

        // Calculează R2 din FT - R1
        const statsR2 = {};
        if (statsFT.shots_on_goal && statsHT.shots_on_goal) {
            statsR2.shots_on_goal = {
                home: statsFT.shots_on_goal.home - statsHT.shots_on_goal.home,
                away: statsFT.shots_on_goal.away - statsHT.shots_on_goal.away
            };
        }
        if (statsFT.corners && statsHT.corners) {
            statsR2.corners = {
                home: statsFT.corners.home - statsHT.corners.home,
                away: statsFT.corners.away - statsHT.corners.away
            };
        }
        if (statsFT.yellow_cards && statsHT.yellow_cards) {
            statsR2.yellow_cards = {
                home: statsFT.yellow_cards.home - statsHT.yellow_cards.home,
                away: statsFT.yellow_cards.away - statsHT.yellow_cards.away
            };
        }

        // Construiește obiectul match
        const matchData = {
            id_meci: matchId,
            scor: {
                final_gazda: finalScore.home,
                final_oaspete: finalScore.away,
                pauza_gazda: htScore.home,
                pauza_oaspete: htScore.away
            },
            statistici: {
                suturi_pe_poarta: {
                    total_gazda: statsFT.shots_on_goal?.home || null,
                    total_oaspete: statsFT.shots_on_goal?.away || null
                },
                suturi_pe_poarta_repriza_1: {
                    r1_gazda: statsHT.shots_on_goal?.home || null,
                    r1_oaspete: statsHT.shots_on_goal?.away || null
                },
                suturi_pe_poarta_repriza_2: {
                    r2_gazda: statsR2.shots_on_goal?.home || null,
                    r2_oaspete: statsR2.shots_on_goal?.away || null
                },
                cornere: {
                    total_gazda: statsFT.corners?.home || null,
                    total_oaspete: statsFT.corners?.away || null
                },
                cornere_repriza_1: {
                    r1_gazda: statsHT.corners?.home || null,
                    r1_oaspete: statsHT.corners?.away || null
                },
                cornere_repriza_2: {
                    r2_gazda: statsR2.corners?.home || null,
                    r2_oaspete: statsR2.corners?.away || null
                },
                cartonase_galbene: {
                    total_gazda: statsFT.yellow_cards?.home || null,
                    total_oaspete: statsFT.yellow_cards?.away || null
                },
                cartonase_galbene_repriza_1: {
                    r1_gazda: statsHT.yellow_cards?.home || null,
                    r1_oaspete: statsHT.yellow_cards?.away || null
                },
                cartonase_galbene_repriza_2: {
                    r2_gazda: statsR2.yellow_cards?.home || null,
                    r2_oaspete: statsR2.yellow_cards?.away || null
                }
            }
        };

        console.log(`  ✅ Meci extras complet`);
        return matchData;
    }

    async run() {
        try {
            await this.init();

            // Citește JSON existent
            const jsonContent = await fs.readFile(LEAGUE_CONFIG.file, 'utf8');
            const data = JSON.parse(jsonContent);

            console.log(`📊 Meciuri în JSON: ${data.meciuri.length}\n`);

            // Identifică meciurile care trebuie re-extrase
            // 1. Meciuri fără HT score (pauza_gazda === null)
            // 2. Meciuri fără statistici complete

            const matchesToFix = [];

            data.meciuri.forEach(meci => {
                let needsFix = false;
                let reasons = [];

                // Verifică HT
                if (meci.scor.pauza_gazda === null || meci.scor.pauza_oaspete === null) {
                    needsFix = true;
                    reasons.push('HT lipsa');
                }

                // Verifică statistici
                if (!meci.statistici ||
                    !meci.statistici.suturi_pe_poarta ||
                    meci.statistici.suturi_pe_poarta.total_gazda === null) {
                    needsFix = true;
                    reasons.push('Stats lipsă');
                }

                if (needsFix) {
                    matchesToFix.push({
                        id: meci.id_meci,
                        reasons: reasons.join(', ')
                    });
                }
            });

            console.log(`🎯 Meciuri care trebuie fixate: ${matchesToFix.length}\n`);

            if (matchesToFix.length === 0) {
                console.log('✅ Toate meciurile sunt complete!\n');
                await this.browser.close();
                return;
            }

            matchesToFix.forEach((m, idx) => {
                console.log(`  ${idx + 1}. ${m.id} - ${m.reasons}`);
            });

            console.log('\n🚀 Încep re-extragerea...\n');

            // Re-extrage meciurile
            const fixedMatches = [];
            for (let i = 0; i < matchesToFix.length; i++) {
                const matchData = await this.extractMatchComplete(
                    matchesToFix[i].id,
                    i,
                    matchesToFix.length
                );
                fixedMatches.push(matchData);

                // Delay între meciuri
                if (i < matchesToFix.length - 1) {
                    const delay = this.randomDelay(this.minDelay, this.maxDelay);
                    console.log(`  ⏳ Aștept ${(delay / 1000).toFixed(1)}s...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            // Actualizează JSON-ul
            fixedMatches.forEach(fixedMatch => {
                const index = data.meciuri.findIndex(m => m.id_meci === fixedMatch.id_meci);
                if (index !== -1) {
                    // Actualizează meciul existent
                    data.meciuri[index] = fixedMatch;
                }
            });

            // Salvează JSON actualizat
            await fs.writeFile(
                LEAGUE_CONFIG.file,
                JSON.stringify(data, null, 2),
                'utf8'
            );

            console.log(`\n✅ Am actualizat ${fixedMatches.length} meciuri în JSON!`);
            console.log(`📊 Total meciuri acum: ${data.meciuri.length}`);

            await this.browser.close();
            console.log('\n🎉 GATA! Toate meciurile au fost fixate.');

        } catch (error) {
            console.error('❌ Eroare fatală:', error);
            if (this.browser) await this.browser.close();
            process.exit(1);
        }
    }
}

// Rulează
const fixer = new MatchFixer();
fixer.run();
