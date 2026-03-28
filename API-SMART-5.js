#!/usr/bin/env node
/**
 * ⚽ API SMART 5 - MASTER SCRIPT
 *
 * Sistem automat complet pentru detectarea pattern-urilor la HT
 *
 * WORKFLOW COMPLET:
 * 1. Generează lista meciurilor zilnice (TOP 30 ligi)
 * 2. Creează program verificări (meciuri + 45 min = pauză)
 * 3. Monitorizează automat și extrage statistici la HT
 * 4. Verifică pattern-uri (71 de pattern-uri)
 * 5. Scrapeează clasament pentru poziție exactă
 * 6. Calculează probabilitate (ligă + tier + pattern)
 * 7. Trimite email dacă >= 80% (75% cupe europene, 90% ligi slabe sub 50% win rate)
 * 8. Monitorizează COTE LIVE din 2 în 2 minute pentru praguri 1.5 și 2.0
 * 9. Verifică automat îndeplinirea pronosticurilor (CÂȘTIGAT/PIERDUT)
 *
 * COMENZI:
 * - node API-SMART-5.js daily         → Generează listă meciuri
 * - node API-SMART-5.js schedule      → Generează program verificări
 * - node API-SMART-5.js monitor       → Pornește monitorizarea
 * - node API-SMART-5.js full          → Workflow complet (daily + schedule + monitor)
 * - node API-SMART-5.js               → Default = full
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const logger = require('./LOG_MANAGER');
const { generatePreMatchStreaks } = require('./PRE_MATCH_STREAKS');

// Import module
const { generateDailyMatches } = require('./DAILY_MATCHES');
const { generateCheckSchedule } = require('./GENERATE_CHECK_SCHEDULE');
const { monitorSchedule } = require('./STATS_MONITOR');
const { generateFinalSchedule } = require('./GENERATE_FINAL_SCHEDULE');
const { monitorFinalSchedule } = require('./FINAL_MONITOR');
const { collectDailyFinalData, getYesterdayDate } = require('./DAILY_FINAL_DATA_COLLECTOR');
const SystemNotifier = require('./SYSTEM_NOTIFIER');
const AutoValidator = require('./AUTO_VALIDATOR');
const reportScheduler = require('./REPORT_SCHEDULER');

/**
 * ASCII Banner
 */
function showBanner() {
    logger.info(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     █████╗ ██████╗ ██╗    ███████╗███╗   ███╗ █████╗ ██████╗ ████████╗    ███████╗
║    ██╔══██╗██╔══██╗██║    ██╔════╝████╗ ████║██╔══██╗██╔══██╗╚══██╔══╝    ██╔════╝
║    ███████║██████╔╝██║    ███████╗██╔████╔██║███████║██████╔╝   ██║       ███████╗
║    ██╔══██║██╔═══╝ ██║    ╚════██║██║╚██╔╝██║██╔══██║██╔══██╗   ██║       ╚════██║
║    ██║  ██║██║     ██║    ███████║██║ ╚═╝ ██║██║  ██║██║  ██║   ██║       ███████║
║    ╚═╝  ╚═╝╚═╝     ╚═╝    ╚══════╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝       ╚══════╝
║                                                               ║
║              Sistem Automat de Analiză Pattern-uri           ║
║           FlashScore API → HT Stats → Email Alert            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);
}

/**
 * Afișează meniu help
 */
