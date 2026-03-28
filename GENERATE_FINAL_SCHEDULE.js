/**
 * ⚽ GENERATE_FINAL_SCHEDULE.js
 *
 * Generează programul de verificări pentru extragerea datelor FINALE (FT)
 *
 * INPUT: meciuri-YYYY-MM-DD.json (lista meciurilor zilei)
 * OUTPUT: final-verificari-YYYY-MM-DD.json (program verificări FT)
 *
 * LOGICĂ:
 * - Pentru fiecare meci din listă
 * - Adaugă 120 minute la ora de începere (ora_meci + 120 min = finalul meciului)
 * - Creează program de verificări pentru colectare date FT
 *
 * USAGE:
 *   const { generateFinalSchedule } = require('./GENERATE_FINAL_SCHEDULE');
 *   generateFinalSchedule('./meciuri-2025-11-04.json');
 */

const fs = require('fs');
const path = require('path');

/**
 * Generează program verificări FINALE (ora + 120 min)
 *
 * @param {string} matchesFilePath - Calea către fișierul cu meciuri
 * @returns {object} - { totalVerificari, verificari: [], outputFile }
 */
function generateFinalSchedule(matchesFilePath) {
    console.log(`\n📋 GENERARE PROGRAM VERIFICĂRI FINALE (FT)\n`);
    console.log('='.repeat(60));

    // Verifică dacă fișierul există
    if (!fs.existsSync(matchesFilePath)) {
        throw new Error(`Fișierul nu există: ${matchesFilePath}`);
    }

    // Citește lista de meciuri
    const matchesData = JSON.parse(fs.readFileSync(matchesFilePath, 'utf8'));

    // Suportă ambele formate: matches sau meciuri
    const matches = matchesData.matches || matchesData.meciuri;

    if (!matches || matches.length === 0) {
        console.log('⚠️  Nu sunt meciuri în listă.');
        return {
            totalVerificari: 0,
            verificari: [],
            outputFile: null
        };
    }

    console.log(`📅 Meciuri găsite: ${matches.length}`);

    // Ora curentă
    const now = new Date();
    const verificari = [];
    let skipped = 0;

    // Parcurge fiecare meci
    for (const match of matches) {
        // Ora de începere a meciului (timestamp în secunde)
        const matchTimestamp = match.timestamp || match.startTime; // timestamp în SECUNDE
        const matchDate = new Date(matchTimestamp * 1000); // convertește în milisecunde

        // Adaugă 120 minute (2 ore) pentru finalul meciului
        const checkTime = new Date(matchDate.getTime() + (120 * 60 * 1000));

        // Dacă ora de verificare a trecut deja, skip
        if (checkTime < now) {
            skipped++;
            continue;
        }

        // Formatare oră pentru afișare
        const checkTimeFormatted = checkTime.toLocaleString('ro-RO', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        const matchTimeFormatted = matchDate.toLocaleString('ro-RO', {
            hour: '2-digit',
            minute: '2-digit'
        });

        verificari.push({
            matchId: match.matchId,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            league: match.liga || match.league,
            leagueId: match.leagueId || null,
            country: match.country || null,
            matchStartTime: matchTimestamp, // timestamp original (secunde)
            matchStartTimeFormatted: matchTimeFormatted,
            checkTime: Math.floor(checkTime.getTime() / 1000), // timestamp verificare (secunde)
            checkTimeFormatted: checkTimeFormatted,
            checked: false,
            success: null,
            errorMessage: null
        });
    }

    // Sortează după ora de verificare (cronologic)
    verificari.sort((a, b) => a.checkTime - b.checkTime);

    console.log(`\n✅ Verificări programate: ${verificari.length}`);
    if (skipped > 0) {
        console.log(`⏭️  Meciuri sărite (trecute): ${skipped}`);
    }

    // Afișează primele 5 verificări
    if (verificari.length > 0) {
        console.log(`\n🔍 Primele verificări programate:\n`);
        verificari.slice(0, 5).forEach((v, index) => {
            console.log(`   ${index + 1}. ${v.homeTeam} vs ${v.awayTeam}`);
            console.log(`      Liga: ${v.league}`);
            console.log(`      Meci start: ${v.matchStartTimeFormatted}`);
            console.log(`      Verificare FT: ${v.checkTimeFormatted}`);
            console.log('');
        });

        if (verificari.length > 5) {
            console.log(`   ... și încă ${verificari.length - 5} verificări\n`);
        }
    }

    // Generează nume fișier output
    const inputBasename = path.basename(matchesFilePath, '.json');
    const date = inputBasename.replace('meciuri-', '');
    const outputFilename = `final-verificari-${date}.json`;
    const outputPath = path.join(path.dirname(matchesFilePath), outputFilename);

    // Salvează programul
    const output = {
        generated: new Date().toISOString(),
        sourceFile: matchesFilePath,
        totalVerificari: verificari.length,
        verificariSkipped: skipped,
        verificari: verificari
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

    console.log(`📄 Program salvat: ${outputFilename}`);
    console.log('='.repeat(60));

    return {
        totalVerificari: verificari.length,
        verificari: verificari,
        outputFile: outputPath
    };
}

/**
 * Afișează statistici despre program
 */
function displayScheduleStats(scheduleFile) {
    if (!fs.existsSync(scheduleFile)) {
        console.log('❌ Fișierul nu există!');
        return;
    }

    const data = JSON.parse(fs.readFileSync(scheduleFile, 'utf8'));

    console.log(`\n📊 STATISTICI PROGRAM VERIFICĂRI FINALE\n`);
    console.log('='.repeat(60));
    console.log(`📅 Generat: ${new Date(data.generated).toLocaleString('ro-RO')}`);
    console.log(`📋 Total verificări: ${data.totalVerificari}`);

    if (data.verificariSkipped > 0) {
        console.log(`⏭️  Meciuri sărite: ${data.verificariSkipped}`);
    }

    // Grupează pe ore
    const byHour = {};
    data.verificari.forEach(v => {
        const hour = new Date(v.checkTime * 1000).getHours();
        byHour[hour] = (byHour[hour] || 0) + 1;
    });

    console.log(`\n⏰ Distribuție pe ore:`);
    Object.keys(byHour).sort((a, b) => a - b).forEach(hour => {
        const hourPadded = String(hour).padStart(2, '0');
        const bar = '█'.repeat(Math.ceil(byHour[hour] / 2));
        console.log(`   ${hourPadded}:00 - ${byHour[hour]} verificări ${bar}`);
    });

    // Grupează pe ligi
    const byLeague = {};
    data.verificari.forEach(v => {
        byLeague[v.league] = (byLeague[v.league] || 0) + 1;
    });

    console.log(`\n🏆 Distribuție pe ligi:`);
    Object.entries(byLeague)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([league, count]) => {
            const bar = '█'.repeat(Math.ceil(count / 2));
            console.log(`   ${league.padEnd(25)} ${count} ${bar}`);
        });

    console.log('='.repeat(60));
}

// Export
module.exports = {
    generateFinalSchedule,
    displayScheduleStats
};

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
📖 USAGE:

   node GENERATE_FINAL_SCHEDULE.js <meciuri-file.json>
   node GENERATE_FINAL_SCHEDULE.js stats <final-verificari-file.json>

📝 EXEMPLE:

   node GENERATE_FINAL_SCHEDULE.js ./meciuri-2025-11-04.json
   node GENERATE_FINAL_SCHEDULE.js stats ./final-verificari-2025-11-04.json
`);
        process.exit(0);
    }

    if (args[0] === 'stats') {
        displayScheduleStats(args[1]);
    } else {
        try {
            generateFinalSchedule(args[0]);
        } catch (error) {
            console.error(`\n❌ EROARE: ${error.message}\n`);
            process.exit(1);
        }
    }
}
