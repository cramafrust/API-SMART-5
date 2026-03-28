#!/usr/bin/env node
/**
 * 🔄 GRADUAL BACKFILL - Completare Treptată Meciuri Lipsă
 *
 * Extrage meciuri lipsă TREPTAT, câte 10 per rulare, pentru a nu bloca laptopul.
 *
 * WORKFLOW:
 * 1. Citește lista campionatelor din JSON-uri
 * 2. Pentru fiecare campionat cu gap-uri în date:
 *    - Identifică perioadele fără meciuri (gap > 7 zile)
 *    - Caută meciuri în acele perioade
 * 3. Extrage câte 10 meciuri per rulare
 * 4. Salvează progresul în backfill_progress.json
 * 5. Poate fi reluat - continuă de unde a rămas
 *
 * USAGE:
 *   node GRADUAL_BACKFILL.js                # Extrage 10 meciuri
 *   node GRADUAL_BACKFILL.js --batch=20     # Extrage 20 meciuri
 *   node GRADUAL_BACKFILL.js --reset        # Resetează progresul
 *
 * INTEGRARE DAILY:
 *   Rulează zilnic după DAILY_FINAL_DATA_COLLECTOR
 *   până ajunge la 100% completitudine
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const { extractFinalStats } = require('./FINAL_STATS_EXTRACTOR');
const { saveFinalMatchData } = require('./CHAMPIONSHIP_JSON_MANAGER');

// Config
const SEASONS_DIR = path.join(__dirname, 'data', 'seasons');
const PROGRESS_FILE = path.join(__dirname, 'backfill_progress.json');
const DEFAULT_BATCH_SIZE = 10;
const GAP_THRESHOLD_DAYS = 7; // Gap > 7 zile = posibil meciuri lipsă

/**
 * Parse arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    return {
        batchSize: parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1]) || DEFAULT_BATCH_SIZE,
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
║         🔄 GRADUAL BACKFILL - Help                           ║
║         Completare Treptată Meciuri Lipsă                    ║
╚══════════════════════════════════════════════════════════════╝

FUNCȚIONALITATE:
  - Identifică gap-uri în datele colectate (perioade fără meciuri)
  - Extrage meciuri TREPTAT, câte 10 per rulare
  - Salvează progresul - poate fi reluat oricând
  - Rulează zilnic până la 100% completitudine

WORKFLOW:
  1. Analizează JSON-uri din data/seasons/
  2. Detectează gap-uri > 7 zile între meciuri
  3. Extrage câte 10 meciuri din gap-uri
  4. Salvează în JSON-uri existente
  5. Marchează progresul în backfill_progress.json

USAGE:
  node GRADUAL_BACKFILL.js                # Extrage 10 meciuri
  node GRADUAL_BACKFILL.js --batch=20     # Extrage 20 meciuri
  node GRADUAL_BACKFILL.js --reset        # Resetează progresul

INTEGRARE DAILY (cron):
  # După DAILY_FINAL_DATA_COLLECTOR
  0 9 * * * cd "/home/florian/API SMART 5" && node GRADUAL_BACKFILL.js >> logs/gradual-backfill.log 2>&1
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
            totalExtracted: 0,
            championships: {}
        };
    }

    try {
        return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    } catch (error) {
        console.log(`⚠️  Eroare citire progress: ${error.message}`);
        return {
            version: '1.0',
            lastRun: null,
            totalExtracted: 0,
            championships: {}
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
 * Analizează un campionat și identifică gap-uri
 */
