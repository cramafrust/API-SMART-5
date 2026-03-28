/**
 * ANALIZA_SERII_VICTORII - TOP 50% clasament (clasament calculat din meciuri)
 *
 * Calculează clasamentul pe baza meciurilor jucate ÎNAINTE de seria de victorii.
 * Nu depinde de pozitie_clasament_inainte (care lipsește la multe meciuri vechi).
 *
 * Per sezon, per campionat:
 * 1. Sortează meciurile cronologic
 * 2. La fiecare meci, recalculează clasamentul
 * 3. Când o echipă are 3W la rând, verifică dacă e în top 50% la acel moment
 * 4. Dacă da, verifică al 4-lea meci
 */

const fs = require('fs');
const path = require('path');

const SEASONS_DIR = path.join(__dirname, 'data', 'seasons');

const COMPLETE_LEAGUES = [
    'PremierLeague', 'LaLiga', 'SerieA', 'Bundesliga', 'Ligue1',
    'Eredivisie', 'ENGLANDChampionship', 'GERMANY2Bundesliga',
    'PrimeiraLiga', 'TURKEYSuperLig', 'ROMANIASuperliga',
    'POLANDEkstraklasa', 'GREECESuperLeague', 'SWITZERLANDSuperLeague',
    'AUSTRIABundesliga', 'SERBIAMozzartBetSuperLiga', 'SCOTLANDPremiership',
    'ChampionsLeague', 'NORWAYEliteserien', 'SWEDENAllsvenskan',
    'BRAZILSerieA', 'BELGIUMJupilerProLeague'
];

function getMatchDate(meci) {
    if (!meci.data_ora) return '9999-99-99 99:99';
    const d = meci.data_ora.data || '9999-99-99';
    const h = meci.data_ora.ora || '00:00';
    return `${d} ${h}`;
}

function analyzeSeason(data) {
    const meciuri = (data.meciuri || []).filter(m =>
        m.scor && m.scor.final_gazda != null && m.scor.final_oaspete != null &&
        m.echipa_gazda && m.echipa_gazda.nume &&
        m.echipa_oaspete && m.echipa_oaspete.nume
    );

    // Sortează TOATE meciurile cronologic
    meciuri.sort((a, b) => getMatchDate(a).localeCompare(getMatchDate(b)));

    // Colectează toate echipele
    const allTeams = new Set();
    for (const m of meciuri) {
        allTeams.add(m.echipa_gazda.nume);
        allTeams.add(m.echipa_oaspete.nume);
    }
    const totalTeams = allTeams.size;
    const halfPos = Math.ceil(totalTeams / 2);

    // Clasament live (puncte, golaveraj)
    const standings = {};
    for (const t of allTeams) {
        standings[t] = { pts: 0, gf: 0, ga: 0, played: 0 };
    }

    // Istoricul meciurilor per echipă (pentru a detecta serii)
    const teamHistory = {};
    for (const t of allTeams) {
        teamHistory[t] = [];
    }

    let totalStreaks = 0;
    let wonFourth = 0;

    // Procesează meciurile în ordine cronologică
    for (const m of meciuri) {
        const home = m.echipa_gazda.nume;
        const away = m.echipa_oaspete.nume;
        const hg = m.scor.final_gazda;
        const ag = m.scor.final_oaspete;

        // Determină rezultatul
        let homeResult, awayResult;
        if (hg > ag) { homeResult = 'W'; awayResult = 'L'; }
        else if (hg < ag) { homeResult = 'L'; awayResult = 'W'; }
        else { homeResult = 'D'; awayResult = 'D'; }

        // ÎNAINTE de a înregistra meciul, verifică dacă echipa tocmai a completat o serie de 3W
        // și verifică dacă meciul CURENT (al 4-lea) e victorie
        for (const [team, result] of [[home, homeResult], [away, awayResult]]) {
            const hist = teamHistory[team];
            if (hist.length >= 3) {
                const last3 = hist.slice(-3);
                if (last3[0] === 'W' && last3[1] === 'W' && last3[2] === 'W') {
                    // Echipa are 3W la rând! Verifică poziția ÎN CLASAMENT ACUM
                    const pos = getPosition(standings, team, allTeams);
                    if (pos <= halfPos) {
                        totalStreaks++;
                        if (result === 'W') wonFourth++;
                    }
                }
            }
        }

        // Actualizează istoricul
        teamHistory[home].push(homeResult);
        teamHistory[away].push(awayResult);

        // Actualizează clasamentul
        standings[home].played++;
        standings[away].played++;
        standings[home].gf += hg;
        standings[home].ga += ag;
        standings[away].gf += ag;
        standings[away].ga += hg;

        if (hg > ag) {
            standings[home].pts += 3;
        } else if (hg < ag) {
            standings[away].pts += 3;
        } else {
            standings[home].pts += 1;
            standings[away].pts += 1;
        }
    }

    return { totalStreaks, wonFourth, totalTeams, halfPos, totalMatches: meciuri.length };
}