function showHelp() {
    logger.info(`
📖 COMENZI DISPONIBILE:

   node API-SMART-5.js daily
      → Generează lista meciurilor din ziua curentă (TOP 30 ligi)
      → Output: meciuri-YYYY-MM-DD.json

   node API-SMART-5.js schedule
      → Generează program verificări (meciuri + 45 min)
      → Input: meciuri-YYYY-MM-DD.json
      → Output: verificari-YYYY-MM-DD.json

   node API-SMART-5.js monitor
      → Pornește monitorizarea automată (daemon)
      → Verifică la fiecare 1 minut dacă a venit ora verificării
      → La HT (min 45): extrage stats + verifică pattern-uri + trimite email
      → Monitorizează COTE LIVE din 2 în 2 min (praguri 1.5 și 2.0)
      → Verifică automat îndeplinirea pronosticurilor

   node API-SMART-5.js watchdog
      → Pornește watchdog-ul de monitorizare (daemon)
      → Trimite START notification când pornește
      → Trimite HEARTBEAT la fiecare oră (13:00-23:00)
      → Detectează CRASH-uri și trimite alertă

   node API-SMART-5.js finalschedule
      → Generează program verificări FINALE (ora + 120 min)
      → Input: meciuri-YYYY-MM-DD.json
      → Output: final-verificari-YYYY-MM-DD.json

   node API-SMART-5.js finalmonitor
      → Pornește monitorizarea FINALĂ (daemon)
      → Verifică meciuri terminate și extrage date FT
      → Salvează automat în JSON-uri per campionat

   node API-SMART-5.js collectyesterday
      → Colectează date FINALE pentru meciurile de IERI
      → Recomandat DIMINEAȚA (6:00-12:00)
      → Nu interferează cu monitorizarea live HT
      → Salvează automat în JSON-uri per campionat

   node API-SMART-5.js autovalidate
      → Validează automat notificările pending (rulare single)
      → Verifică notificări mai vechi de 3h și le validează

   node API-SMART-5.js autovalidate --continuous
      → Pornește auto-validarea continuă (daemon la fiecare 6h)
      → Validează automat pronosticurile pentru meciurile terminate

   node API-SMART-5.js full
      → Workflow COMPLET HT (daily + schedule + monitor)
      → Recomandat pentru prima rulare a zilei

   node API-SMART-5.js fullday
      → Workflow COMPLET HT + FT (daily + schedule + monitor + finalschedule + finalmonitor)
      → Colectează date la HT ȘI la finalul meciurilor

   node API-SMART-5.js
      → Default = full workflow

   node API-SMART-5.js help
      → Afișează acest meniu

📊 EXEMPLE:

   # Dimineața (08:00) - pregătire zi nouă
   node API-SMART-5.js full

   # Pornire rapidă monitor (dacă lista există deja)
   node API-SMART-5.js monitor

   # Doar generare listă (fără monitorizare)
   node API-SMART-5.js daily

🔧 CONFIGURARE:

   - Email: NOTIFICATION_CONFIG.js
   - Ligi TOP: TOP_LEAGUES.js
   - Procente: JSON PROCENTE AUTOACTUAL.json

📁 FIȘIERE GENERATE:

   meciuri-YYYY-MM-DD.json        → Lista meciurilor zilei
   verificari-YYYY-MM-DD.json     → Program verificări
   stats-{matchId}-HT.json        → Statistici extrase la HT
   logs/stats-monitor-*.log       → Log-uri monitorizare

`);
}

/**
 * Obține numele fișierului pentru data curentă
 */
