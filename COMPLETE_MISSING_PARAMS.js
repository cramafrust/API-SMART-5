#!/usr/bin/env node
/**
 * 🔧 COMPLETE MISSING PARAMS - Completare Chirurgicală Parametri Lipsă
 *
 * Scanează JSON-uri, identifică parametri NULL și îi completează
 * FĂRĂ să reextragem toate datele meciului.
 *
 * FUNCȚIONALITATE:
 * 1. Scan JSON-uri → găsește parametri NULL (etapa, tier, etc.)
 * 2. Pentru fiecare meci cu parametru lipsă:
 *    - Scrapează FlashScore DOAR pentru parametrul respectiv
 *    - Verifică meciul corect (dată, scor, echipe)
 *    - Salvează DOAR parametrul în JSON
 *
 * USAGE:
 *   node COMPLETE_MISSING_PARAMS.js                 # Procesează 10 meciuri
 *   node COMPLETE_MISSING_PARAMS.js --batch=20      # Procesează 20 meciuri
 *   node COMPLETE_MISSING_PARAMS.js --param=etapa   # Doar etapa
 *   node COMPLETE_MISSING_PARAMS.js --season=2025-2026
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const puppeteer = require('puppeteer');
const BrowserPool = require('./BROWSER_POOL');

// Config
const SEASONS_DIR = path.join(__dirname, 'data', 'seasons');
const PROGRESS_FILE = path.join(__dirname, 'complete_params_progress.json');
const DEFAULT_BATCH_SIZE = 10;

// Delay-uri RANDOM pentru comportament uman (evită pattern detection)
const MIN_DELAY = 3000;  // 3s minim
const MAX_DELAY = 7000;  // 7s maxim
const LONG_BREAK_EVERY = 10;  // Pauză lungă la fiecare 10 meciuri
const LONG_BREAK_DURATION = [15000, 25000];  // 15-25s pauză lungă

// User agents random (simulare dispozitive diferite)
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

// Viewport sizes random (simulare rezoluții diferite)
const VIEWPORTS = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1536, height: 864 },
    { width: 1280, height: 720 }
];

/**
 * Generate random delay (comportament uman)
 */
function getRandomDelay(min = MIN_DELAY, max = MAX_DELAY) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get random element from array
 */
function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Parse arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    return {
        batchSize: parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1]) || DEFAULT_BATCH_SIZE,
        param: args.find(a => a.startsWith('--param='))?.split('=')[1] || null,
        season: args.find(a => a.startsWith('--season='))?.split('=')[1] || null,
        reset: args.includes('--reset'),
        help: args.includes('--help') || args.includes('-h')
    };
}

/**
 * Show help
 */
function showHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║         🔧 COMPLETE MISSING PARAMS                           ║
║         Completare Chirurgicală Parametri Lipsă              ║
╚══════════════════════════════════════════════════════════════╝

FUNCȚIONALITATE:
  - Scanează JSON-uri pentru parametri NULL
  - Extrage DOAR parametrul lipsă (nu toate datele!)
  - Verifică meciul corect (dată, scor, echipe)
  - Salvează DOAR parametrul în JSON

🤖 PROTECȚIE ANTI-BAN (nou):
  - User agents RANDOM (Chrome, Firefox, Safari)
  - Viewport sizes RANDOM (1920x1080, 1366x768, etc.)
  - Delay-uri RANDOM între meciuri (3-7 secunde)
  - Pauze LUNGI la fiecare 10 meciuri (15-25 secunde)
  - Simulare scroll/mouse pentru comportament uman
  - Ascundere WebDriver detection

PARAMETRI DETECTAȚI AUTOMAT:
  - etapa (round number)
  - tier_gazda, tier_oaspete (dacă lipsesc)
  - Orice alt câmp NULL

USAGE:
  node COMPLETE_MISSING_PARAMS.js                 # 10 meciuri
  node COMPLETE_MISSING_PARAMS.js --batch=20      # 20 meciuri
  node COMPLETE_MISSING_PARAMS.js --param=etapa   # Doar etapa
  node COMPLETE_MISSING_PARAMS.js --season=2025-2026  # Un sezon
  node COMPLETE_MISSING_PARAMS.js --reset         # Reset progress

INTEGRARE:
  Rulează zilnic după DAILY_MASTER pentru completare treptată

