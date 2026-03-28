/**
 * SCRAPER UEFA CONFERENCE LEAGUE - API SMART 5
 * Extrage date EXACT cum apar pe FlashScore - NU calculăm nimic
 * Alertează dacă primim valori NULL (înseamnă că pagina nu s-a încărcat corect)
 * Sezon 2024-2025: Septembrie 2024 - Iunie 2025
 */

const puppeteer = require('puppeteer');
const BrowserPool = require('./BROWSER_POOL');
const fs = require('fs').promises;

const CAMPIONAT_INFO = {
    nume: "UEFA Conference League",
    nume_complet: "UEFA Europa Conference League",
    tara: "Europe",
    id_flashscore: "UEFA_CONFERENCE_LEAGUE_2024_2025",
    sezon: "2024-2025",
    sistem_organizare: "LEAGUE_PHASE_AND_KNOCKOUT",
    numar_echipe: 36,
    numar_total_etape: 6,
    data_start_sezon: "2024-10-03",
    data_sfarsit_sezon: "2025-05-28",
    explicatie_sistem: "Fază de ligă: 6 matchdays (3 oct - 19 dec 2024), 36 echipe, fiecare joacă 6 meciuri. Fazele eliminatorii: Play-offs (16 meciuri), Optimi (16), Sferturi (8), Semifinale (4), Finala (1). Total: ~153 meciuri."
};

const LEAGUE_CONFIG = {
    url: 'https://www.flashscore.com/football/europe/conference-league-2024-2025/results/',
    file: '/home/florian/API SMART 5/JSON-CONFERENCE-LEAGUE.json' // Salvează în API SMART 5
};

// Pentru test - limitează numărul de meciuri
const TEST_MODE = false;  // Dezactivat - extragere completă
const TEST_MATCHES_LIMIT = 1; // 1 meci pentru test
const TARGET_ROUND = process.argv[2] ? parseInt(process.argv[2]) : null; // Etapa din linia de comandă (null = toate)

// CONFIGURARE: Extrage DOAR meciurile din lista MECIURI_INCOMPLETE.txt
const ONLY_INCOMPLETE_MATCHES = true; // TRUE = extrage doar meciurile lipsă

class ConferenceLeagueScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.requestCount = 0;
        this.minDelay = 2000; // Delay minim între request-uri (2s)
        this.maxDelay = 4000; // Delay maxim între request-uri (4s)
        this.lastRequestTime = 0;
        this.errors = [];
        this.nullWarnings = []; // Track NULL warnings
        this.cachedStandings = null; // Cache pentru clasament
    }

    // Generează delay aleator între min și max (comportament uman)
    randomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Simulează mișcări naturale ale mouse-ului
    async simulateHumanMouse() {
        const x = Math.floor(Math.random() * 800) + 100;
        const y = Math.floor(Math.random() * 600) + 100;
        await this.page.mouse.move(x, y, { steps: 10 });
        await new Promise(resolve => setTimeout(resolve, this.randomDelay(100, 500)));
    }

    // Scroll natural cu delay-uri randomice
    async humanScroll(scrollAmount, times) {
        for (let i = 0; i < times; i++) {
            const randomScrollAmount = scrollAmount + Math.floor(Math.random() * 200) - 100;
            await this.page.evaluate((amount) => window.scrollBy(0, amount), randomScrollAmount);
            await new Promise(resolve => setTimeout(resolve, this.randomDelay(300, 800)));

            // Uneori mișcă mouse-ul în timp ce scrollează
            if (Math.random() > 0.7) {
                await this.simulateHumanMouse();
            }
        }
    }

    async init() {
        console.log(`🚀 [UEFA Conference League API SMART 5] Pornesc browser...\n`);

        this.browser = await BrowserPool.launchBrowser();

        this.page = await this.browser.newPage();

        // User agents aleatorii
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
        ];
        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
        await this.page.setUserAgent(randomUA);

        // Viewport aleator
        const viewports = [
            { width: 1920, height: 1080 },
            { width: 1366, height: 768 },
            { width: 1536, height: 864 },
            { width: 1440, height: 900 }
        ];
        const randomViewport = viewports[Math.floor(Math.random() * viewports.length)];
        await this.page.setViewport(randomViewport);

        // Ascunde faptul că e bot
        await this.page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        console.log(`✅ [UEFA Conference League API SMART 5] Browser pornit!\n`);
        console.log(`   User Agent: ${randomUA.substring(0, 60)}...`);
        console.log(`   Viewport: ${randomViewport.width}x${randomViewport.height}\n`);
    }

    async rateLimit() {
        const timeSinceLastRequest = Date.now() - this.lastRequestTime;

        // Delay aleator între minDelay și maxDelay (comportament uman)
        const randomDelay = this.randomDelay(this.minDelay, this.maxDelay);

        if (timeSinceLastRequest < randomDelay) {
            const sleepTime = randomDelay - timeSinceLastRequest;
            console.log(`   ⏳ Aștept ${(sleepTime/1000).toFixed(1)}s pentru a simula comportament uman...`);
            await new Promise(resolve => setTimeout(resolve, sleepTime));
        }

        this.lastRequestTime = Date.now();
        this.requestCount++;

        // Uneori mișcă mouse-ul înainte de request (15% șansă)
        if (Math.random() > 0.85) {
            await this.simulateHumanMouse();
        }
    }

    parseDateTime(dateString) {
        if (!dateString) return { data: null, ora: null, zi_saptamana: null };

        try {
            const parts = dateString.split(' ');
            const datePart = parts[0]; // "01.06.2025"
            const timePart = parts[1]; // "19:00"

            // Convert DD.MM.YYYY to YYYY-MM-DD
            const [day, month, year] = datePart.split('.');
            const isoDate = `${year}-${month}-${day}`;

            // Calculăm ziua săptămânii
            const dateObj = new Date(isoDate);
            const daysRO = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
            const dayOfWeek = daysRO[dateObj.getDay()];

            return {
                data: isoDate,
                ora: timePart || null,
                zi_saptamana: dayOfWeek
            };
        } catch (error) {
            return { data: null, ora: null, zi_saptamana: null };
        }
    }

    extractMatchId(url) {
        // Metodă 1: Încearcă să extragi din query parameter ?mid=XXX
        const midMatch = url.match(/[?&]mid=([A-Za-z0-9]+)/);
        if (midMatch) {
            return midMatch[1];
        }

        // Metodă 2: Extrage ultimul segment din path (pentru URL-uri fără mid)
        const pathMatch = url.match(/\/([A-Za-z0-9]+)\/?(?:\?|$)/);
        return pathMatch ? pathMatch[1] : null;
    }

    async loadAllMatches() {
        console.log(`📥 [UEFA Conference League API SMART 5] ÎNCĂRCARE MECIURI...\n`);
        console.log('='.repeat(80) + '\n');

        await this.page.goto(LEAGUE_CONFIG.url, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Delay aleator 3-5 secunde pentru încărcare inițială
        const initialDelay = this.randomDelay(3000, 5000);
        console.log(`   ⏳ Aștept ${(initialDelay/1000).toFixed(1)}s pentru încărcare...\n`);
        await new Promise(resolve => setTimeout(resolve, initialDelay));

        // Simulează mișcare mouse
        await this.simulateHumanMouse();

        console.log(`🔄 [UEFA Conference League API SMART 5] Click pe "Show more matches"...\n`);

        let clickCount = 0;

        // Click pe "Show More Matches" până când nu mai există
        for (let i = 0; i < 50; i++) {
            const matchesBefore = await this.page.evaluate(() => {
                return document.querySelectorAll('.event__match').length;
            });

            const clicked = await this.page.evaluate(() => {
                const button = document.querySelector('.wclButtonLink, button.wclButtonLink, [class*="wclButtonLink"]');

                if (button && button.offsetParent !== null) {
                    const text = button.textContent.toLowerCase();
                    if (text.includes('show') || text.includes('more') || text.includes('match')) {
                        button.click();
                        return true;
                    }
                }
                return false;
            });

            if (clicked) {
                clickCount++;

                // Delay aleator 3-5 secunde după click (comportament uman)
                const clickDelay = this.randomDelay(3000, 5000);
                await new Promise(resolve => setTimeout(resolve, clickDelay));

                const matchesAfter = await this.page.evaluate(() => {
                    return document.querySelectorAll('.event__match').length;
                });

                console.log(`   Click #${clickCount}: ${matchesBefore} → ${matchesAfter} meciuri (+${matchesAfter - matchesBefore})`);

                if (matchesAfter === matchesBefore) {
                    console.log(`   → Nu s-au adăugat meciuri, opresc.\n`);
                    break;
                }

                // Scroll natural după click
                await this.humanScroll(400, 2);

            } else {
                if (i >= 2) {
                    console.log(`\n   → Butonul nu mai există.\n`);
                    break;
                }

                // Scroll natural pentru a căuta butonul
                await this.humanScroll(800, 1);
            }
        }

        console.log(`✅ [UEFA Conference League API SMART 5] Total click-uri: ${clickCount}\n`);

        // Scroll final natural
        console.log(`🔄 [UEFA Conference League API SMART 5] Scroll final natural...\n`);
        await this.humanScroll(1500, 30);

        // Delay final aleator
        const finalDelay = this.randomDelay(3000, 5000);
        console.log(`   ⏳ Aștept ${(finalDelay/1000).toFixed(1)}s final...\n`);
        await new Promise(resolve => setTimeout(resolve, finalDelay));

        // Extrage lista meciurilor
        const allMatches = await this.page.evaluate(() => {
            const results = [];
            let currentRound = null;
            let currentStage = 'REGULAR'; // REGULAR, PLAYOFF, PLAYOUT

            const allElements = document.querySelectorAll('.event__round, .event__match');

            allElements.forEach(el => {
                if (el.classList.contains('event__round')) {
                    const roundText = el.textContent.trim();

                    // Detectăm faza din text
                    if (roundText.includes('Playoff') || roundText.includes('Championship')) {
                        currentStage = 'PLAYOFF';
                    } else if (roundText.includes('Playout') || roundText.includes('Relegation')) {
                        currentStage = 'PLAYOUT';
                    } else {
                        currentStage = 'REGULAR';
                    }

                    const roundMatch = roundText.match(/Round\s+(\d+)/i);
                    if (roundMatch) {
                        currentRound = parseInt(roundMatch[1]);
                    }
                    return;
                }

                if (el.classList.contains('event__match')) {
                    try {
                        const homeEl = el.querySelector('.event__participant--home, .event__homeParticipant');
                        if (!homeEl) return;
                        const homeTeam = homeEl.textContent.trim();

                        const awayEl = el.querySelector('.event__participant--away, .event__awayParticipant');
                        if (!awayEl) return;
                        const awayTeam = awayEl.textContent.trim();

                        const scoreHome = el.querySelector('.event__score--home');
                        const scoreAway = el.querySelector('.event__score--away');
                        const score = (scoreHome && scoreAway)
                            ? `${scoreHome.textContent.trim()}-${scoreAway.textContent.trim()}`
                            : '';

                        const linkEl = el.querySelector('a[href*="/match/"]');
                        if (!linkEl) return;
                        const href = linkEl.getAttribute('href');
                        const matchUrl = href.startsWith('http') ? href : 'https://www.flashscore.com' + href;

                        const timeEl = el.querySelector('.event__time');
                        const matchDate = timeEl ? timeEl.textContent.trim() : '';

                        // Doar meciuri terminate (cu scor)
                        if (score) {
                            results.push({
                                homeTeam,
                                awayTeam,
                                score,
                                time: matchDate,
                                matchId: matchUrl,
                                round: currentRound ? `Round ${currentRound}` : null,
                                roundNumber: currentRound,
                                stage: currentStage
                            });
                        }
                    } catch (e) {
                        // Skip
                    }
                }
            });

            return results;
        });

        console.log(`✅ [UEFA Conference League API SMART 5] Total meciuri încărcate: ${allMatches.length}\n`);

        // FILTRARE DUPĂ DATĂ: Extragem doar meciurile din sezonul 2024-2025
        // Interval: 2024-10-03 (primul meci league phase) până la 2025-05-28 (finala)
        const dataStartSezon = new Date('2024-10-03');
        const dataFinalSezon = new Date('2025-05-28');

        const allSeasonMatches = allMatches.filter(m => {
            if (!m.time) return false;

            try {
                // Parse data din format "DD.MM. HH:MM" (FlashScore nu afișează anul!)
                const datePart = m.time.split(' ')[0]; // "DD.MM."
                const [day, month] = datePart.split('.').filter(x => x);

                // Presupun anul: octombrie-decembrie 2024, ianuarie-mai 2025
                let year = 2024;
                const monthNum = parseInt(month);
                if (monthNum >= 1 && monthNum <= 5) {
                    year = 2025;
                } else if (monthNum >= 10 && monthNum <= 12) {
                    year = 2024;
                } else {
                    // Luni 6-9: posibil alte sezoane, excludem
                    return false;
                }

                const matchDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);

                // Verifică dacă meciul e în intervalul sezonului 2024-2025
                return matchDate >= dataStartSezon && matchDate <= dataFinalSezon;
            } catch (e) {
                console.log(`   ⚠️ Eroare parsare dată pentru meci: ${m.homeTeam} vs ${m.awayTeam} (${m.time})`);
                return false;
            }
        });

        console.log(`✅ [UEFA Conference League API SMART 5] Meciuri selectate pentru extragere: ${allSeasonMatches.length}`);
        console.log(`⚠️  Meciurile includ faza de ligă și fazele eliminatorii!\n`);

        // FILTRARE SUPLIMENTARĂ: Extrage DOAR meciurile din MECIURI_INCOMPLETE.txt
        let filteredMatches = allSeasonMatches;
        if (ONLY_INCOMPLETE_MATCHES) {
            try {
                const incompleteIds = (await fs.readFile('MECIURI_INCOMPLETE.txt', 'utf8'))
                    .split('\n')
                    .filter(id => id.trim().length > 0);

                filteredMatches = allSeasonMatches.filter(m => incompleteIds.includes(m.matchId));

                console.log(`🎯 [ONLY_INCOMPLETE_MATCHES = TRUE] Extrag DOAR meciurile din lista (${filteredMatches.length}/${allSeasonMatches.length})\n`);
            } catch (e) {
                console.log(`⚠️  Nu am putut citi MECIURI_INCOMPLETE.txt: ${e.message}`);
                console.log(`   → Continui cu toate meciurile (${allSeasonMatches.length})\n`);
                filteredMatches = allSeasonMatches;
            }
        }

        // Dacă a fost specificată o etapă în linia de comandă, extrage doar acea etapă
        if (TARGET_ROUND !== null) {
            const roundMatches = filteredMatches.filter(m => m.roundNumber === TARGET_ROUND);
            console.log(`⚠️  Extrag doar Etapa ${TARGET_ROUND} (${roundMatches.length} meciuri)\n`);
            return roundMatches;
        }

        // TEST MODE - limitează numărul de meciuri per etapă
        if (TEST_MODE) {
            console.log(`⚠️  TEST MODE: Limitez la ${TEST_MATCHES_LIMIT} meciuri per etapă\n`);
            // Grupează pe etape și ia doar primele TEST_MATCHES_LIMIT meciuri din fiecare
            const limitedMatches = [];
            const byRound = {};
            allSeasonMatches.forEach(m => {
                if (!byRound[m.roundNumber]) byRound[m.roundNumber] = [];
                byRound[m.roundNumber].push(m);
            });
            Object.keys(byRound).forEach(round => {
                limitedMatches.push(...byRound[round].slice(0, TEST_MATCHES_LIMIT));
            });
            return limitedMatches;
        }

        return filteredMatches;
    }

    parseIntSafe(value) {
        if (!value) return null;
        const parsed = parseInt(value);
        return isNaN(parsed) ? null : parsed;
    }

    checkForNulls(matchInfo, htStats, ftStats) {
        // Verifică dacă avem NULL-uri unde NU ar trebui să fie
        const warnings = [];

        // Verifică statistici critice HT
        const criticalStatsHT = ['Șuturi pe poartă', 'Cornere', 'Cartonașe galbene', 'Faulturi', 'Ofsaiduri'];

        criticalStatsHT.forEach(stat => {
            if (htStats.home[stat] === null || htStats.away[stat] === null) {
                warnings.push(`⚠️  NULL în HT pentru "${stat}"`);
            }
        });

        // Verifică statistici critice FT
        criticalStatsHT.forEach(stat => {
            if (ftStats.home[stat] === null || ftStats.away[stat] === null) {
                warnings.push(`⚠️  NULL în FT pentru "${stat}"`);
            }
        });

        if (warnings.length > 0) {
            console.log(`\n   ⚠️⚠️⚠️  AVERTISMENT NULL pentru ${matchInfo}:`);
            warnings.forEach(w => console.log(`      ${w}`));
            console.log(`   → Posibil: pagina nu s-a încărcat complet sau selectori greșiți!\n`);

            this.nullWarnings.push({
                match: matchInfo,
                warnings: warnings
            });
        }

        return warnings.length > 0;
    }

    async extractPeriodStats(url, period, matchInfo) {
        await this.rateLimit();

        try {
            const roUrl = url
                .replace('flashscore.com', 'flashscore.ro')
                .replace('/match-summary/period-scores/', '/sumar/statistici/')
                .replace('/match/', '/meci/')
                .replace('/football/', '/fotbal/');

            await this.page.goto(roUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            // Așteptăm 4 secunde pentru încărcarea JavaScript
            await new Promise(resolve => setTimeout(resolve, 4000));

            // OPTIMIZAT: Scroll redus pentru a încărca statisticile
            for (let i = 0; i < 3; i++) {
                await this.page.evaluate(() => window.scrollBy(0, 400));
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            const data = await this.page.evaluate(() => {
                const homeScoreEl = document.querySelector('.detailScore__wrapper span:first-child');
                const awayScoreEl = document.querySelector('.detailScore__wrapper span:last-child');

                const homeScore = homeScoreEl ? homeScoreEl.textContent.trim() : null;
                const awayScore = awayScoreEl ? awayScoreEl.textContent.trim() : null;

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

                return { homeScore, awayScore, homeStats, awayStats };
            });

            // Construim obiectul returnat
            const result = {
                score: {
                    home: this.parseIntSafe(data.homeScore),
                    away: this.parseIntSafe(data.awayScore)
                },
                statistics: {
                    home: {
                        'Șuturi pe poartă': this.parseIntSafe(data.homeStats['Șuturi pe poartă']),
                        'Total șuturi': this.parseIntSafe(data.homeStats['Total șuturi']),
                        'Cornere': this.parseIntSafe(data.homeStats['Cornere']),
                        'Cartonașe galbene': this.parseIntSafe(data.homeStats['Cartonașe galbene']),
                        'Cartonașe roșii': this.parseIntSafe(data.homeStats['Cartonașe roșii']) || 0, // Default 0
                        'Intervenții portar': this.parseIntSafe(data.homeStats['Intervenții portar']),
                        'Faulturi': this.parseIntSafe(data.homeStats['Faulturi']),
                        'Ofsaiduri': this.parseIntSafe(data.homeStats['Ofsaiduri'])
                    },
                    away: {
                        'Șuturi pe poartă': this.parseIntSafe(data.awayStats['Șuturi pe poartă']),
                        'Total șuturi': this.parseIntSafe(data.awayStats['Total șuturi']),
                        'Cornere': this.parseIntSafe(data.awayStats['Cornere']),
                        'Cartonașe galbene': this.parseIntSafe(data.awayStats['Cartonașe galbene']),
                        'Cartonașe roșii': this.parseIntSafe(data.awayStats['Cartonașe roșii']) || 0, // Default 0
                        'Intervenții portar': this.parseIntSafe(data.awayStats['Intervenții portar']),
                        'Faulturi': this.parseIntSafe(data.awayStats['Faulturi']),
                        'Ofsaiduri': this.parseIntSafe(data.awayStats['Ofsaiduri'])
                    }
                }
            };

            return result;

        } catch (error) {
            this.errors.push({ url, period, error: error.message });
            console.log(`   ❌ EROARE la extragere ${period}: ${error.message}`);
            return null;
        }
    }

    async extractHTScoreAndMetadata(url) {
        await this.rateLimit();

        try {
            const roUrl = url
                .replace('flashscore.com', 'flashscore.ro')
                .replace('/match/', '/meci/')
                .replace('/football/', '/fotbal/');

            await this.page.goto(roUrl, { waitUntil: 'networkidle2', timeout: 60000 });
            await new Promise(resolve => setTimeout(resolve, 4000)); // Mărit la 4000ms pentru încărcare completă

            const data = await this.page.evaluate(() => {
                const homeTeamEl = document.querySelector('.duelParticipant__home .participant__participantName');
                const awayTeamEl = document.querySelector('.duelParticipant__away .participant__participantName');

                const homeTeam = homeTeamEl ? homeTeamEl.textContent.trim() : null;
                const awayTeam = awayTeamEl ? awayTeamEl.textContent.trim() : null;

                const dateEl = document.querySelector('.duelParticipant__startTime');
                const date = dateEl ? dateEl.textContent.trim() : null;

                // EXTRACT SCOR FINAL - din zona principală mare
                let ftScoreHome = null;
                let ftScoreAway = null;

                const homeScoreEl = document.querySelector('.detailScore__wrapper span:first-child');
                const awayScoreEl = document.querySelector('.detailScore__wrapper span:last-child');

                if (homeScoreEl && awayScoreEl) {
                    const homeText = homeScoreEl.textContent.trim();
                    const awayText = awayScoreEl.textContent.trim();

                    ftScoreHome = parseInt(homeText);
                    ftScoreAway = parseInt(awayText);

                    // Verificare NaN
                    if (isNaN(ftScoreHome)) ftScoreHome = null;
                    if (isNaN(ftScoreAway)) ftScoreAway = null;
                }

                // EXTRACT HT SCORE - din sectiunea wclHeaderSection cu "Repriza 1"
                let htScoreHome = null;
                let htScoreAway = null;

                // Metoda 1: Căutăm în wclHeaderSection--summary care conține "Repriza 1"
                const headerSections = document.querySelectorAll('.wclHeaderSection--summary');
                for (let section of headerSections) {
                    const overlines = section.querySelectorAll('.wcl-overline_uwiIT');

                    // Verificăm dacă prima secțiune conține "Repriza 1"
                    if (overlines.length >= 2 && overlines[0].textContent.includes('Repriza 1')) {
                        // A doua secțiune conține scorul (ex: "1 - 0")
                        const scoreDiv = overlines[1].querySelector('div');
                        if (scoreDiv) {
                            const scoreText = scoreDiv.textContent.trim();
                            const scoreMatch = scoreText.match(/(\d+)\s*-\s*(\d+)/);
                            if (scoreMatch) {
                                htScoreHome = parseInt(scoreMatch[1]);
                                htScoreAway = parseInt(scoreMatch[2]);
                                break;
                            }
                        }
                    }
                }

                // Metoda 2 (Fallback): Căutăm generic după "REPRIZA 1" în div-uri
                if (htScoreHome === null) {
                    const allSections = document.querySelectorAll('div');
                    for (let section of allSections) {
                        const text = section.textContent;

                        if (text.includes('REPRIZA 1') || text.includes('REPRIZĂ 1') || text.includes('Repriza 1')) {
                            const scoreMatch = text.match(/(\d+)\s*-\s*(\d+)/);
                            if (scoreMatch) {
                                htScoreHome = parseInt(scoreMatch[1]);
                                htScoreAway = parseInt(scoreMatch[2]);
                                break;
                            }
                        }
                    }
                }

                return { homeTeam, awayTeam, date, ftScoreHome, ftScoreAway, htScoreHome, htScoreAway };
            });

            return data;

        } catch (error) {
            this.errors.push({ url, type: 'metadata', error: error.message });
            return null;
        }
    }

    async extractStandings(matchUrl, useCache = true) {
        // Dacă avem cache și este permis să îl folosim, returnăm cache-ul
        if (useCache && this.cachedStandings !== null) {
            console.log(`      → Folosesc clasament din cache (${this.cachedStandings.length} echipe)`);
            return this.cachedStandings;
        }

        const standingsUrl = matchUrl.replace(/\/#.+$/, '').replace(/\/$/, '') + '/standings/';

        await this.rateLimit();

        try {
            await this.page.goto(standingsUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(resolve => setTimeout(resolve, 3000)); // Mărit la 3000ms pentru încărcare clasament

            const standings = await this.page.evaluate(() => {
                const rows = document.querySelectorAll('.ui-table__row');
                const result = [];

                rows.forEach(row => {
                    const teamEl = row.querySelector('.tableCellParticipant__name');
                    if (!teamEl) return;

                    const teamName = teamEl.textContent.trim();

                    const positionEl = row.querySelector('.table__cell--rank');
                    const position = positionEl ? positionEl.textContent.trim().replace('.', '') : null;

                    result.push({
                        position: position ? parseInt(position) : null,
                        team: teamName
                    });
                });

                return { result, rowsCount: rows.length };
            });

            console.log(`      → Găsite ${standings.rowsCount} rânduri, ${standings.result.length} echipe`);

            // Salvăm în cache doar dacă am extras cu succes
            if (standings.result.length > 0) {
                this.cachedStandings = standings.result;
                console.log(`      → Clasament salvat în cache`);
            }

            return standings.result;

        } catch (error) {
            this.errors.push({ url: standingsUrl, type: 'standings', error: error.message });
            return [];
        }
    }

    displayCompleteMatchData(matchData) {
        console.log('\n' + '═'.repeat(80));
        console.log('   📋 TOATE VALORILE EXTRASE PENTRU MECI');
        console.log('═'.repeat(80));

        console.log(`\n   🆔 IDENTIFICARE:`);
        console.log(`      ID Meci: ${matchData.id_meci || 'NULL'}`);
        console.log(`      ID FlashScore: ${matchData.id_flashscore || 'NULL'}`);
        console.log(`      Fază: ${matchData.faza}`);
        console.log(`      Etapă: ${matchData.etapa}`);
        console.log(`      Etapă totală: ${matchData.etapa_totala}`);

        console.log(`\n   📅 DATA & ORA:`);
        console.log(`      Data: ${matchData.data_ora.data || 'NULL'}`);
        console.log(`      Ora: ${matchData.data_ora.ora || 'NULL'}`);
        console.log(`      Zi săptămână: ${matchData.data_ora.zi_saptamana || 'NULL'}`);

        console.log(`\n   🏠 ECHIPA GAZDĂ:`);
        console.log(`      Nume: ${matchData.echipa_gazda.nume}`);
        console.log(`      Nume complet: ${matchData.echipa_gazda.nume_complet}`);
        console.log(`      Poziție clasament: ${matchData.echipa_gazda.pozitie_clasament_inainte || 'NULL'}`);

        console.log(`\n   ✈️  ECHIPA OASPETE:`);
        console.log(`      Nume: ${matchData.echipa_oaspete.nume}`);
        console.log(`      Nume complet: ${matchData.echipa_oaspete.nume_complet}`);
        console.log(`      Poziție clasament: ${matchData.echipa_oaspete.pozitie_clasament_inainte || 'NULL'}`);

        console.log(`\n   ⚽ SCOR:`);
        console.log(`      Final Gazdă: ${matchData.scor.final_gazda ?? 'NULL'}`);
        console.log(`      Final Oaspete: ${matchData.scor.final_oaspete ?? 'NULL'}`);
        console.log(`      Pauză Gazdă: ${matchData.scor.pauza_gazda ?? 'NULL'}`);
        console.log(`      Pauză Oaspete: ${matchData.scor.pauza_oaspete ?? 'NULL'}`);

        const stats = matchData.statistici;
        if (stats) {
            console.log(`\n   📊 STATISTICI - Șuturi pe poartă:`);
            console.log(`      Pauză: ${stats.suturi_pe_poarta.pauza_gazda ?? 'NULL'} - ${stats.suturi_pe_poarta.pauza_oaspete ?? 'NULL'}`);
            console.log(`      Repriza 2: ${stats.suturi_pe_poarta.repriza_2_gazda ?? 'NULL'} - ${stats.suturi_pe_poarta.repriza_2_oaspete ?? 'NULL'}`);
            console.log(`      Total: ${stats.suturi_pe_poarta.total_gazda ?? 'NULL'} - ${stats.suturi_pe_poarta.total_oaspete ?? 'NULL'}`);

            console.log(`\n   📊 STATISTICI - Total șuturi:`);
            console.log(`      Pauză: ${stats.total_suturi.pauza_gazda ?? 'NULL'} - ${stats.total_suturi.pauza_oaspete ?? 'NULL'}`);
            console.log(`      Repriza 2: ${stats.total_suturi.repriza_2_gazda ?? 'NULL'} - ${stats.total_suturi.repriza_2_oaspete ?? 'NULL'}`);
            console.log(`      Total: ${stats.total_suturi.total_gazda ?? 'NULL'} - ${stats.total_suturi.total_oaspete ?? 'NULL'}`);

            console.log(`\n   📊 STATISTICI - Cornere:`);
            console.log(`      Repriza 1: ${stats.cornere.repriza_1_gazda ?? 'NULL'} - ${stats.cornere.repriza_1_oaspete ?? 'NULL'}`);
            console.log(`      Repriza 2: ${stats.cornere.repriza_2_gazda ?? 'NULL'} - ${stats.cornere.repriza_2_oaspete ?? 'NULL'}`);
            console.log(`      Total: ${stats.cornere.total_gazda ?? 'NULL'} - ${stats.cornere.total_oaspete ?? 'NULL'}`);

            console.log(`\n   📊 STATISTICI - Cartonașe galbene:`);
            console.log(`      Pauză: ${stats.cartonase_galbene.pauza_gazda ?? 'NULL'} - ${stats.cartonase_galbene.pauza_oaspete ?? 'NULL'}`);
            console.log(`      Repriza 2: ${stats.cartonase_galbene.repriza_2_gazda ?? 'NULL'} - ${stats.cartonase_galbene.repriza_2_oaspete ?? 'NULL'}`);
            console.log(`      Total: ${stats.cartonase_galbene.total_gazda ?? 'NULL'} - ${stats.cartonase_galbene.total_oaspete ?? 'NULL'}`);

            console.log(`\n   📊 STATISTICI - Cartonașe roșii:`);
            console.log(`      Pauză: ${stats.cartonase_rosii.pauza_gazda ?? 'NULL'} - ${stats.cartonase_rosii.pauza_oaspete ?? 'NULL'}`);
            console.log(`      Repriza 2: ${stats.cartonase_rosii.repriza_2_gazda ?? 'NULL'} - ${stats.cartonase_rosii.repriza_2_oaspete ?? 'NULL'}`);
            console.log(`      Total: ${stats.cartonase_rosii.total_gazda ?? 'NULL'} - ${stats.cartonase_rosii.total_oaspete ?? 'NULL'}`);

            console.log(`\n   📊 STATISTICI - Intervenții portar:`);
            console.log(`      Pauză: ${stats.suturi_salvate.pauza_gazda ?? 'NULL'} - ${stats.suturi_salvate.pauza_oaspete ?? 'NULL'}`);
            console.log(`      Repriza 2: ${stats.suturi_salvate.repriza_2_gazda ?? 'NULL'} - ${stats.suturi_salvate.repriza_2_oaspete ?? 'NULL'}`);
            console.log(`      Total: ${stats.suturi_salvate.total_gazda ?? 'NULL'} - ${stats.suturi_salvate.total_oaspete ?? 'NULL'}`);

            console.log(`\n   📊 STATISTICI - Faulturi:`);
            console.log(`      Pauză: ${stats.faulturi.pauza_gazda ?? 'NULL'} - ${stats.faulturi.pauza_oaspete ?? 'NULL'}`);
            console.log(`      Repriza 2: ${stats.faulturi.repriza_2_gazda ?? 'NULL'} - ${stats.faulturi.repriza_2_oaspete ?? 'NULL'}`);
            console.log(`      Total: ${stats.faulturi.total_gazda ?? 'NULL'} - ${stats.faulturi.total_oaspete ?? 'NULL'}`);

            console.log(`\n   📊 STATISTICI - Ofsaiduri:`);
            console.log(`      Pauză: ${stats.ofsaiduri.pauza_gazda ?? 'NULL'} - ${stats.ofsaiduri.pauza_oaspete ?? 'NULL'}`);
            console.log(`      Repriza 2: ${stats.ofsaiduri.repriza_2_gazda ?? 'NULL'} - ${stats.ofsaiduri.repriza_2_oaspete ?? 'NULL'}`);
            console.log(`      Total: ${stats.ofsaiduri.total_gazda ?? 'NULL'} - ${stats.ofsaiduri.total_oaspete ?? 'NULL'}`);
        } else {
            console.log(`\n   ⚠️  STATISTICI: NULL`);
        }

        console.log('\n' + '═'.repeat(80) + '\n');
    }

    fixYellowCards(p1Home, p1Away, p2Home, p2Away, ftHome, ftAway, matchInfo) {
        // Extrage valorile pentru cartonașe galbene
        let p1HomeYellow = p1Home['Cartonașe galbene'];
        let p1AwayYellow = p1Away['Cartonașe galbene'];
        let p2HomeYellow = p2Home['Cartonașe galbene'];
        let p2AwayYellow = p2Away['Cartonașe galbene'];
        let ftHomeYellow = ftHome['Cartonașe galbene'];
        let ftAwayYellow = ftAway['Cartonașe galbene'];

        // CAZ SPECIAL: TOATE valorile sunt NULL → Meciul nu a avut deloc cartonașe galbene
        // Completăm toate cu 0
        if (p1HomeYellow === null && p2HomeYellow === null && ftHomeYellow === null) {
            p1HomeYellow = 0;
            p2HomeYellow = 0;
            ftHomeYellow = 0;
            console.log(`   ✅ AUTO-FIX: Cartonașe galbene Gazdă: TOATE NULL → 0 (meciul nu a avut cartonașe)`);
        }

        if (p1AwayYellow === null && p2AwayYellow === null && ftAwayYellow === null) {
            p1AwayYellow = 0;
            p2AwayYellow = 0;
            ftAwayYellow = 0;
            console.log(`   ✅ AUTO-FIX: Cartonașe galbene Oaspete: TOATE NULL → 0 (meciul nu a avut cartonașe)`);
        }

        // CAZ 1: Repriza 2 este NULL, dar pauză și final sunt valide și egale
        // → Înseamnă că nu au fost cartonașe în Repriza 2
        if (p2HomeYellow === null && p1HomeYellow !== null && ftHomeYellow !== null) {
            if (p1HomeYellow === ftHomeYellow) {
                p2HomeYellow = 0;
                console.log(`   ✅ AUTO-FIX: Cartonașe galbene Repriza 2 Gazdă: NULL → 0 (pauză=${p1HomeYellow}, final=${ftHomeYellow})`);
            }
        }

        if (p2AwayYellow === null && p1AwayYellow !== null && ftAwayYellow !== null) {
            if (p1AwayYellow === ftAwayYellow) {
                p2AwayYellow = 0;
                console.log(`   ✅ AUTO-FIX: Cartonașe galbene Repriza 2 Oaspete: NULL → 0 (pauză=${p1AwayYellow}, final=${ftAwayYellow})`);
            }
        }

        // CAZ 2: Repriza 1 (pauză) este NULL, dar Repriza 2 și final sunt valide și egale
        // → Înseamnă că nu au fost cartonașe în Repriza 1
        if (p1HomeYellow === null && p2HomeYellow !== null && ftHomeYellow !== null) {
            if (p2HomeYellow === ftHomeYellow) {
                p1HomeYellow = 0;
                console.log(`   ✅ AUTO-FIX: Cartonașe galbene Repriza 1 Gazdă: NULL → 0 (repriza2=${p2HomeYellow}, final=${ftHomeYellow})`);
            }
        }

        if (p1AwayYellow === null && p2AwayYellow !== null && ftAwayYellow !== null) {
            if (p2AwayYellow === ftAwayYellow) {
                p1AwayYellow = 0;
                console.log(`   ✅ AUTO-FIX: Cartonașe galbene Repriza 1 Oaspete: NULL → 0 (repriza2=${p2AwayYellow}, final=${ftAwayYellow})`);
            }
        }

        return {
            p1HomeYellow,
            p1AwayYellow,
            p2HomeYellow,
            p2AwayYellow,
            ftHomeYellow,
            ftAwayYellow
        };
    }

    buildStatisticsStructure(period1Data, period2Data, ftData, matchInfo) {
        if (!period1Data || !period2Data || !ftData) {
            console.log(`   ⚠️  Date lipsă pentru ${matchInfo}`);
            return null;
        }

        const p1Home = period1Data.statistics.home;
        const p1Away = period1Data.statistics.away;
        const p2Home = period2Data.statistics.home;
        const p2Away = period2Data.statistics.away;
        const ftHome = ftData.statistics.home;
        const ftAway = ftData.statistics.away;

        // Verifică NULL-uri pentru TOATE perioadele
        this.checkForNulls(matchInfo + ' (Repriza 1)',
            { home: p1Home, away: p1Away },
            { home: ftHome, away: ftAway }
        );

        this.checkForNulls(matchInfo + ' (Repriza 2)',
            { home: p2Home, away: p2Away },
            { home: ftHome, away: ftAway }
        );

        // AUTO-FIX pentru cartonașe galbene (Repriza 1 și Repriza 2)
        const fixedYellowCards = this.fixYellowCards(p1Home, p1Away, p2Home, p2Away, ftHome, ftAway, matchInfo);

        // Extragem TOATE datele direct de pe FlashScore - NU calculăm nimic!
        return {
            suturi_pe_poarta: {
                pauza_gazda: p1Home['Șuturi pe poartă'],
                pauza_oaspete: p1Away['Șuturi pe poartă'],
                repriza_2_gazda: p2Home['Șuturi pe poartă'],
                repriza_2_oaspete: p2Away['Șuturi pe poartă'],
                total_gazda: ftHome['Șuturi pe poartă'],
                total_oaspete: ftAway['Șuturi pe poartă']
            },
            total_suturi: {
                pauza_gazda: p1Home['Total șuturi'],
                pauza_oaspete: p1Away['Total șuturi'],
                repriza_2_gazda: p2Home['Total șuturi'],
                repriza_2_oaspete: p2Away['Total șuturi'],
                total_gazda: ftHome['Total șuturi'],
                total_oaspete: ftAway['Total șuturi']
            },
            cornere: {
                repriza_1_gazda: p1Home['Cornere'],
                repriza_1_oaspete: p1Away['Cornere'],
                repriza_2_gazda: p2Home['Cornere'],
                repriza_2_oaspete: p2Away['Cornere'],
                total_gazda: ftHome['Cornere'],
                total_oaspete: ftAway['Cornere']
            },
            cartonase_galbene: {
                pauza_gazda: fixedYellowCards.p1HomeYellow,
                pauza_oaspete: fixedYellowCards.p1AwayYellow,
                repriza_2_gazda: fixedYellowCards.p2HomeYellow,
                repriza_2_oaspete: fixedYellowCards.p2AwayYellow,
                total_gazda: fixedYellowCards.ftHomeYellow,
                total_oaspete: fixedYellowCards.ftAwayYellow
            },
            cartonase_rosii: {
                pauza_gazda: p1Home['Cartonașe roșii'],
                pauza_oaspete: p1Away['Cartonașe roșii'],
                repriza_2_gazda: p2Home['Cartonașe roșii'],
                repriza_2_oaspete: p2Away['Cartonașe roșii'],
                total_gazda: ftHome['Cartonașe roșii'],
                total_oaspete: ftAway['Cartonașe roșii']
            },
            suturi_salvate: {
                pauza_gazda: p1Home['Intervenții portar'],
                pauza_oaspete: p1Away['Intervenții portar'],
                repriza_2_gazda: p2Home['Intervenții portar'],
                repriza_2_oaspete: p2Away['Intervenții portar'],
                total_gazda: ftHome['Intervenții portar'],
                total_oaspete: ftAway['Intervenții portar']
            },
            faulturi: {
                pauza_gazda: p1Home['Faulturi'],
                pauza_oaspete: p1Away['Faulturi'],
                repriza_2_gazda: p2Home['Faulturi'],
                repriza_2_oaspete: p2Away['Faulturi'],
                total_gazda: ftHome['Faulturi'],
                total_oaspete: ftAway['Faulturi']
            },
            ofsaiduri: {
                pauza_gazda: p1Home['Ofsaiduri'],
                pauza_oaspete: p1Away['Ofsaiduri'],
                repriza_2_gazda: p2Home['Ofsaiduri'],
                repriza_2_oaspete: p2Away['Ofsaiduri'],
                total_gazda: ftHome['Ofsaiduri'],
                total_oaspete: ftAway['Ofsaiduri']
            }
        };
    }

    async extractCompleteMatch(match, index, total) {
        console.log(`\n[${index}/${total}] ${match.homeTeam} vs ${match.awayTeam} (${match.round || 'Unknown'})`);

        try {
            const baseUrl = match.matchId.split('?')[0].replace(/\/$/, '');
            const queryString = match.matchId.split('?')[1] || '';
            const query = queryString ? '?' + queryString : '';

            const urlPeriod1 = baseUrl + '/match-summary/period-scores/1/' + query; // REPRIZA 1 (HT)
            const urlPeriod2 = baseUrl + '/match-summary/period-scores/2/' + query; // REPRIZA 2
            const urlFT = baseUrl + '/match-summary/period-scores/0/' + query;      // FULL TIME
            const urlSummary = baseUrl + '/' + query;

            const matchInfo = `${match.homeTeam} vs ${match.awayTeam}`;

            // Rulează SECVENȚIAL - extragem TOATE cele 3 perioade
            console.log(`   → Extrag Repriza 1 (HT) stats...`);
            const period1Data = await this.extractPeriodStats(urlPeriod1, 'Repriza 1', matchInfo);

            console.log(`   → Extrag Repriza 2 stats...`);
            const period2Data = await this.extractPeriodStats(urlPeriod2, 'Repriza 2', matchInfo);

            console.log(`   → Extrag FT (Total) stats...`);
            const ftData = await this.extractPeriodStats(urlFT, 'FT', matchInfo);

            console.log(`   → Extrag metadata...`);
            const metadataData = await this.extractHTScoreAndMetadata(urlSummary);

            console.log(`   → Extrag clasament...`);
            const standings = await this.extractStandings(baseUrl);

            const homeStanding = standings.find(s => s.team === match.homeTeam);
            const awayStanding = standings.find(s => s.team === match.awayTeam);

            // Avertizare dacă nu găsim echipele în clasament
            if (!homeStanding) console.log(`   ⚠️  "${match.homeTeam}" nu este în clasament`);
            if (!awayStanding) console.log(`   ⚠️  "${match.awayTeam}" nu este în clasament`);

            const dataOra = this.parseDateTime(metadataData?.date);
            const matchId = this.extractMatchId(match.matchId);

            // CLASIFICARE pentru Conference League
            // Faza este determinată automat din numele rundei (detectat în loadAllMatches)
            // Conference League: League Phase (6 etape) + Knockout (Play-offs, Optimi, Sferturi, Semifinale, Finala)

            // Folosim faza detectată automat (REGULAR pentru league phase, PLAYOFF pentru knockout)
            const faza = match.stage || "REGULAR";
            const etapa_in_faza = match.roundNumber || null;
            const etapa_totala = etapa_in_faza; // Etapa în faza curentă

            // Construim obiectul conform structurii JSON
            const result = {
                id_meci: matchId,
                id_flashscore: matchId,
                sezon: CAMPIONAT_INFO.sezon, // IMPORTANT: Marchează sezonul 2024-2025
                faza: faza,
                etapa: etapa_in_faza,
                etapa_totala: etapa_totala,
                data_ora: dataOra,
                echipa_gazda: {
                    nume: match.homeTeam,
                    nume_complet: match.homeTeam,
                    pozitie_clasament_inainte: homeStanding?.position || null
                },
                echipa_oaspete: {
                    nume: match.awayTeam,
                    nume_complet: match.awayTeam,
                    pozitie_clasament_inainte: awayStanding?.position || null
                },
                scor: {
                    final_gazda: metadataData?.ftScoreHome ?? null,
                    final_oaspete: metadataData?.ftScoreAway ?? null,
                    pauza_gazda: metadataData?.htScoreHome ?? null,
                    pauza_oaspete: metadataData?.htScoreAway ?? null
                },
                statistici: this.buildStatisticsStructure(period1Data, period2Data, ftData, matchInfo)
            };

            const htScore = metadataData?.htScoreHome !== null && metadataData?.htScoreAway !== null
                ? `${metadataData.htScoreHome}-${metadataData.htScoreAway}`
                : '?';
            const ftScore = ftData?.score ? `${ftData.score.home}-${ftData.score.away}` : '?';
            const positions = homeStanding && awayStanding
                ? `#${homeStanding.position} vs #${awayStanding.position}`
                : '? vs ?';

            console.log(`   ✅ HT: ${htScore} | FT: ${ftScore} | ${positions}`);

            // AFIȘARE COMPLETĂ A TUTUROR VALORILOR
            this.displayCompleteMatchData(result);

            return result;

        } catch (error) {
            console.error(`   ❌ EROARE EXTRAGERE: ${error.message}`);
            this.errors.push({ match, error: error.message });
            return null;
        }
    }

    async scrapeFullSeason() {
        const startTime = Date.now();

        try {
            await this.init();

            const allMatches = await this.loadAllMatches();

            console.log('='.repeat(80));
            console.log(`\n⚽ [UEFA Conference League API SMART 5] EXTRAGERE\n`);
            console.log('='.repeat(80) + '\n');

            const totalRequests = allMatches.length * 4;
            console.log(`📋 Procesez ${allMatches.length} meciuri (${totalRequests} requests totale)\n`);
            console.log(`⏱️  Timp estimat: ~${Math.round(totalRequests * 3 / 60)} minute\n`);
            console.log('='.repeat(80));

            const meciuri = [];
            const failedMatches = []; // Track meciuri eșuate

            // CITIM FIȘIERUL DE PROGRES (dacă există)
            // Dacă extragem o etapă specifică, progress file-ul este specific etapei
            let startFromIndex = 0;
            const fileName = LEAGUE_CONFIG.file.split('/').pop(); // Extrage doar numele fișierului
            const progressFile = TARGET_ROUND !== null
                ? `PROGRESS_${fileName.replace('.json', '')}_ROUND_${TARGET_ROUND}.json`
                : `PROGRESS_${fileName}`;
            try {
                const progressExists = require('fs').existsSync(progressFile);
                if (progressExists) {
                    const progressData = JSON.parse(await fs.readFile(progressFile, 'utf8'));
                    startFromIndex = progressData.meciuri.length;
                    meciuri.push(...progressData.meciuri);
                    console.log(`\n📂 Fișier de progres găsit: ${startFromIndex} meciuri deja extrase`);
                    console.log(`🔄 Continuăm extragerea de la meciul ${startFromIndex + 1}...\n`);
                }
            } catch (err) {
                console.log(`\n⚠️  Nu s-a putut citi fișierul de progres: ${err.message}`);
                console.log(`🔄 Începem extragerea de la început...\n`);
            }

            for (let i = startFromIndex; i < allMatches.length; i++) {
                const match = allMatches[i];
                const result = await this.extractCompleteMatch(match, i + 1, allMatches.length);

                if (result) {
                    meciuri.push(result);
                } else {
                    // Meci eșuat - îl salvăm pentru retry
                    failedMatches.push({ match, index: i + 1 });
                }

                // Salvare progres la fiecare meci în test mode
                if (TEST_MODE || (i + 1) % 10 === 0) {
                    const progressData = {
                        campionat: CAMPIONAT_INFO,
                        meciuri: meciuri
                    };
                    await fs.writeFile(progressFile, JSON.stringify(progressData, null, 2));
                    console.log(`\n💾 Progres salvat: ${i + 1}/${allMatches.length}\n`);
                }
            }

            // RETRY AUTOMAT pentru meciurile eșuate
            if (failedMatches.length > 0) {
                console.log('\n' + '='.repeat(80));
                console.log(`\n🔄 RETRY AUTOMAT - ${failedMatches.length} meciuri eșuate\n`);
                console.log('='.repeat(80) + '\n');

                const retriedMatches = [];

                for (let i = 0; i < failedMatches.length; i++) {
                    const { match, index } = failedMatches[i];
                    console.log(`\n🔄 [RETRY ${i + 1}/${failedMatches.length}] ${match.homeTeam} vs ${match.awayTeam}`);
                    console.log(`   → Delay de 5 secunde pentru a permite încărcarea...\n`);

                    await new Promise(resolve => setTimeout(resolve, 5000)); // Delay mai mare pentru retry

                    // Curățăm erorile anterioare pentru acest meci
                    const oldErrorCount = this.errors.length;

                    const result = await this.extractCompleteMatch(match, index, allMatches.length);

                    if (result) {
                        meciuri.push(result);
                        retriedMatches.push(match);
                        console.log(`   ✅ RETRY reușit!`);
                    } else {
                        console.log(`   ❌ RETRY eșuat - meciul rămâne fără date complete`);
                    }
                }

                console.log('\n' + '='.repeat(80));
                console.log(`\n📊 REZULTAT RETRY: ${retriedMatches.length}/${failedMatches.length} meciuri recuperate\n`);
                console.log('='.repeat(80));
            }

            const totalTime = Math.round((Date.now() - startTime) / 1000);
            const minutes = Math.floor(totalTime / 60);
            const seconds = totalTime % 60;

            console.log('\n' + '='.repeat(80));
            console.log(`\n📊 RAPORT FINAL - UEFA Conference League API SMART 5\n`);
            console.log('='.repeat(80) + '\n');

            const withHT = meciuri.filter(m => m.scor.pauza_gazda !== null && m.scor.pauza_oaspete !== null).length;
            const withPositions = meciuri.filter(m => m.echipa_gazda.pozitie_clasament_inainte && m.echipa_oaspete.pozitie_clasament_inainte).length;

            console.log(`✅ Meciuri procesate: ${meciuri.length}/${allMatches.length}`);
            console.log(`🎯 Scor HT găsit: ${withHT}/${meciuri.length}`);
            console.log(`📊 Poziții găsite: ${withPositions}/${meciuri.length}`);
            console.log(`⏱️  Timp total: ${minutes}m ${seconds}s\n`);

            // Afișează NULL warnings
            if (this.nullWarnings.length > 0) {
                console.log(`⚠️⚠️⚠️  AVERTISMENTE NULL: ${this.nullWarnings.length} meciuri\n`);
                this.nullWarnings.forEach((warning, i) => {
                    console.log(`  ${i + 1}. ${warning.match}`);
                    warning.warnings.forEach(w => console.log(`     ${w}`));
                });
                console.log('');
            }

            // Încarcă meciurile existente și adaugă-le pe cele noi
            let existingMatches = [];
            try {
                const existingData = await fs.readFile(LEAGUE_CONFIG.file, 'utf8');
                const parsed = JSON.parse(existingData);
                existingMatches = parsed.meciuri || [];
                console.log(`📂 Găsite ${existingMatches.length} meciuri existente în JSON\n`);
            } catch (error) {
                console.log(`📂 Nu există meciuri anterioare (fișier nou)\n`);
            }

            // Combină meciurile existente cu cele noi (elimină duplicate după id_meci)
            // IMPORTANT: Sistemul gestionează MECIURI AMÂNATE corect:
            // - Dacă Etapa 20 are doar 5 meciuri (1 amânat), extragem cele 5
            // - Mai târziu, când meciul amânat se joacă, apare din nou "Round 20" cu 1 meci
            // - Scraperul compară după ID UNIC (id_meci) și adaugă doar meciul lipsă
            // - Nu suprascrie etapa întreagă, ci merge pe bază de ID individual!
            const combinedMatches = [...existingMatches];
            let addedCount = 0;
            let updatedCount = 0;

            meciuri.forEach(newMatch => {
                const existingIndex = combinedMatches.findIndex(m => m.id_meci === newMatch.id_meci);
                if (existingIndex >= 0) {
                    // Meciul există deja → ACTUALIZEAZĂ (date mai noi/complete)
                    combinedMatches[existingIndex] = newMatch;
                    updatedCount++;
                } else {
                    // Meci NOU → ADAUGĂ (poate fi meci amânat care se joacă acum)
                    combinedMatches.push(newMatch);
                    addedCount++;
                }
            });

            // Sortează după etapă și dată
            combinedMatches.sort((a, b) => {
                // Verificăm dacă etapele există și sunt diferite
                const etapaA = a.etapa || a.etapa_totala || 999;
                const etapaB = b.etapa || b.etapa_totala || 999;

                if (etapaA !== etapaB) return etapaA - etapaB;

                // Verificăm dacă data_ora există (structură nouă) sau folosim data_meci (structură veche)
                const dataA = a.data_ora?.data || a.data_meci?.split(' ')[0] || '';
                const dataB = b.data_ora?.data || b.data_meci?.split(' ')[0] || '';

                return dataA.localeCompare(dataB);
            });

            // Construim obiectul final
            const finalData = {
                campionat: CAMPIONAT_INFO,
                meciuri: combinedMatches
            };

            await fs.writeFile(LEAGUE_CONFIG.file, JSON.stringify(finalData, null, 2));
            console.log(`💾 Rezultate salvate în: ${LEAGUE_CONFIG.file}`);
            console.log(`   📊 Total meciuri în JSON: ${combinedMatches.length}`);
            console.log(`   ➕ Meciuri adăugate: ${addedCount}`);
            console.log(`   🔄 Meciuri actualizate: ${updatedCount}\n`);

            // Afișează erorile dacă există
            if (this.errors.length > 0) {
                console.log(`❌ ERORI GĂSITE: ${this.errors.length}\n`);
                this.errors.slice(0, 10).forEach((err, i) => {
                    console.log(`  ${i + 1}. ${err.period || err.type || 'Unknown'}: ${err.error}`);
                });
                if (this.errors.length > 10) {
                    console.log(`  ... și ${this.errors.length - 10} erori în plus\n`);
                }
            }

            console.log('='.repeat(80) + '\n');
            console.log(`🎉 SUCCES! Test completat!\n`);

            await this.close();

            return { success: true, meciuri, errors: this.errors };

        } catch (error) {
            console.error(`❌ [UEFA Conference League API SMART 5] Eroare:`, error);
            await this.close();
            return { success: false, error: error.message, errors: this.errors };
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// Main execution
(async () => {
    const scraper = new ConferenceLeagueScraper();
    const result = await scraper.scrapeFullSeason();
    process.exit(result.success ? 0 : 1);
})();