function getPosition(standings, team, allTeams) {
    // Sortează echipele: puncte desc, golaveraj desc, goluri marcate desc
    const sorted = [...allTeams].sort((a, b) => {
        const sa = standings[a], sb = standings[b];
        if (sb.pts !== sa.pts) return sb.pts - sa.pts;
        const gdA = sa.gf - sa.ga, gdB = sb.gf - sb.ga;
        if (gdB !== gdA) return gdB - gdA;
        return sb.gf - sa.gf;
    });
    return sorted.indexOf(team) + 1;
}

function analyzeLeague(leaguePattern) {
    const files = fs.readdirSync(SEASONS_DIR)
        .filter(f => f.includes(leaguePattern) && f.endsWith('.json') &&
            !f.includes('BACKUP') && !f.includes('OLD_FORMAT') && !f.includes('pre-'))
        .sort();

    let leagueName = leaguePattern;
    let totalStreaks = 0;
    let wonFourth = 0;
    let seasonDetails = [];

    for (const f of files) {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8'));
            if (data.campionat && data.campionat.nume_complet) {
                leagueName = data.campionat.nume_complet;
            }
            const sezon = data.campionat ? data.campionat.sezon : f;
            const r = analyzeSeason(data);

            // Ignoră sezoane cu prea puține meciuri
            if (r.totalMatches < 50) continue;

            totalStreaks += r.totalStreaks;
            wonFourth += r.wonFourth;
            seasonDetails.push({ sezon, file: f, ...r });
        } catch (e) {
            // skip
        }
    }

    return { leagueName, leaguePattern, totalStreaks, wonFourth, files: files.length, seasonDetails };
}

// ==================== MAIN ====================
console.log('='.repeat(95));
console.log('ANALIZĂ: Echipă din TOP 50% clasament cu 3 victorii la rând → câștigă al 4-lea?');
console.log('Clasament CALCULAT din meciuri (nu depinde de pozitie_clasament_inainte)');
console.log('Doar sezoane cu 50+ meciuri');
console.log('='.repeat(95));
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
    console.log(`${r.leagueName.padEnd(45)} | 3W serii: ${String(r.totalStreaks).padStart(4)} | 4th W: ${String(r.wonFourth).padStart(4)} | 4th L/D: ${String(lost).padStart(4)} | Rata: ${String(rate).padStart(5)}%`);
}

console.log('');
console.log('='.repeat(95));
const grandRate = grandTotal > 0 ? ((grandWon / grandTotal) * 100).toFixed(1) : 'N/A';
console.log(`TOTAL GLOBAL (top 50%):  Serii 3W: ${grandTotal} | Al 4-lea W: ${grandWon} (${grandRate}%) | Al 4-lea L/D: ${grandTotal - grandWon}`);
console.log('='.repeat(95));

// Clasament
console.log('\n📊 CLASAMENT după rata de succes (min 10 cazuri):');
console.log('-'.repeat(95));
const sorted = results
    .filter(r => r.totalStreaks >= 10)
    .sort((a, b) => (b.wonFourth / b.totalStreaks) - (a.wonFourth / a.totalStreaks));

for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const rate = ((r.wonFourth / r.totalStreaks) * 100).toFixed(1);
    console.log(`${String(i + 1).padStart(2)}. ${r.leagueName.padEnd(45)} ${rate}%  (${r.wonFourth}/${r.totalStreaks})`);
}

// Detalii per sezon
console.log('\n\n📋 DETALII PER SEZON:');
console.log('-'.repeat(95));
for (const r of results) {
    if (r.seasonDetails.length === 0) continue;
    console.log(`\n${r.leagueName}:`);
    for (const s of r.seasonDetails) {
        const rate = s.totalStreaks > 0 ? ((s.wonFourth / s.totalStreaks) * 100).toFixed(1) : 'N/A';
        console.log(`   ${s.sezon.padEnd(15)} | ${String(s.totalTeams).padStart(2)} echipe | Top ${String(s.halfPos).padStart(2)} | Meciuri: ${String(s.totalMatches).padStart(4)} | 3W: ${String(s.totalStreaks).padStart(3)} | 4th W: ${String(s.wonFourth).padStart(3)} | Rata: ${rate}%`);
    }
}