⏱️  TIMP ESTIMAT:
  - Batch 10 meciuri: ~5-8 minute (delay-uri anti-ban)
  - Batch 50 meciuri: ~25-40 minute
`);
}

/**
 * Încarcă progress
 */
function loadProgress() {
    if (!fs.existsSync(PROGRESS_FILE)) {
        return {
            version: '1.0',
            lastRun: null,
            totalCompleted: 0,
            processedMatches: []
        };
    }

    try {
        return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    } catch (error) {
        console.log(`⚠️  Eroare citire progress: ${error.message}`);
        return {
            version: '1.0',
            lastRun: null,
            totalCompleted: 0,
            processedMatches: []
        };
    }
}

/**
 * Salvează progress
 */
function saveProgress(progress) {
    try {
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf8');
    } catch (error) {
        console.error(`❌ Eroare salvare progress: ${error.message}`);
    }
}

/**
 * Scanează JSON și identifică meciuri cu parametri lipsă
 */
function scanForMissingParams(file, targetParam = null) {
    const content = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(content);

    const campionatName = data.campionat?.nume_complet ||
                          data.campionat?.nume ||
                          data.campionat ||
                          path.basename(file, '.json').substring(20);

    const sezon = data.sezon || data.campionat?.sezon || 'Unknown';
    const matches = data.meciuri || [];

    const matchesWithMissingParams = [];

    matches.forEach((match, idx) => {
        const missingParams = [];

        // Check etapa
        if (match.etapa === null || match.etapa === undefined) {
            missingParams.push('etapa');
        }

        // Check tier_gazda, tier_oaspete
        if (!match.tier_gazda || match.tier_gazda === null) {
            missingParams.push('tier_gazda');
        }
        if (!match.tier_oaspete || match.tier_oaspete === null) {
            missingParams.push('tier_oaspete');
        }

        // Dacă avem parametru specific, filtrează
        const relevantParams = targetParam ?
            missingParams.filter(p => p === targetParam) :
            missingParams;

        if (relevantParams.length > 0) {
            matchesWithMissingParams.push({
                file,
                campionat: campionatName,
                sezon,
                matchIndex: idx,
                matchId: match.id_meci || match.id_flashscore,
                homeTeam: match.echipa_gazda?.nume || 'Unknown',
                awayTeam: match.echipa_oaspete?.nume || 'Unknown',
                date: match.data_ora?.data,
                scoreHT: `${match.scor?.pauza_gazda || '?'}-${match.scor?.pauza_oaspete || '?'}`,
                scoreFT: `${match.scor?.final_gazda || '?'}-${match.scor?.final_oaspete || '?'}`,
                missingParams: relevantParams
            });
        }
    });

    return matchesWithMissingParams;
}

/**
 * Scrapează etapa unui meci de pe FlashScore
 * CU COMPORTAMENT UMAN (anti-ban)
 */
async function scrapeMatchRound(matchId, matchInfo) {
    let browser = null;

    try {
        console.log(`   🌐 Scraping FlashScore pentru etapă...`);

        const url = `https://www.flashscore.ro/meci/${matchId}/#/rezumat-meci`;

        // 🎭 User agent RANDOM
        const userAgent = getRandomElement(USER_AGENTS);

        // 📺 Viewport RANDOM
        const viewport = getRandomElement(VIEWPORTS);

        browser = await BrowserPool.launchBrowser();

        const page = await browser.newPage();

        // 🎭 Setează user agent random
        await page.setUserAgent(userAgent);

        // 📺 Setează viewport random
        await page.setViewport(viewport);

        // 🤖 Ascunde automatizarea (WebDriver detection)
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });

        // ⏱️ Delay RANDOM înainte de navigare (1-3s)
        await page.waitForTimeout(getRandomDelay(1000, 3000));

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // ⏱️ Așteaptă RANDOM să se încarce (2-4s)
        await page.waitForTimeout(getRandomDelay(2000, 4000));

        // 🖱️ SIMULARE COMPORTAMENT UMAN: scroll random
        await page.evaluate(() => {
            const scrollY = Math.floor(Math.random() * 300) + 100;
            window.scrollBy(0, scrollY);
        });

        // ⏱️ Delay mic după scroll (500-1500ms)
        await page.waitForTimeout(getRandomDelay(500, 1500));

        // 🖱️ SIMULARE: Scroll înapoi puțin (comportament natural)
        await page.evaluate(() => {
            window.scrollBy(0, -50);
        });

        // ⏱️ Delay mic (300-800ms)
        await page.waitForTimeout(getRandomDelay(300, 800));

        // Extrage etapa din TEXTUL COMPLET al paginii
        const roundInfo = await page.evaluate(() => {
            const fullText = document.body.innerText;

            // Căută "Round 15", "RUNDA 5", "Etapa 12", etc.
            const roundPattern = /(?:Round|RUNDA|Runda|ETAPA|Etapa)\s*(\d+)/i;
            const match = fullText.match(roundPattern);

            if (match) {
                return {
                    roundText: match[0],
                    roundNumber: parseInt(match[1])
                };
            }

            // Fallback: caută în breadcrumb
            const breadcrumbElements = document.querySelectorAll('.tournamentHeader__country a, .tournamentHeader__country span');
            for (const elem of breadcrumbElements) {
                const text = elem.textContent.trim();
                const roundMatch = text.match(roundPattern);
                if (roundMatch) {
                    return {
                        roundText: text,
                        roundNumber: parseInt(roundMatch[1])
                    };
                }
            }

            return null;
        });

        // ⏱️ Delay mic înainte de închidere (500-1000ms) - comportament natural
        await page.waitForTimeout(getRandomDelay(500, 1000));

        await browser.close();

        if (roundInfo && roundInfo.roundNumber) {
            console.log(`   ✅ Etapă găsită: ${roundInfo.roundText} (${roundInfo.roundNumber})`);
            return roundInfo.roundNumber;
        } else {
            console.log(`   ⚠️  Nu s-a găsit etapa pe pagină`);
            return null;
        }

    } catch (error) {
        console.error(`   ❌ Eroare scraping: ${error.message}`);
        if (browser) await browser.close();
        return null;
    }
}

