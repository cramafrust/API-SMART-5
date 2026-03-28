/**
 * ⚽ FINAL_MONITOR.js
 *
 * Monitor automat pentru colectarea datelor FINALE (FT)
 *
 * FUNCȚIONALITATE:
 * - Monitorizează programul de verificări finale
 * - Extrage automat date FT când vine momentul
 * - Salvează datele în JSON-uri per campionat
 * - Marchează verificările ca fiind completate
 * - Rulează ca daemon (verificare la fiecare 1 minut)
 *
 * WORKFLOW:
 * 1. Citește final-verificari-YYYY-MM-DD.json
 * 2. La fiecare 1 min, verifică dacă este momentul
 * 3. Extrage date FT cu FINAL_STATS_EXTRACTOR
 * 4. Salvează cu CHAMPIONSHIP_JSON_MANAGER
 * 5. Marchează verificarea ca completă
 * 6. Salvează progresul în JSON
 *
 * USAGE:
 *   const { monitorFinalSchedule } = require('./FINAL_MONITOR');
 *   await monitorFinalSchedule('./final-verificari-2025-11-04.json');
 */

const fs = require('fs');
const path = require('path');
const { extractFinalStats } = require('./FINAL_STATS_EXTRACTOR');
const { saveMatchData } = require('./CHAMPIONSHIP_JSON_MANAGER');
const lifecycle = require('./LIFECYCLE_MANAGER');

// Director unde se salvează JSON-urile de campionat
const CHAMPIONSHIP_DIR = '/home/florian/football-analyzer';

// Interval de verificare (1 minut = 60000 ms)
const CHECK_INTERVAL = 60 * 1000;

// Offset pentru verificare (verifică cu 2 minute mai devreme)
const CHECK_OFFSET = 2 * 60; // 2 minute în secunde

/**
 * Salvează starea curentă a programului de verificări
 */
function saveScheduleState(scheduleFile, scheduleData) {
    try {
        fs.writeFileSync(scheduleFile, JSON.stringify(scheduleData, null, 2), 'utf8');
    } catch (error) {
        console.error(`❌ Eroare la salvare program: ${error.message}`);
    }
}

/**
 * Procesează un meci (extrage date + salvează)
 */
async function processMatch(verificare, scheduleData, scheduleFile) {
    const matchInfo = {
        matchId: verificare.matchId,
        homeTeam: verificare.homeTeam,
        awayTeam: verificare.awayTeam,
        league: verificare.league,
        leagueId: verificare.leagueId,
        country: verificare.country,
        matchStartTime: verificare.matchStartTime
    };

    try {
        // Extrage date finale
        console.log(`\n⚽ PROCESARE MECI: ${verificare.homeTeam} vs ${verificare.awayTeam}`);
        console.log(`   Liga: ${verificare.league}`);

        const matchData = await extractFinalStats(verificare.matchId, matchInfo);

        if (!matchData) {
            // Meciul nu este încă terminat
            verificare.checked = true;
            verificare.success = false;
            verificare.errorMessage = 'Meciul nu este încă terminat';
            verificare.checkedAt = new Date().toISOString();

            console.log(`   ⚠️  Meciul nu este terminat, va fi verificat din nou mai târziu`);

            // Salvează starea
            saveScheduleState(scheduleFile, scheduleData);
            return false;
        }

        // Salvează în JSON de campionat
        const saveResult = saveMatchData(matchData, CHAMPIONSHIP_DIR);

        if (saveResult.success) {
            // Marchez verificarea ca fiind completă
            verificare.checked = true;
            verificare.success = true;
            verificare.checkedAt = new Date().toISOString();
            verificare.savedTo = saveResult.filename;

            console.log(`   ✅ Meci salvat cu succes în ${saveResult.filename}`);

        } else {
            verificare.checked = true;
            verificare.success = false;
            verificare.errorMessage = saveResult.reason || saveResult.error || 'Unknown error';
            verificare.checkedAt = new Date().toISOString();

            console.log(`   ⚠️  Salvare eșuată: ${verificare.errorMessage}`);
        }

        // Salvează starea actualizată
        saveScheduleState(scheduleFile, scheduleData);

        return verificare.success;

    } catch (error) {
        console.error(`   ❌ EROARE la procesare: ${error.message}`);

        verificare.checked = true;
        verificare.success = false;
        verificare.errorMessage = error.message;
        verificare.checkedAt = new Date().toISOString();

        // Salvează starea
        saveScheduleState(scheduleFile, scheduleData);

        return false;
    }
}

/**
 * Verifică programul și procesează meciurile care trebuie verificate
 */
async function checkSchedule(scheduleFile, scheduleData) {
    const now = Math.floor(Date.now() / 1000); // timestamp curent în secunde

    let processed = 0;
    let successful = 0;

    for (const verificare of scheduleData.verificari) {
        // Skip dacă deja verificat
        if (verificare.checked) {
            continue;
        }

        // Verifică dacă a venit momentul (cu offset de 2 minute mai devreme)
        const checkTime = verificare.checkTime - CHECK_OFFSET;

        if (now >= checkTime) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`🔔 VERIFICARE PROGRAMATĂ: ${verificare.checkTimeFormatted}`);
            console.log(`${'='.repeat(60)}`);

            const success = await processMatch(verificare, scheduleData, scheduleFile);

            processed++;
            if (success) successful++;

            // Delay între meciuri (1 secundă)
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    return { processed, successful };
}

