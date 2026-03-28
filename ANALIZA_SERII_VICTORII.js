/**
 * ANALIZA_SERII_VICTORII
 *
 * Analizează pe cele 22 campionate complete:
 * Dacă o echipă a câștigat 3 meciuri la rând, cât de des a câștigat și al 4-lea?
 *
 * IMPORTANT: Meciurile sunt sortate cronologic (dată + oră) per echipă.
 */

const fs = require('fs');
const path = require('path');

const SEASONS_DIR = path.join(__dirname, 'data', 'seasons');

// Cele 22 campionate complete
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

function getMatchDate(meci) {
    if (!meci.data_ora) return '9999-99-99 99:99';
    const d = meci.data_ora.data || '9999-99-99';
    const h = meci.data_ora.ora || '00:00';
    return `${d} ${h}`;
}

function analyzeLeague(leaguePattern) {
    // Găsește toate fișierele sezonului
    const files = fs.readdirSync(SEASONS_DIR)
        .filter(f => f.includes(leaguePattern) && f.endsWith('.json') &&
            !f.includes('BACKUP') && !f.includes('OLD_FORMAT') && !f.includes('pre-'))
        .sort();

    let allMatches = [];
    let leagueName = leaguePattern;

    for (const f of files) {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8'));
            if (data.campionat && data.campionat.nume_complet) {
                leagueName = data.campionat.nume_complet;
            }
            const meciuri = data.meciuri || [];
            // Adaugă sezonul la fiecare meci pentru context
            for (const m of meciuri) {
                m._sezon = data.campionat ? data.campionat.sezon : f;
                m._file = f;
            }
            allMatches = allMatches.concat(meciuri);
        } catch (e) {
            // skip
        }
    }

    // Colectează toate echipele
    const teams = new Set();
    for (const m of allMatches) {
        if (m.echipa_gazda && m.echipa_gazda.nume) teams.add(m.echipa_gazda.nume);
        if (m.echipa_oaspete && m.echipa_oaspete.nume) teams.add(m.echipa_oaspete.nume);
    }

    let totalStreaks = 0;    // Câte serii de 3 victorii consecutive am găsit
    let wonFourth = 0;       // Din ele, câte au continuat cu victorie pe al 4-lea

    for (const team of teams) {
        // Filtrează meciurile echipei și sortează CRONOLOGIC
        const teamMatches = allMatches
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
            if (r) results.push({ result: r, match: m });
        }

        // Caută serii de 3 victorii consecutive și verifică al 4-lea
        for (let i = 0; i <= results.length - 4; i++) {
            if (results[i].result === 'W' &&
                results[i + 1].result === 'W' &&
                results[i + 2].result === 'W') {
                totalStreaks++;
                if (results[i + 3].result === 'W') {
                    wonFourth++;
                }
            }
        }
    }

    return { leagueName, leaguePattern, totalStreaks, wonFourth, files: files.length };
}

// ==================== MAIN ====================
console.log('='.repeat(80));
console.log('ANALIZĂ: Echipă cu 3 victorii la rând → câștigă și al 4-lea meci?');
console.log('Campionate complete: 22 | Sezoane: 3-4 per campionat');
console.log('='.repeat(80));
console.log('');

let grandTotal = 0;
let grandWon = 0;
const results = [];

for (const league of COMPLETE_LEAGUES) {
    const r = analyzeLeague(league);
    results.push(r);
    grandTotal += r.totalStreaks;
    grandWon += r.wonFourth;

    const rate = r.totalStreaks > 0 ? ((r.wonFourth / r.totalStreaks) * 100).toFixed(1) : 'N/A';
    const lost = r.totalStreaks - r.wonFourth;
    console.log(`${r.leagueName.padEnd(45)} | Serii 3W: ${String(r.totalStreaks).padStart(4)} | 4th Win: ${String(r.wonFourth).padStart(4)} | 4th Loss/Draw: ${String(lost).padStart(4)} | Rata: ${rate}%`);
}

console.log('');
console.log('='.repeat(80));
const grandRate = grandTotal > 0 ? ((grandWon / grandTotal) * 100).toFixed(1) : 'N/A';
console.log(`TOTAL GLOBAL:  Serii de 3 victorii: ${grandTotal} | Al 4-lea câștigat: ${grandWon} (${grandRate}%) | Al 4-lea pierdut/egal: ${grandTotal - grandWon}`);
console.log('='.repeat(80));

// Sortare descrescătoare după rată
console.log('\n📊 CLASAMENT după rata de succes (descrescător):');
console.log('-'.repeat(80));
const sorted = results
    .filter(r => r.totalStreaks > 0)
    .sort((a, b) => (b.wonFourth / b.totalStreaks) - (a.wonFourth / a.totalStreaks));

for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const rate = ((r.wonFourth / r.totalStreaks) * 100).toFixed(1);
    console.log(`${String(i + 1).padStart(2)}. ${r.leagueName.padEnd(45)} ${rate}%  (${r.wonFourth}/${r.totalStreaks})`);
}