function getTodayFilename(prefix) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${prefix}-${year}-${month}-${day}.json`;
}

/**
 * Verifică dacă fișierul există
 */
function fileExists(filepath) {
    return fs.existsSync(filepath);
}

/**
 * Comandă: daily - Generează lista meciurilor zilnice
 */
async function commandDaily() {
    logger.info('\n📅 STEP 1: GENERARE LISTĂ MECIURI ZILNICĂ\n');
    logger.info('=' .repeat(60));

    try {
        const result = await generateDailyMatches();

        if (result && result.totalMatches > 0) {
            logger.info(`\n✅ SUCCESS: ${result.totalMatches} meciuri găsite pentru astăzi!`);
            return { success: true, hasMatches: true, totalMatches: result.totalMatches };
        } else {
            logger.info('\n⚠️  Nu sunt meciuri din TOP ligi pentru astăzi.');
            return { success: true, hasMatches: false, totalMatches: 0 }; // Nu e eroare, doar nu sunt meciuri
        }
    } catch (error) {
        logger.error(`\n❌ EROARE la generare listă meciuri: ${error.message}`);
        return { success: false, hasMatches: false, error: error.message };
    }
}

/**
 * Comandă: schedule - Generează programul de verificări
 */
async function commandSchedule() {
    logger.info('\n⏰ STEP 2: GENERARE PROGRAM VERIFICĂRI\n');
    logger.info('='.repeat(60));

    const matchesFile = path.join(__dirname, getTodayFilename('meciuri'));

    // Verifică dacă există fișierul cu meciuri
    if (!fileExists(matchesFile)) {
        logger.error(`\n❌ EROARE: Fișierul ${getTodayFilename('meciuri')} nu există!`);
        logger.info('💡 Rulați mai întâi: node API-SMART-5.js daily\n');
        return false;
    }

    try {
        const { generateCheckSchedule } = require('./GENERATE_CHECK_SCHEDULE');
        const schedule = generateCheckSchedule(matchesFile);

        if (schedule) {
            // Salvează fișierul cu verificări
            const scheduleFile = matchesFile.replace('meciuri-', 'verificari-');
            fs.writeFileSync(scheduleFile, JSON.stringify(schedule, null, 2), 'utf8');
            logger.info(`\n💾 Salvat: ${path.basename(scheduleFile)}`);

            if (schedule.totalVerificari > 0) {
                logger.info(`\n✅ SUCCESS: ${schedule.totalVerificari} verificări programate!`);
            } else {
                logger.info('\n⚠️  Nu sunt verificări de programat (meciurile au fost deja).');
            }
            return true;
        } else {
            logger.error('\n❌ Eroare la generare program.');
            return false;
        }
    } catch (error) {
        logger.error(`\n❌ EROARE la generare program: ${error.message}`);
        return false;
    }
}

/**
 * Comandă: watchdog - Pornește watchdog-ul
 */
async function commandWatchdog() {
    logger.info('\n🐕 WATCHDOG - PORNIRE MONITORIZARE SISTEM\n');
    logger.info('='.repeat(60));

    try {
        const Watchdog = require('./WATCHDOG');
        const watchdog = new Watchdog();
        await watchdog.start();
        return true;
    } catch (error) {
        logger.error(`\n❌ EROARE la pornire watchdog: ${error.message}`);
        return false;
    }
}

/**
 * Comandă: monitor - Pornește monitorizarea
 */
async function commandMonitor() {
    logger.info('\n🔍 STEP 3: PORNIRE MONITORIZARE AUTOMATĂ\n');
    logger.info('='.repeat(60));

    const scheduleFile = path.join(__dirname, getTodayFilename('verificari'));

    // Verifică dacă există fișierul cu program
    if (!fileExists(scheduleFile)) {
        logger.error(`\n❌ EROARE: Fișierul ${getTodayFilename('verificari')} nu există!`);
        logger.info('💡 Rulați mai întâi: node API-SMART-5.js schedule\n');
        return false;
    }

    try {
        logger.info('\n🚀 Pornire daemon monitorizare...\n');

        // Pornește NOTIFICATION MONITOR (tracking notificări)
        try {
            logger.info('📊 Pornire NOTIFICATION MONITOR (tracking notificări)...');
            const NotificationMonitor = require('./NOTIFICATION_MONITOR');
            NotificationMonitor.start();
            logger.info('✅ NOTIFICATION MONITOR pornit!\n');
        } catch (error) {
            logger.error(`⚠️  NOTIFICATION MONITOR eșuat: ${error.message}\n`);
        }

        // Pornește SIMPLE ODDS MONITOR (monitorizare cote live - SIMPLU și FUNCȚIONAL)
        try {
            logger.info('💰 Pornire SIMPLE ODDS MONITOR (monitorizare cote live)...');
            const oddsMonitor = require('./ODDS_MONITOR_SIMPLE');
            oddsMonitor.start();
            logger.info('✅ SIMPLE ODDS MONITOR pornit!\n');
        } catch (error) {
            logger.error(`⚠️  ODDS MONITOR eșuat: ${error.message}\n`);
        }

        // Pornește MATCH VERIFICATION ALERTER (alertă meciuri neverificate)
        try {
            logger.info('🚨 Pornire MATCH VERIFICATION ALERTER...');
            const alerter = require('./MATCH_VERIFICATION_ALERTER');
            alerter.start();
            logger.info('✅ ALERTER pornit!\n');
        } catch (error) {
            logger.error(`⚠️  ALERTER eșuat: ${error.message}\n`);
        }

        // Pornește AUTO-VALIDATOR în background (validare automată la fiecare 6h)
        try {
            logger.info('🤖 Pornire AUTO-VALIDATOR (validare automată pronosticuri)...');
            const { spawn } = require('child_process');
            const autoValidatorProcess = spawn('node', [path.join(__dirname, 'start-auto-validator.js')], {
                detached: true,
                stdio: ['ignore', 'ignore', 'ignore']
            });
            autoValidatorProcess.unref();
            logger.info('✅ AUTO-VALIDATOR pornit în background (validare la fiecare 6h)!\n');
        } catch (error) {
            logger.error(`⚠️  AUTO-VALIDATOR eșuat: ${error.message}\n`);
        }

        // Pornește monitorul principal HT (FĂRĂ await - daemon care rulează la infinit)
        // ACESTA ESTE CEL MAI IMPORTANT - pattern detection!
        try {
            logger.info('🎯 Pornire STATS MONITOR (verificare pattern-uri la orele programate)...');
            monitorSchedule(scheduleFile);
            logger.info('✅ STATS MONITOR pornit!\n');
        } catch (error) {
            logger.error(`❌ STATS MONITOR eșuat: ${error.message}\n`);
        }

        logger.info('='.repeat(60));
        logger.info('✅ Toate monitoarele pornite!\n');

        return true;
    } catch (error) {
        logger.error(`\n❌ EROARE CRITICĂ la monitorizare: ${error.message}`);
        logger.error(error.stack);
        return false;
    }
}

/**
 * Comandă: finalschedule - Generează program verificări FINALE
 */
async function commandFinalSchedule() {
    logger.info('\n⏰ GENERARE PROGRAM VERIFICĂRI FINALE (FT)\n');
    logger.info('='.repeat(60));

    const matchesFile = path.join(__dirname, getTodayFilename('meciuri'));

    // Verifică dacă există fișierul cu meciuri
    if (!fileExists(matchesFile)) {
        logger.error(`\n❌ EROARE: Fișierul ${getTodayFilename('meciuri')} nu există!`);
        logger.info('💡 Rulați mai întâi: node API-SMART-5.js daily\n');
        return false;
    }

    try {
        const result = generateFinalSchedule(matchesFile);

        if (result && result.totalVerificari > 0) {
            logger.info(`\n✅ SUCCESS: ${result.totalVerificari} verificări FINALE programate!`);
            return true;
        } else {
            logger.info('\n⚠️  Nu sunt verificări de programat (meciurile au fost deja).');
            return true;
        }
    } catch (error) {
        logger.error(`\n❌ EROARE la generare program final: ${error.message}`);
        return false;
    }
}

/**
 * Comandă: finalmonitor - Pornește monitorizarea FINALĂ
 */
async function commandFinalMonitor() {
    logger.info('\n🔍 PORNIRE MONITORIZARE FINALĂ (FT)\n');
    logger.info('='.repeat(60));

    const scheduleFile = path.join(__dirname, getTodayFilename('final-verificari'));

    // Verifică dacă există fișierul cu program
    if (!fileExists(scheduleFile)) {
        logger.error(`\n❌ EROARE: Fișierul ${getTodayFilename('final-verificari')} nu există!`);
        logger.info('💡 Rulați mai întâi: node API-SMART-5.js finalschedule\n');
        return false;
    }

    try {
        logger.info('\n🚀 Pornire daemon monitorizare FINALĂ...\n');

        // Pornește NOTIFICATION MONITOR (tracking notificări)
        logger.info('📊 Pornire NOTIFICATION MONITOR (tracking notificări)...');
        const NotificationMonitor = require('./NOTIFICATION_MONITOR');
        NotificationMonitor.start();
        logger.info('✅ NOTIFICATION MONITOR pornit!\n');

        // Pornește SIMPLE ODDS MONITOR (monitorizare cote live - SIMPLU și FUNCȚIONAL)
        logger.info('💰 Pornire SIMPLE ODDS MONITOR (monitorizare cote live)...');
        const oddsMonitor = require('./ODDS_MONITOR_SIMPLE');
        oddsMonitor.start();
        logger.info('✅ SIMPLE ODDS MONITOR pornit!\n');

        // Pornește MATCH VERIFICATION ALERTER (alertă meciuri neverificate)
        logger.info('🚨 Pornire MATCH VERIFICATION ALERTER...');
        const alerter = require('./MATCH_VERIFICATION_ALERTER');
        alerter.start();
        logger.info('✅ ALERTER pornit!\n');

        // Pornește monitorul FINAL
        await monitorFinalSchedule(scheduleFile);
        return true;
    } catch (error) {
        logger.error(`\n❌ EROARE la monitorizare finală: ${error.message}`);
        return false;
    }
}

/**
 * Comandă: collectyesterday - Colectează date FINALE de ieri
 */
async function commandCollectYesterday() {
    logger.info('\n📦 COLECTARE DATE FINALE - ZIUA PRECEDENTĂ\n');
    logger.info('='.repeat(60));

    const yesterdayDate = getYesterdayDate();
    logger.info(`📅 Dată țintă: ${yesterdayDate}\n`);

    try {
        const result = await collectDailyFinalData(yesterdayDate);

        if (result.success) {
            logger.info('\n✅ Colectare completată cu succes!');
            return true;
        } else {
            logger.error('\n❌ Colectare eșuată');
            return false;
        }

    } catch (error) {
        logger.error(`\n❌ EROARE la colectare: ${error.message}`);
        return false;
    }
}

/**
 * Comandă: autovalidate - Validare automată notificări
 */
async function commandAutoValidate() {
    showBanner();
    logger.info('\n🤖 AUTO-VALIDARE NOTIFICĂRI\n');
    logger.info('='.repeat(60));

    const args = process.argv.slice(2);
    const isContinuous = args.includes('--continuous');
    const customInterval = args[2] ? parseInt(args[2]) : undefined;

    try {
        if (isContinuous) {
            // Mod continuu - daemon la interval
            logger.info('🔄 MOD CONTINUU ACTIVAT');
            if (customInterval) {
                logger.info(`⏰ Interval custom: ${Math.floor(customInterval / 3600)}h ${Math.floor((customInterval % 3600) / 60)}m`);
            } else {
                logger.info('⏰ Interval default: 6 ore');
            }
            logger.info('💡 Apasă CTRL+C pentru a opri\n');

            await AutoValidator.startAutoValidation(customInterval);
        } else {
            // Rulare single
            logger.info('🎯 Rulare single (o dată și se oprește)\n');
            const result = await AutoValidator.validatePendingNotifications();

            logger.info('\n✅ AUTO-VALIDARE COMPLETĂ!');
            logger.info(`📊 Rezultate: ${result.validated} validate, ${result.skipped} skipped, ${result.errors} erori\n`);
            return true;
        }
    } catch (error) {
        logger.error(`\n❌ EROARE la auto-validare: ${error.message}`);
        return false;
    }
}

/**
 * Comandă: full - Workflow complet HT
 */
async function commandFull() {
    showBanner();
    logger.info('\n🚀 WORKFLOW COMPLET HT - API SMART 5\n');
    logger.info('='.repeat(60));

    // STEP 0 eliminat - colectare date IERI rulează separat din cron (07:00, 09:00, 11:00)
    // `full` se concentrează DOAR pe monitorizarea HT pentru meciurile de AZI

    // Step 1: Daily matches
    const dailyResult = await commandDaily();
    if (!dailyResult.success) {
        logger.error('\n❌ Workflow OPRIT: Eroare la generare listă meciuri\n');
        process.exit(1);
    }

    // Verifică dacă sunt meciuri
    if (!dailyResult.hasMatches) {
        logger.info('\n' + '='.repeat(60));
        logger.info('\n😴 NU SUNT MECIURI ASTĂZI\n');
        logger.info('📧 Trimit notificare...\n');

        // Trimite notificare
        const notifier = new SystemNotifier();
        await notifier.sendNoMatchesNotification('Pauză internațională / Nu sunt meciuri din TOP 30 ligi');

        logger.info('\n✅ Notificare trimisă!');
        logger.info('📅 Ne vedem mâine la 08:00 pentru următoarea verificare\n');
        logger.info('='.repeat(60));

        // Creează flag pentru WATCHDOG (să nu repornească imediat)
        const flagFile = path.join(__dirname, '.no-matches-today.flag');
        fs.writeFileSync(flagFile, JSON.stringify({
            date: new Date().toISOString(),
            reason: 'Nu sunt meciuri din TOP 30 ligi astăzi'
        }), 'utf8');
        logger.info('🚩 Flag "no-matches-today" creat pentru WATCHDOG\n');

        process.exit(0);
    }

    // Delay 2 secunde
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Schedule
    const scheduleSuccess = await commandSchedule();
    if (!scheduleSuccess) {
        logger.error('\n❌ Workflow OPRIT: Eroare la generare program\n');
        process.exit(1);
    }

    // Step 2.5: Pre-match streak analysis
    const matchesFile = path.join(__dirname, getTodayFilename('meciuri'));
    logger.info('\n🔥 Analiză pre-meci serii consecutive...');
    try {
        const preMatchResult = await generatePreMatchStreaks(matchesFile);
        if (preMatchResult && preMatchResult.totalAlerts > 0) {
            logger.info(`✅ Pre-match streaks: ${preMatchResult.totalAlerts} alerte pentru ${preMatchResult.matchesWithAlerts} meciuri`);
        } else {
            logger.info('ℹ️  Pre-match streaks: nicio alertă peste prag');
        }
    } catch (e) {
        logger.error(`⚠️  Eroare pre-match streaks (non-fatal): ${e.message}`);
    }

    // Delay 2 secunde
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: Monitor
    logger.info('\n' + '='.repeat(60));
    logger.info('\n✅ PREGĂTIRE COMPLETĂ!\n');
    logger.info('📊 Lista meciurilor: ✅');
    logger.info('⏰ Program verificări HT: ✅');
    logger.info('\n🔍 Pornire monitorizare HT...\n');
    logger.info('='.repeat(60));

    // Pornire scheduler automat rapoarte (lunar + săptămânal)
    logger.info('📅 Pornire scheduler automat rapoarte...');
    reportScheduler.start();
    logger.info('✅ Scheduler rapoarte pornit!\n');

    // PORNIRE MONITOARE - ÎNAINTE de email START
    await commandMonitor();

    // Trimite notificare START (LA FINAL, să nu blocheze pornirea)
    logger.info('\n📧 Trimit notificare START...');
    const notifier = new SystemNotifier();
    const startResult = await notifier.sendStartupNotification(process.pid);
    if (startResult.success) {
        logger.info('✅ Notificare START trimisă!\n');
    } else {
        logger.info(`⚠️  Notificare START nu a putut fi trimisă: ${startResult.reason}\n`);
    }
}

/**
 * Comandă: fullday - Workflow complet HT + FT
 */
async function commandFullDay() {
    showBanner();
    logger.info('\n🚀 WORKFLOW COMPLET ZI ÎNTREAGĂ (HT + FT) - API SMART 5\n');
    logger.info('='.repeat(60));

    // Step 1: Daily matches
    const dailyResult = await commandDaily();
    if (!dailyResult.success) {
        logger.error('\n❌ Workflow OPRIT: Eroare la generare listă meciuri\n');
        process.exit(1);
    }

    // Verifică dacă sunt meciuri
    if (!dailyResult.hasMatches) {
        logger.info('\n' + '='.repeat(60));
        logger.info('\n😴 NU SUNT MECIURI ASTĂZI\n');
        logger.info('📧 Trimit notificare...\n');

        // Trimite notificare
        const notifier = new SystemNotifier();
        await notifier.sendNoMatchesNotification('Pauză internațională / Nu sunt meciuri din TOP 30 ligi');

        logger.info('\n✅ Notificare trimisă!');
        logger.info('📅 Ne vedem mâine la 08:00 pentru următoarea verificare\n');
        logger.info('='.repeat(60));

        // Creează flag pentru WATCHDOG (să nu repornească imediat)
        const flagFile = path.join(__dirname, '.no-matches-today.flag');
        fs.writeFileSync(flagFile, JSON.stringify({
            date: new Date().toISOString(),
            reason: 'Nu sunt meciuri din TOP 30 ligi astăzi'
        }), 'utf8');
        logger.info('🚩 Flag "no-matches-today" creat pentru WATCHDOG\n');

        process.exit(0);
    }

    // Delay 2 secunde
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Schedule HT
    const scheduleSuccess = await commandSchedule();
    if (!scheduleSuccess) {
        logger.error('\n❌ Workflow OPRIT: Eroare la generare program HT\n');
        process.exit(1);
    }

    // Delay 2 secunde
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: Schedule FINAL
    const finalScheduleSuccess = await commandFinalSchedule();
    if (!finalScheduleSuccess) {
        logger.error('\n❌ Workflow OPRIT: Eroare la generare program FINAL\n');
        process.exit(1);
    }

    // Delay 2 secunde
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 4: Pornire paralel - HT monitor + FINAL monitor
    logger.info('\n' + '='.repeat(60));
    logger.info('\n✅ PREGĂTIRE COMPLETĂ!\n');
    logger.info('📊 Lista meciurilor: ✅');
    logger.info('⏰ Program verificări HT: ✅');
    logger.info('⏰ Program verificări FINAL: ✅');
    logger.info('\n🔍 Pornire monitorizare HT + FINAL...\n');
    logger.info('='.repeat(60));

    // Pornire scheduler automat rapoarte (lunar + săptămânal)
    logger.info('\n📅 Pornire scheduler automat rapoarte...');
    reportScheduler.start();
    logger.info('✅ Scheduler rapoarte pornit!\n');

    // Pornire paralel - HT și FINAL
    // Momentan, pornim doar FINAL pentru a nu interfera
    // TODO: Implementare paralel cu child processes
    await commandFinalMonitor();
}

/**
 * Main
 */
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'full';

    switch (command.toLowerCase()) {
        case 'daily':
            showBanner();
            await commandDaily();
            break;

        case 'schedule':
            showBanner();
            await commandSchedule();
            break;

        case 'monitor':
            showBanner();
            await commandMonitor();
            break;

        case 'watchdog':
            showBanner();
            await commandWatchdog();
            break;

        case 'finalschedule':
            showBanner();
            await commandFinalSchedule();
            break;

        case 'finalmonitor':
            showBanner();
            await commandFinalMonitor();
            break;

        case 'collectyesterday':
            showBanner();
            await commandCollectYesterday();
            break;

        case 'autovalidate':
            await commandAutoValidate();
            break;

        case 'full':
            await commandFull();
            break;

        case 'fullday':
            await commandFullDay();
            break;

        case 'help':
        case '--help':
        case '-h':
            showBanner();
            showHelp();
            break;

        default:
            showBanner();
            logger.info(`\n❌ Comandă necunoscută: "${command}"\n`);
            showHelp();
            process.exit(1);
    }
}

// Cleanup la exit
process.on('SIGINT', () => {
    logger.info('\n\n🛑 Oprire sistem...\n');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('\n\n🛑 Oprire sistem...\n');
    process.exit(0);
});

// Run
if (require.main === module) {
    main().catch(error => {
        logger.error(`\n❌ EROARE FATALĂ: ${error.message || error}`);
        process.exit(1);
    });
}

module.exports = {
    commandDaily,
    commandSchedule,
    commandMonitor,
    commandWatchdog,
    commandFinalSchedule,
    commandFinalMonitor,
    commandCollectYesterday,
    commandAutoValidate,
    commandFull,
    commandFullDay
};
