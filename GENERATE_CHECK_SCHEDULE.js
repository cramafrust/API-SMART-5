/**
 * GENERATE CHECK SCHEDULE
 *
 * Citește lista de meciuri zilnice și generează programul de verificări
 * Adaugă 53 de minute la fiecare oră de start (după pauză)
 */

const fs = require('fs');
const path = require('path');

/**
 * Formatează timestamp în format HH:MM
 */
function formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * Formatează data în format DD.MM.YYYY
 */
function formatDate(date = new Date()) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

/**
 * Adaugă minute la un timestamp
 */
function addMinutes(timestamp, minutes) {
    return timestamp + (minutes * 60);
}

/**
 * Generează program de verificări din fișierul de meciuri
 */
function generateCheckSchedule(matchesFile) {
    console.log(`\n📅 GENERARE PROGRAM VERIFICĂRI - ${formatDate()}\n`);

    // Citește fișierul cu meciuri
    if (!fs.existsSync(matchesFile)) {
        console.error(`❌ Fișierul nu există: ${matchesFile}`);
        return null;
    }

    const matchesData = JSON.parse(fs.readFileSync(matchesFile, 'utf8'));

    if (!matchesData.meciuri || matchesData.meciuri.length === 0) {
        console.log('⚠️  Nu sunt meciuri de verificat.');

        const output = {
            data: matchesData.data,
            generatedAt: `${formatDate()} ${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}:${new Date().getSeconds().toString().padStart(2, '0')}`,
            mesaj: 'Nu sunt verificări programate pentru astăzi.',
            verificari: []
        };

        return output;
    }

    console.log(`📊 Meciuri de procesat: ${matchesData.meciuri.length}`);

    // Generează lista de verificări
    const verificari = [];

    for (const meci of matchesData.meciuri) {
        // Skip meciurile deja terminate
        if (meci.finished) {
            console.log(`   ⏭️  Skip (terminat): ${meci.homeTeam} vs ${meci.awayTeam}`);
            continue;
        }

        // Calculează timestamp verificare (start + 53 minute = DUPĂ PAUZĂ)
        const checkTimestamp = addMinutes(meci.timestamp, 53);
        const checkDate = new Date(checkTimestamp * 1000);

        // Verifică dacă ora de verificare este în trecut
        const now = Date.now() / 1000;
        if (checkTimestamp < now) {
            console.log(`   ⏭️  Skip (verificare în trecut): ${meci.homeTeam} vs ${meci.awayTeam}`);
            continue;
        }

        verificari.push({
            matchId: meci.matchId,
            homeTeam: meci.homeTeam,
            awayTeam: meci.awayTeam,
            liga: meci.liga,
            oraStart: meci.ora,
            timestampStart: meci.timestamp,
            oraVerificare: formatTime(checkTimestamp),
            timestampVerificare: checkTimestamp,
            minutMeci: 53,
            status: 'programat'
        });

        console.log(`   ✅ ${meci.homeTeam} vs ${meci.awayTeam}`);
        console.log(`      Start: ${meci.ora} | Verificare: ${formatTime(checkTimestamp)} (min 53 - DUPĂ PAUZĂ)`);
    }

    // Sortează verificările după ora de verificare
    verificari.sort((a, b) => a.timestampVerificare - b.timestampVerificare);

    // STAGGERING: Decalează meciurile simultane pentru a nu supraîncărca sistemul
    // Dacă mai multe meciuri au aceeași oră de verificare (±2 min), le distribuie
    // Primul rămâne fix, restul se decalează: -2min, -1min, +1min, +2min
    const staggerOffsets = [0, -2, -1, 1, 2]; // ordinea decalajelor (minute)
    let staggered = 0;

    for (let i = 0; i < verificari.length; i++) {
        // Găsește grupul de meciuri simultane (cu același timestamp ±30s)
        const group = [i];
        while (i + 1 < verificari.length &&
               Math.abs(verificari[i + 1].timestampVerificare - verificari[group[0]].timestampVerificare) <= 30) {
            group.push(++i);
        }

        if (group.length > 1) {
            console.log(`   ⏱️  Staggering: ${group.length} meciuri simultane la ${verificari[group[0]].oraVerificare}`);
            for (let j = 0; j < group.length; j++) {
                const offset = staggerOffsets[j % staggerOffsets.length];
                if (offset !== 0) {
                    const v = verificari[group[j]];
                    v.timestampVerificare += offset * 60;
                    v.oraVerificare = formatTime(v.timestampVerificare);
                    v.minutMeci = 53 + offset;
                    v.staggerOffset = offset;
                    staggered++;
                    console.log(`      ${offset > 0 ? '+' : ''}${offset}min → ${v.oraVerificare} - ${v.homeTeam} vs ${v.awayTeam}`);
                }
            }
        }
    }

    // Re-sortează după staggering
    verificari.sort((a, b) => a.timestampVerificare - b.timestampVerificare);

    if (staggered > 0) {
        console.log(`   ✅ ${staggered} meciuri decalate pentru optimizare resurse`);
    }

    console.log(`\n📊 Total verificări programate: ${verificari.length}`);

    // Generează structura JSON
    const output = {
        data: matchesData.data,
        generatedAt: `${formatDate()} ${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}:${new Date().getSeconds().toString().padStart(2, '0')}`,
        timezone: 'Europe/Bucharest (EET)',
        totalVerificari: verificari.length,
        minutVerificare: 53,
        verificari: verificari
    };

    return output;
}

/**
 * Main function
 */
function main() {
    const args = process.argv.slice(2);

    // Determină fișierul input
    let matchesFile;
    if (args.length > 0) {
        matchesFile = args[0];
    } else {
        // Folosește fișierul pentru data curentă
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        matchesFile = path.join(__dirname, `meciuri-${year}-${month}-${day}.json`);
    }

    console.log(`📂 Input: ${path.basename(matchesFile)}`);

    // Generează program
    const schedule = generateCheckSchedule(matchesFile);

    if (!schedule) {
        process.exit(1);
    }

    // Salvează output
    const outputFile = matchesFile.replace('meciuri-', 'verificari-');
    fs.writeFileSync(outputFile, JSON.stringify(schedule, null, 2), 'utf8');

    console.log(`\n💾 Salvat: ${path.basename(outputFile)}`);
    console.log(`   Calea completă: ${outputFile}\n`);

    // Afișează rezumat
    if (schedule.verificari.length > 0) {
        console.log('🕐 PROGRAM VERIFICĂRI:\n');
        schedule.verificari.forEach((v, idx) => {
            console.log(`${idx + 1}. ${v.oraVerificare} - ${v.homeTeam} vs ${v.awayTeam}`);
            console.log(`   Liga: ${v.liga}`);
            console.log(`   Match ID: ${v.matchId}`);
            console.log('');
        });
    }

    return schedule;
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    generateCheckSchedule,
    addMinutes,
    formatTime
};