/**
 * Completează parametrul lipsă în JSON
 */
function completeParamInJSON(file, matchIndex, param, value) {
    try {
        const content = fs.readFileSync(file, 'utf8');
        const data = JSON.parse(content);

        if (!data.meciuri || !data.meciuri[matchIndex]) {
            console.error(`   ❌ Meci inexistent la index ${matchIndex}`);
            return false;
        }

        // Salvează valoarea
        data.meciuri[matchIndex][param] = value;

        // Scrie JSON-ul actualizat
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');

        console.log(`   💾 Salvat: ${param} = ${value}`);
        return true;

    } catch (error) {
        console.error(`   ❌ Eroare salvare: ${error.message}`);
        return false;
    }
}

/**
 * Main
 */
async function main() {
    const options = parseArgs();

    if (options.help) {
        showHelp();
        process.exit(0);
    }

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                                                              ║');
    console.log('║         🔧 COMPLETE MISSING PARAMS                           ║');
    console.log('║         Completare Chirurgicală Parametri Lipsă              ║');
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    console.log(`⏰ ${new Date().toLocaleString('ro-RO')}`);
    console.log(`📦 Batch size: ${options.batchSize} meciuri`);
    if (options.param) console.log(`🎯 Parametru țintă: ${options.param}`);
    if (options.season) console.log(`📅 Sezon țintă: ${options.season}`);
    console.log('='.repeat(60));

    // Încarcă progress
    let progress = loadProgress();

    if (options.reset) {
        console.log(`\n🔄 Resetare progress...`);
        progress = {
            version: '1.0',
            lastRun: null,
            totalCompleted: 0,
            processedMatches: []
        };
        saveProgress(progress);
        console.log(`✅ Progress resetat!\n`);
    }

    console.log(`\n📊 Progress actual:`);
    console.log(`   Total parametri completați: ${progress.totalCompleted}`);
    console.log(`   Ultima rulare: ${progress.lastRun || 'Niciodată'}`);

    // Scanează JSON-uri
    console.log(`\n📂 Scanare JSON-uri pentru parametri lipsă...`);

    const files = glob.sync(path.join(SEASONS_DIR, 'complete_FULL_SEASON_*.json'))
        .filter(f => !f.includes('BACKUP') && !f.includes('ORIGINAL') && !f.includes('OLD_FORMAT'));

    let allMissingParams = [];

    files.forEach(file => {
        const missing = scanForMissingParams(file, options.param);

        // Filtrează după sezon dacă specificat
        const filtered = options.season ?
            missing.filter(m => m.sezon === options.season) :
            missing;

        allMissingParams.push(...filtered);
    });

    // Exclude meciurile deja procesate
    allMissingParams = allMissingParams.filter(m => {
        const key = `${m.matchId}_${m.missingParams.join('_')}`;
        return !progress.processedMatches.includes(key);
    });

    console.log(`   ✅ Găsite: ${allMissingParams.length} meciuri cu parametri lipsă`);

    if (allMissingParams.length === 0) {
        console.log(`\n🎉 Nu există parametri lipsă! Baza de date este completă!\n`);
        process.exit(2); // Exit code 2 = Nu mai sunt meciuri (nu e eroare!)
    }

    // Procesează primele N meciuri
    const toProcess = allMissingParams.slice(0, options.batchSize);

    console.log(`\n🔄 Procesare: ${toProcess.length} meciuri\n`);
    console.log('='.repeat(60));

    let completed = 0;
    let failed = 0;

    for (let i = 0; i < toProcess.length; i++) {
        const match = toProcess[i];

        console.log(`\n[${i + 1}/${toProcess.length}] ${match.campionat} (${match.sezon})`);
        console.log(`   ${match.homeTeam} vs ${match.awayTeam}`);
        console.log(`   📅 ${match.date} | Scor: ${match.scoreFT} (HT: ${match.scoreHT})`);
        console.log(`   ⚠️  Parametri lipsă: ${match.missingParams.join(', ')}`);

        // Pentru fiecare parametru lipsă
        for (const param of match.missingParams) {
            if (param === 'etapa') {
                // Scrapează etapa
                const roundNumber = await scrapeMatchRound(match.matchId, match);

                if (roundNumber !== null) {
                    const success = completeParamInJSON(match.file, match.matchIndex, 'etapa', roundNumber);

                    if (success) {
                        completed++;
                        progress.totalCompleted++;

                        // Marchează ca procesat
                        const key = `${match.matchId}_${param}`;
                        progress.processedMatches.push(key);
                    } else {
                        failed++;
                    }
                } else {
                    console.log(`   ⚠️  Nu s-a putut extrage etapa - skip`);
                    failed++;
                }

                // Delay RANDOM între request-uri (comportament uman)
                if (i < toProcess.length - 1) {
                    // 🎯 PAUZĂ LUNGĂ la fiecare 10 meciuri
                    if ((i + 1) % LONG_BREAK_EVERY === 0) {
                        const longBreak = getRandomDelay(LONG_BREAK_DURATION[0], LONG_BREAK_DURATION[1]);
                        console.log(`   ⏸️  Pauză lungă (${Math.floor(longBreak / 1000)}s) - evitare pattern detection...`);
                        await new Promise(resolve => setTimeout(resolve, longBreak));
                    } else {
                        // Delay RANDOM normal (3-7s)
                        const randomDelay = getRandomDelay();
                        console.log(`   ⏳ Așteptare ${Math.floor(randomDelay / 1000)}s...`);
                        await new Promise(resolve => setTimeout(resolve, randomDelay));
                    }
                }
            }
            // TODO: Adaugă suport pentru alți parametri (tier, etc.)
        }
    }

    // Salvează progress
    progress.lastRun = new Date().toISOString();
    saveProgress(progress);

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 REZULTATE:\n`);
    console.log(`   ✅ Completați: ${completed} parametri`);
    console.log(`   ❌ Eșuați: ${failed} parametri`);
    console.log(`   📊 Total completați (all time): ${progress.totalCompleted}`);
    console.log(`   📋 Rămași: ${allMissingParams.length - toProcess.length} meciuri`);

    console.log(`\n💡 Rulează din nou cu --batch=${options.batchSize} pentru continuare\n`);
    console.log('='.repeat(60));
    console.log('\n✅ Completare finalizată!\n');
}

// Run
if (require.main === module) {
    main().catch(error => {
        console.error('\n❌ EROARE FATALĂ:', error.message);
        console.error(error.stack);
        process.exit(1);
    });
}

module.exports = { main };
