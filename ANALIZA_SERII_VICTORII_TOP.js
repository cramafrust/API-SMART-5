/**
 * ANALIZA_SERII_VICTORII - doar echipe din PRIMA JUMĂTATE a clasamentului
 *
 * Analizează pe cele 22 campionate complete:
 * Dacă o echipă din top 50% clasament a câștigat 3 meciuri la rând,
 * cât de des a câștigat și al 4-lea?
 *
 * Folosește pozitie_clasament_inainte din datele meciului.
 * Verifică poziția la momentul seriei (al 3-lea meci din serie).
 *
 * IMPORTANT: Meciurile sunt sortate cronologic per echipă, per sezon.
 */

const fs = require('fs');
const path = require('path');

const SEASONS_DIR = path.join(__dirname, 'data', 'seasons');

// Cele 22 campionate complete (fără Champions League - nu are clasament tradițional)
const COMPLETE_LEAGUES = [
    'PremierLeague',
    'LaLiga',
    'SerieA',
    'Bundesliga',
    'Ligue1',
    'Eredivisie',
    'ENGLANDChampionship',
    'GERMANY2Bundesliga',
    'PrimeiraLiga',
    'TURKEYSuperLig',
    'ROMANIASuperliga',
    'POLANDEkstraklasa',
    'GREECESuperLeague',
    'SWITZERLANDSuperLeague',
    'AUSTRIABundesliga',
    'SERBIAMozzartBetSuperLiga',
    'SCOTLANDPremiership',
    'ChampionsLeague',
    'NORWAYEliteserien',
    'SWEDENAllsvenskan',
    'BRAZILSerieA',
    'BELGIUMJupilerProLeague'
];

function getMatchResult(meci, teamName) {
    if (!meci.scor || meci.scor.final_gazda == null || meci.scor.final_oaspete == null) return null;

    const isHome = meci.echipa_gazda.nume === teamName || meci.echipa_gazda.nume_complet === teamName;
    const isAway = meci.echipa_oaspete.nume === teamName || meci.echipa_oaspete.nume_complet === teamName;

    if (!isHome && !isAway) return null;

    const goalsFor = isHome ? meci.scor.final_gazda : meci.scor.final_oaspete;
    const goalsAgainst = isHome ? meci.scor.final_oaspete : meci.scor.final_gazda;

    if (goalsFor > goalsAgainst) return 'W';
    if (goalsFor < goalsAgainst) return 'L';
    return 'D';
}

function getTeamPosition(meci, teamName) {
    const isHome = meci.echipa_gazda && (meci.echipa_gazda.nume === teamName || meci.echipa_gazda.nume_complet === teamName);
    if (isHome) return meci.echipa_gazda.pozitie_clasament_inainte;
    const isAway = meci.echipa_oaspete && (meci.echipa_oaspete.nume === teamName || meci.echipa_oaspete.nume_complet === teamName);
    if (isAway) return meci.echipa_oaspete.pozitie_clasament_inainte;
    return null;
}

function getMatchDate(meci) {
    if (!meci.data_ora) return '9999-99-99 99:99';
    const d = meci.data_ora.data || '9999-99-99';
    const h = meci.data_ora.ora || '00:00';
    return `${d} ${h}`;
}

function analyzeSeason(data, fileName) {
    const meciuri = data.meciuri || [];
    const numTeams = data.campionat ? data.campionat.numar_echipe : null;

    // Determină numărul de echipe din meciuri dacă nu e specificat
    const allTeams = new Set();
    for (const m of meciuri) {
        if (m.echipa_gazda && m.echipa_gazda.nume) allTeams.add(m.echipa_gazda.nume);
        if (m.echipa_oaspete && m.echipa_oaspete.nume) allTeams.add(m.echipa_oaspete.nume);
    }
    const totalTeams = numTeams || allTeams.size;
    const halfPos = Math.ceil(totalTeams / 2); // Prima jumătate = poziția 1 până la halfPos

    let totalStreaks = 0;
    let wonFourth = 0;
    let skippedNoPos = 0;

    for (const team of allTeams) {
        // Meciurile echipei, sortate cronologic, DOAR din acest sezon
        const teamMatches = meciuri
            .filter(m => {
                const home = m.echipa_gazda && (m.echipa_gazda.nume === team || m.echipa_gazda.nume_complet === team);
                const away = m.echipa_oaspete && (m.echipa_oaspete.nume === team || m.echipa_oaspete.nume_complet === team);
                return home || away;
            })
            .sort((a, b) => {
                const dateA = getMatchDate(a);
                const dateB = getMatchDate(b);
                return dateA.localeCompare(dateB);
            });

        // Obține rezultatele în ordine cronologică
        const results = [];
        for (const m of teamMatches) {
            const r = getMatchResult(m, team);
            if (r) results.push({ result: r, match: m, team });
        }

        // Caută serii de 3 victorii consecutive și verifică al 4-lea
        for (let i = 0; i <= results.length - 4; i++) {
            if (results[i].result === 'W' &&
                results[i + 1].result === 'W' &&
                results[i + 2].result === 'W') {

                // Verifică poziția echipei la momentul al 3-lea meci din serie
                const pos = getTeamPosition(results[i + 2].match, team);

                if (pos == null) {
                    skippedNoPos++;
                    continue;
                }

                // Doar echipe din prima jumătate a clasamentului
                if (pos > halfPos) continue;

                totalStreaks++;
                if (results[i + 3].result === 'W') {
                    wonFourth++;
                }
            }
        }
    }

    return { totalStreaks, wonFourth, totalTeams, halfPos, skippedNoPos };
}

