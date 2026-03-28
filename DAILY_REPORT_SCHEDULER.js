#!/usr/bin/env node
/**
 * ⏰ DAILY_REPORT_SCHEDULER.js
 *
 * Programează trimiterea automată a raportului zilnic
 *
 * DEFAULT: Trimite în fiecare zi la ora 08:00 dimineața
 *
 * USAGE:
 *   node DAILY_REPORT_SCHEDULER.js              # Pornește scheduler (08:00 daily)
 *   node DAILY_REPORT_SCHEDULER.js --test       # Test - trimite imediat
 */

const cron = require('node-cron');
const { sendDailyReport } = require('./SEND_DAILY_REPORT');
const { getYesterdayDate } = require('./DAILY_REPORT_GENERATOR');
const { generate: generatePronosticsReport } = require('./PRONOSTICS_REPORT');

// Configurare
const SCHEDULE_TIME = '0 8 * * *'; // 08:00 în fiecare zi (minute hour day month weekday)

/**
 * Task pentru trimiterea raportului zilnic
 */
async function dailyReportTask() {
    console.log('\n' + '='.repeat(60));
    console.log('📅 TASK: TRIMITERE RAPORT ZILNIC');
    console.log('='.repeat(60));
    console.log(`⏰ ${new Date().toLocaleString('ro-RO')}`);

    try {
        const yesterday = getYesterdayDate();
        const result = await sendDailyReport(yesterday);

        if (result.success) {
            console.log(`\n✅ Raport pentru ${yesterday} trimis cu succes!`);
            if (result.stats) {
                console.log(`📊 Statistici: ${result.stats.total} pronosticuri, ${result.stats.successRate}% success rate`);
            }
        } else {
            console.error(`\n❌ Eroare la trimitere raport: ${result.error}`);
        }

        // Generează raportul centralizat de pronostice (JSON + MD)
        try {
            console.log('\n📋 Generare raport centralizat pronostice...');
            generatePronosticsReport();
        } catch (err) {
            console.error(`⚠️  Eroare la generare raport pronostice: ${err.message}`);
        }

    } catch (error) {
        console.error(`\n❌ EROARE CRITICĂ: ${error.message}`);
        console.error(error.stack);
    }

    console.log('='.repeat(60));
    console.log(`\n⏲️  Următorul raport: mâine la 08:00`);
}

/**
 * Pornește scheduler-ul
 */
function startScheduler() {
    console.log('\n⏰ DAILY REPORT SCHEDULER - START\n');
    console.log('='.repeat(60));
    console.log(`📅 Schedule: ${SCHEDULE_TIME} (08:00 în fiecare zi)`);
    console.log(`⏰ Pornit la: ${new Date().toLocaleString('ro-RO')}`);
    console.log('='.repeat(60));

    // Validează cron expression
    const isValid = cron.validate(SCHEDULE_TIME);
    if (!isValid) {
        console.error(`\n❌ EROARE: Cron expression invalid: ${SCHEDULE_TIME}`);
        process.exit(1);
    }

    // Pornește task-ul programat
    cron.schedule(SCHEDULE_TIME, dailyReportTask, {
        timezone: "Europe/Bucharest"
    });

    console.log('\n✅ Scheduler pornit cu succes!');
    console.log(`📧 Raportul zilnic va fi trimis automat în fiecare zi la 08:00`);
    console.log(`💡 Apasă CTRL+C pentru a opri\n`);

    // Afișează când va fi următoarea rulare
    const nextRun = getNextRunTime();
    console.log(`⏲️  Următoarea trimitere: ${nextRun}\n`);

    // Keep process alive
    process.stdin.resume();
}

/**
 * Calculează următoarea oră de rulare
 */
function getNextRunTime() {
    const now = new Date();
    const next = new Date();
    next.setHours(8, 0, 0, 0);

    // Dacă ora 08:00 a trecut astăzi, setează pentru mâine
    if (next <= now) {
        next.setDate(next.getDate() + 1);
    }

    return next.toLocaleString('ro-RO');
}

/**
 * Test mode - trimite imediat
 */
async function testMode() {
    console.log('\n🧪 TEST MODE - Trimitere imediată\n');
    await dailyReportTask();
    console.log('\n✅ Test completat!\n');
    process.exit(0);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 DAILY REPORT SCHEDULER - Oprire...\n');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\n🛑 DAILY REPORT SCHEDULER - Oprire...\n');
    process.exit(0);
});

// Main
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes('--test') || args.includes('-t')) {
        testMode();
    } else if (args.includes('--help') || args.includes('-h')) {
        console.log(`
📖 USAGE:

   node DAILY_REPORT_SCHEDULER.js              # Pornește scheduler (08:00 daily)
   node DAILY_REPORT_SCHEDULER.js --test       # Test - trimite imediat
   node DAILY_REPORT_SCHEDULER.js --help       # Afișează acest help

⏰ SCHEDULE:

   Raportul zilnic este trimis automat în fiecare zi la ora 08:00 (timezone: Europe/Bucharest)

📧 CE TRIMITE:

   - Toate notificările din ziua anterioară
   - Pattern-uri detectate și pronosticuri
   - Cote Superbet & Netbet
   - Status validare (CÂȘTIGAT/PIERDUT/PENDING)
   - Success rate
   - Statistici complete

🚀 PORNIRE AUTOMATĂ:

   Pentru a porni automat cu API SMART 5, adaugă în script-ul de pornire:

   nohup node DAILY_REPORT_SCHEDULER.js > logs/daily-report-scheduler.log 2>&1 &

📁 LOG-URI:

   Log-urile sunt salvate în: logs/daily-report-scheduler.log

🛑 OPRIRE:

   pkill -f "DAILY_REPORT_SCHEDULER"
   sau
   CTRL+C dacă rulează în terminal
`);
    } else {
        startScheduler();
    }
}

// Export
module.exports = {
    startScheduler,
    dailyReportTask
};
