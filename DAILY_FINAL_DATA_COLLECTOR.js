#!/usr/bin/env node
/**
 * ⚽ DAILY_FINAL_DATA_COLLECTOR.js
 *
 * Colector automat de date finale pentru meciurile din ziua precedentă
 *
 * CONCEPT:
 * - Rulează DIMINEAȚA (6:00 - 12:00)
 * - Extrage date FT pentru TOATE meciurile din ziua anterioară
 * - Nu interferează cu monitorizarea live HT
 * - Salvează automat în JSON-uri per campionat
 *
 * WORKFLOW:
 * 1. Identifică fișierul meciuri-YYYY-MM-DD.json de IERI
 * 2. Pentru fiecare meci din listă:
 *    - Verifică dacă meciul s-a terminat (API check)
 *    - Extrage date complete FT + HT
 *    - Salvează în JSON campionat corespunzător
 * 3. Generează raport final cu statistici
 *
 * USAGE:
 *   node DAILY_FINAL_DATA_COLLECTOR.js           → Colectează date de ieri
 *   node DAILY_FINAL_DATA_COLLECTOR.js --date=2025-11-03  → Dată specifică
 *   node DAILY_FINAL_DATA_COLLECTOR.js --dry-run → Test fără salvare
 */

const fs = require('fs');
const path = require('path');
const { extractFinalStats } = require('./FINAL_STATS_EXTRACTOR');
const { saveMatchData } = require('./CHAMPIONSHIP_JSON_MANAGER');

// Director unde se salvează JSON-urile de campionat
const CHAMPIONSHIP_DIR = '/home/florian/API SMART 5/data/seasons';

// Delay între request-uri (ms) pentru a nu suprasolicita API-ul
const REQUEST_DELAY = 3000; // 3 secunde

/**
 * Obține data de ieri în format YYYY-MM-DD
 */
function getYesterdayDate() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const year = yesterday.getFullYear();
    const month = String(yesterday.getMonth() + 1).padStart(2, '0');
    const day = String(yesterday.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * Găsește fișierul cu meciuri pentru o dată specifică
 */
function findMatchesFile(date) {
    const filename = `meciuri-${date}.json`;
    const filepath = path.join(__dirname, filename);

    if (fs.existsSync(filepath)) {
        return filepath;
    }

    return null;
}

/**
 * Colectează date finale pentru toate meciurile dintr-o zi
 */
async function collectDailyFinalData(date, options = {}) {
    const dryRun = options.dryRun || false;

    console.log(`\n⚽ COLECTOR AUTOMAT DATE FINALE\n`);
    console.log('='.repeat(60));
    console.log(`📅 Dată: ${date}`);
    console.log(`🔧 Mod: ${dryRun ? 'DRY RUN (test)' : 'PRODUCȚIE'}`);
    console.log('='.repeat(60));

    // Găsește fișierul cu meciuri
    const matchesFile = findMatchesFile(date);

    if (!matchesFile) {
        console.error(`\n❌ Nu s-a găsit fișierul: meciuri-${date}.json`);
        console.log(`💡 Asigură-te că ai rulat: node API-SMART-5.js daily pentru ziua ${date}\n`);
        return {
            success: false,
            error: 'Fișierul cu meciuri nu există'
        };
    }

    console.log(`\n✅ Fișier găsit: ${path.basename(matchesFile)}`);

    // Citește lista de meciuri
    const matchesData = JSON.parse(fs.readFileSync(matchesFile, 'utf8'));
    const matches = matchesData.matches || matchesData.meciuri || [];

    if (matches.length === 0) {
        console.log('\n⚠️  Nu sunt meciuri în listă.\n');
        return {
            success: true,
            totalMatches: 0,
            processed: 0
        };
    }

    console.log(`📊 Total meciuri găsite: ${matches.length}\n`);
    console.log('='.repeat(60));

    // Statistici
    const stats = {
        total: matches.length,
        success: 0,
        failed: 0,
        notFinished: 0,
        duplicate: 0,
        byLeague: {}
    };

    // Array pentru meciurile colectate (salvare zilnică)
    const collectedMatches = [];

    // Procesează fiecare meci
    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];

        console.log(`\n[${i + 1}/${matches.length}] ${match.homeTeam} vs ${match.awayTeam}`);
        console.log(`   Liga: ${match.liga || match.league}`);

        try {
            // Pregătește info meci
            const matchInfo = {
                matchId: match.matchId,
                homeTeam: match.homeTeam,
                awayTeam: match.awayTeam,
                league: match.liga || match.league,
                leagueId: match.leagueId || null,
                country: match.country || null,
                matchStartTime: match.timestamp || match.startTime
            };

            // Extrage date finale
            const matchData = await extractFinalStats(match.matchId, matchInfo);

            if (!matchData) {
                console.log(`   ⚠️  Meciul nu este încă terminat, SKIP`);
                stats.notFinished++;

                // Delay înainte de următorul request
                if (i < matches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
                }
                continue;
            }

            // Adaugă la lista zilnică (pentru email)
            collectedMatches.push(matchData);

            // Salvează în JSON (doar dacă nu e dry-run)
            if (!dryRun) {
                const saveResult = saveMatchData(matchData, CHAMPIONSHIP_DIR);

                if (saveResult.success) {
                    stats.success++;

                    // Contorizare pe ligă
                    const league = matchData.match.league;
                    if (!stats.byLeague[league]) {
                        stats.byLeague[league] = 0;
                    }
                    stats.byLeague[league]++;

                    console.log(`   ✅ Salvat în ${saveResult.filename}`);

                } else if (saveResult.reason === 'duplicate') {
                    stats.duplicate++;
                    console.log(`   ℹ️  Meci deja salvat (duplicate)`);

                } else {
                    stats.failed++;
                    console.log(`   ❌ Eroare salvare: ${saveResult.error}`);
                }
            } else {
                // Dry run - doar simulează
                stats.success++;
                console.log(`   ✅ [DRY RUN] Ar fi salvat cu succes`);
            }

        } catch (error) {
            console.error(`   ❌ EROARE: ${error.message}`);
            stats.failed++;
        }

        // Delay înainte de următorul request
        if (i < matches.length - 1) {
            console.log(`   ⏳ Așteptare ${REQUEST_DELAY / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
        }
    }

    // Raport final
    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 RAPORT FINAL - COLECTARE DATE ${date}\n`);
    console.log('='.repeat(60));
    console.log(`📋 Total meciuri: ${stats.total}`);
    console.log(`✅ Salvate cu succes: ${stats.success}`);
    console.log(`⏭️  Duplicate (skip): ${stats.duplicate}`);
    console.log(`⚠️  Neterminate: ${stats.notFinished}`);
    console.log(`❌ Eșuate: ${stats.failed}`);

    if (Object.keys(stats.byLeague).length > 0) {
        console.log(`\n🏆 Date salvate pe ligi:`);
        Object.entries(stats.byLeague)
            .sort((a, b) => b[1] - a[1])
            .forEach(([league, count]) => {
                console.log(`   ${league}: ${count} meciuri`);
            });
    }

    console.log('='.repeat(60));

    // Salvează fișier zilnic cu toate meciurile colectate
    if (!dryRun && collectedMatches.length > 0) {
        const dailyFilename = `daily_collected_${date}.json`;
        const dailyFilepath = path.join(__dirname, dailyFilename);

        const dailyData = {
            date: date,
            generated: new Date().toISOString(),
            totalMatches: collectedMatches.length,
            matches: collectedMatches
        };

        try {
            fs.writeFileSync(dailyFilepath, JSON.stringify(dailyData, null, 2), 'utf8');
            console.log(`\n📦 Fișier zilnic salvat: ${dailyFilename}`);
            console.log(`   Total meciuri în fișier: ${collectedMatches.length}`);
        } catch (err) {
            console.error(`\n❌ Eroare salvare fișier zilnic: ${err.message}`);
        }
    }

    console.log('='.repeat(60));
    console.log(`\n✅ Colectare completă pentru ${date}!\n`);

    return {
        success: true,
        date: date,
        stats: stats,
        collectedMatches: collectedMatches.length
    };
}

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        date: null,
        dryRun: false,
        help: false
    };

    for (const arg of args) {
        if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg.startsWith('--date=')) {
            options.date = arg.split('=')[1];
        }
    }

    return options;
}