/**
 * Afișează statistici despre progres
 */
function displayProgress(scheduleData) {
    const total = scheduleData.verificari.length;
    const checked = scheduleData.verificari.filter(v => v.checked).length;
    const successful = scheduleData.verificari.filter(v => v.success === true).length;
    const failed = scheduleData.verificari.filter(v => v.checked && !v.success).length;
    const pending = total - checked;

    const percentage = total > 0 ? Math.round((checked / total) * 100) : 0;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 PROGRES COLECTARE DATE FINALE`);
    console.log(`${'='.repeat(60)}`);
    console.log(`   Total meciuri: ${total}`);
    console.log(`   ✅ Procesate cu succes: ${successful}`);
    console.log(`   ⚠️  Eșuate/Neterminate: ${failed}`);
    console.log(`   ⏳ În așteptare: ${pending}`);
    console.log(`   📈 Progres: ${percentage}%`);

    // Următoarea verificare
    const now = Math.floor(Date.now() / 1000);
    const nextCheck = scheduleData.verificari.find(v => !v.checked && v.checkTime > now);

    if (nextCheck) {
        const timeUntil = nextCheck.checkTime - now;
        const minutesUntil = Math.floor(timeUntil / 60);
        const hoursUntil = Math.floor(minutesUntil / 60);

        console.log(`\n   ⏰ Următoarea verificare:`);
        console.log(`      ${nextCheck.homeTeam} vs ${nextCheck.awayTeam}`);
        console.log(`      ${nextCheck.checkTimeFormatted}`);

        if (hoursUntil > 0) {
            console.log(`      (în ${hoursUntil}h ${minutesUntil % 60}m)`);
        } else {
            console.log(`      (în ${minutesUntil}m)`);
        }
    }

    console.log(`${'='.repeat(60)}\n`);
}

/**
 * Pornește monitorizarea programului de verificări finale
 *
 * @param {string} scheduleFile - Calea către final-verificari-YYYY-MM-DD.json
 */
async function monitorFinalSchedule(scheduleFile) {
    console.log(`\n🚀 START MONITORIZARE FINALE\n`);
    console.log('='.repeat(60));

    // Verifică dacă fișierul există
    if (!fs.existsSync(scheduleFile)) {
        throw new Error(`Fișierul nu există: ${scheduleFile}`);
    }

    // Citește programul
    const scheduleData = JSON.parse(fs.readFileSync(scheduleFile, 'utf8'));

    console.log(`📋 Program: ${path.basename(scheduleFile)}`);
    console.log(`📊 Total verificări: ${scheduleData.totalVerificari}`);
    console.log(`⏰ Interval verificare: ${CHECK_INTERVAL / 1000}s (1 minut)`);
    console.log(`🎯 Offset verificare: -${CHECK_OFFSET / 60} minute`);
    console.log('='.repeat(60));

    // Afișează progresul inițial
    displayProgress(scheduleData);

    // Loop principal
    let iteration = 0;

    console.log(`\n🔄 Pornire loop monitorizare...\n`);

    lifecycle.setInterval('final-monitor', async () => {
        iteration++;

        const now = new Date();
        const timeStr = now.toLocaleTimeString('ro-RO');

        console.log(`[${timeStr}] Verificare #${iteration}...`);

        try {
            // Reîncarcă datele (în caz că au fost modificate extern)
            const freshData = JSON.parse(fs.readFileSync(scheduleFile, 'utf8'));

            // Verifică și procesează
            const result = await checkSchedule(scheduleFile, freshData);

            if (result.processed > 0) {
                console.log(`\n✅ Procesate: ${result.processed} meciuri (${result.successful} succes)`);

                // Afișează progresul actualizat
                displayProgress(freshData);
            }

            // Verifică dacă am terminat toate verificările
            const allChecked = freshData.verificari.every(v => v.checked);

            if (allChecked) {
                console.log(`\n${'='.repeat(60)}`);
                console.log(`🎉 TOATE VERIFICĂRILE COMPLETATE!`);
                console.log(`${'='.repeat(60)}\n`);

                // Afișează statistici finale
                displayProgress(freshData);

                lifecycle.clearInterval('final-monitor');
                console.log(`✅ Monitorizare oprită.\n`);
            }

        } catch (error) {
            console.error(`❌ Eroare în loop: ${error.message}`);
        }

    }, CHECK_INTERVAL);

    // Keep-alive
    return new Promise((resolve) => {
        // Programul va rula până când toate verificările sunt complete
        // sau până când este oprit manual (Ctrl+C)
    });
}

// Export
module.exports = {
    monitorFinalSchedule,
    processMatch,
    checkSchedule,
    displayProgress
};

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
📖 USAGE:

   node FINAL_MONITOR.js <final-verificari-file.json>

📝 EXEMPLU:

   node FINAL_MONITOR.js ./final-verificari-2025-11-04.json

   Pornește monitorizarea automată pentru colectarea datelor finale
`);
        process.exit(0);
    }

    const scheduleFile = args[0];

    monitorFinalSchedule(scheduleFile).catch(error => {
        console.error(`\n❌ EROARE FATALĂ: ${error.message}\n`);
        process.exit(1);
    });
}