function analyzeLeague(leaguePattern) {
    const files = fs.readdirSync(SEASONS_DIR)
        .filter(f => f.includes(leaguePattern) && f.endsWith('.json') &&
            !f.includes('BACKUP') && !f.includes('OLD_FORMAT') && !f.includes('pre-'))
        .sort();

    let leagueName = leaguePattern;
    let totalStreaks = 0;
    let wonFourth = 0;
    let skippedNoPos = 0;
    let seasonDetails = [];

    for (const f of files) {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8'));
            if (data.campionat && data.campionat.nume_complet) {
                leagueName = data.campionat.nume_complet;
            }
            const sezon = data.campionat ? data.campionat.sezon : f;
            const r = analyzeSeason(data, f);
            totalStreaks += r.totalStreaks;
            wonFourth += r.wonFourth;
            skippedNoPos += r.skippedNoPos;
            seasonDetails.push({
                sezon,
                file: f,
                ...r
            });
        } catch (e) {
            // skip
        }
    }

    return { leagueName, leaguePattern, totalStreaks, wonFourth, skippedNoPos, files: files.length, seasonDetails };
}

// ==================== MAIN ====================
console.log('='.repeat(90));
console.log('ANALIZĂ: Echipă din TOP 50% clasament cu 3 victorii la rând → câștigă al 4-lea?');
console.log('Campionate: 22 | Doar echipe din prima jumătate a clasamentului');
console.log('Poziția verificată la momentul al 3-lea meci din serie');
console.log('='.repeat(90));
console.log('');

let grandTotal = 0;
let grandWon = 0;
let grandSkipped = 0;
const results = [];

for (const league of COMPLETE_LEAGUES) {
    const r = analyzeLeague(league);
    results.push(r);
    grandTotal += r.totalStreaks;
    grandWon += r.wonFourth;
    grandSkipped += r.skippedNoPos;

    const rate = r.totalStreaks > 0 ? ((r.wonFourth / r.totalStreaks) * 100).toFixed(1) : 'N/A';
    const lost = r.totalStreaks - r.wonFourth;
    console.log(`${r.leagueName.padEnd(45)} | 3W serii: ${String(r.totalStreaks).padStart(4)} | 4th W: ${String(r.wonFourth).padStart(4)} | 4th L/D: ${String(lost).padStart(4)} | Rata: ${String(rate).padStart(5)}% | Skip(no pos): ${r.skippedNoPos}`);
}

console.log('');
console.log('='.repeat(90));
const grandRate = grandTotal > 0 ? ((grandWon / grandTotal) * 100).toFixed(1) : 'N/A';
console.log(`TOTAL GLOBAL:  Serii 3W (top 50%): ${grandTotal} | Al 4-lea W: ${grandWon} (${grandRate}%) | Al 4-lea L/D: ${grandTotal - grandWon} | Skipped(no pos): ${grandSkipped}`);
console.log('='.repeat(90));

// Clasament
console.log('\n📊 CLASAMENT după rata de succes (descrescător):');
console.log('-'.repeat(90));
const sorted = results
    .filter(r => r.totalStreaks >= 5) // minim 5 cazuri pentru relevanță
    .sort((a, b) => (b.wonFourth / b.totalStreaks) - (a.wonFourth / a.totalStreaks));

for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const rate = ((r.wonFourth / r.totalStreaks) * 100).toFixed(1);
    console.log(`${String(i + 1).padStart(2)}. ${r.leagueName.padEnd(45)} ${rate}%  (${r.wonFourth}/${r.totalStreaks})`);
}

// Detalii per sezon
console.log('\n\n📋 DETALII PER SEZON:');
console.log('-'.repeat(90));
for (const r of results) {
    if (r.seasonDetails.length === 0) continue;
    console.log(`\n${r.leagueName} (${r.files} sezoane):`);
    for (const s of r.seasonDetails) {
        const rate = s.totalStreaks > 0 ? ((s.wonFourth / s.totalStreaks) * 100).toFixed(1) : 'N/A';
        console.log(`   ${s.sezon.padEnd(15)} | Echipe: ${String(s.totalTeams).padStart(2)} | Top ${s.halfPos} | 3W serii: ${String(s.totalStreaks).padStart(3)} | 4th W: ${String(s.wonFourth).padStart(3)} | Rata: ${rate}%${s.skippedNoPos > 0 ? ` | ⚠️ ${s.skippedNoPos} fără poziție` : ''}`);
    }
}