/**
 * Show help
 */
function showHelp() {
    console.log(`
📖 DAILY FINAL DATA COLLECTOR - Help

USAGE:
   node DAILY_FINAL_DATA_COLLECTOR.js [options]

OPTIONS:
   --date=YYYY-MM-DD    Specifică data pentru care să colecteze date
                        Default: ieri

   --dry-run            Mod test - nu salvează efectiv în JSON-uri
                        Util pentru verificare înainte de rulare reală

   -h, --help           Afișează acest mesaj

EXEMPLE:

   # Colectează date de ieri (mod normal)
   node DAILY_FINAL_DATA_COLLECTOR.js

   # Colectează date pentru o dată specifică
   node DAILY_FINAL_DATA_COLLECTOR.js --date=2025-11-03

   # Test fără salvare (dry run)
   node DAILY_FINAL_DATA_COLLECTOR.js --dry-run

PROGRAMARE AUTOMATĂ (CRON):

   # Rulează în fiecare dimineață la 7:00
   0 7 * * * cd /home/florian/API\\ SMART\\ 5 && node DAILY_FINAL_DATA_COLLECTOR.js >> logs/daily-collector.log 2>&1

   # Rulează la 8:00, 9:00, 10:00 (pentru meciuri care nu s-au terminat încă)
   0 8-10 * * * cd /home/florian/API\\ SMART\\ 5 && node DAILY_FINAL_DATA_COLLECTOR.js >> logs/daily-collector.log 2>&1

INTEGRARE API SMART 5:

   # Comandă nouă adăugată în API-SMART-5.js:
   node API-SMART-5.js collectyesterday

NOTE:
   - Scriptul extrage date pentru meciurile din ziua anterioară
   - Nu interferează cu monitorizarea live (HT)
   - Request delay: ${REQUEST_DELAY / 1000}s între meciuri
   - Date salvate în: ${CHAMPIONSHIP_DIR}

`);
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

    // Determină data
    const date = options.date || getYesterdayDate();

    try {
        const result = await collectDailyFinalData(date, options);

        if (!result.success) {
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ EROARE FATALĂ:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Export pentru integrare în API-SMART-5
module.exports = {
    collectDailyFinalData,
    getYesterdayDate,
    findMatchesFile
};

// Run
if (require.main === module) {
    main();
}