function analyzeChampionshipGaps(file) {
    const content = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(content);

    const campionatName = data.campionat?.nume_complet ||
                          data.campionat?.nume ||
                          data.campionat ||
                          path.basename(file, '.json').substring(20);

    const matches = data.meciuri || [];

    if (matches.length === 0) return null;

    // Extrage datele meciurilor și sortează
    const matchesWithDates = matches
        .map(m => ({
            date: m.data_ora?.data,
            match: m
        }))
        .filter(m => m.date)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (matchesWithDates.length === 0) return null;

    // Identifică gap-uri
    const gaps = [];
    for (let i = 1; i < matchesWithDates.length; i++) {
        const prevDate = new Date(matchesWithDates[i - 1].date);
        const currDate = new Date(matchesWithDates[i].date);
        const gapDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));

        // Gap > GAP_THRESHOLD_DAYS = posibil meciuri lipsă
        if (gapDays > GAP_THRESHOLD_DAYS) {
            gaps.push({
                fromDate: matchesWithDates[i - 1].date,
                toDate: matchesWithDates[i].date,
                days: gapDays
            });
        }
    }

    if (gaps.length === 0) return null;

    return {
        file,
        campionat: campionatName,
        sezon: data.sezon || data.campionat?.sezon || 'Unknown',
        tournamentId: data.campionat?.id_flashscore || null,
        gaps,
        totalGaps: gaps.length
    };
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
    console.log('║         🔄 GRADUAL BACKFILL                                  ║');
    console.log('║         Completare Treptată Meciuri Lipsă                    ║');
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    console.log(`⏰ ${new Date().toLocaleString('ro-RO')}`);
    console.log(`📦 Batch size: ${options.batchSize} meciuri`);
    console.log('='.repeat(60));

    // Încarcă progress
    let progress = loadProgress();

    if (options.reset) {
        console.log(`\n🔄 Resetare progress...`);
        progress = {
            version: '1.0',
            lastRun: null,
            totalExtracted: 0,
            championships: {}
        };
        saveProgress(progress);
        console.log(`✅ Progress resetat!\n`);
    }

    console.log(`\n📊 Progress actual:`);
    console.log(`   Total meciuri extrase până acum: ${progress.totalExtracted}`);
    console.log(`   Ultima rulare: ${progress.lastRun || 'Niciodată'}`);

    // Analizează campionate
    console.log(`\n📂 Analiză campionate...`);

    const files = glob.sync(path.join(SEASONS_DIR, 'complete_FULL_SEASON_*.json'))
        .filter(f => !f.includes('BACKUP') && !f.includes('ORIGINAL') && !f.includes('OLD_FORMAT'));

    const championshipsWithGaps = files
        .map(analyzeChampionshipGaps)
        .filter(c => c !== null);

    console.log(`   ✅ ${championshipsWithGaps.length} campionate cu gap-uri detectate\n`);

    if (championshipsWithGaps.length === 0) {
        console.log(`\n🎉 Nu există gap-uri! Baza de date este 100% completă!\n`);
        process.exit(0);
    }

    // Afișează top 5 campionate cu cele mai multe gap-uri
    const topGaps = championshipsWithGaps
        .sort((a, b) => b.totalGaps - a.totalGaps)
        .slice(0, 5);

    console.log(`🔴 TOP 5 Campionate cu cele mai multe gap-uri:\n`);
    topGaps.forEach((c, idx) => {
        console.log(`   ${idx + 1}. ${c.campionat} (${c.sezon})`);
        console.log(`      Gap-uri: ${c.totalGaps}`);
    });

    console.log(`\n⚠️  NOTĂ: GRADUAL_BACKFILL necesită implementare completă FlashScore scraper`);
    console.log(`   pentru a extrage meciuri din perioadele cu gap-uri.`);
    console.log(`\n   Momentan, scriptul doar IDENTIFICĂ gap-urile.`);
    console.log(`   Pentru extragere automată, trebuie să adăugăm:`);
    console.log(`   1. Scraper Puppeteer pentru liste meciuri din turneu`);
    console.log(`   2. Filtrare meciuri după dată (gap periods)`);
    console.log(`   3. Extragere cu FINAL_STATS_EXTRACTOR`);

    console.log(`\n💡 Alternativă RAPIDĂ: Rulează DAILY_FINAL_DATA_COLLECTOR retroactiv`);
    console.log(`   pentru săptămânile cu gap-uri.\n`);

    // Salvează progress
    progress.lastRun = new Date().toISOString();
    saveProgress(progress);

    console.log(`\n✅ Analiză completă!`);
    console.log(`   📄 Gap-uri identificate salvate în memorie`);
    console.log(`   🔄 Rulează din nou cu --batch=10 pentru extragere (când va fi implementat)\n`);
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
