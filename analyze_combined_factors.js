#!/usr/bin/env node
/**
 * Analiză pattern-uri complexe - combinații de factori
 * pentru meciuri FĂRĂ gol R2 (anomalii)
 */

const fs = require('fs');
const glob = require('glob');
const path = require('path');

console.log('\n🔍 ANALIZĂ PATTERN-URI COMPLEXE - Combinații Factori\n');
console.log('='.repeat(80));

const seasonFiles = glob.sync(path.join(__dirname, 'data', 'seasons', 'complete_FULL_SEASON_*.json'))
    .filter(f => !f.includes('BACKUP'));

let faraGolR2 = [];
let cuGolR2 = [];

seasonFiles.forEach(file => {
    try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        const matches = data.meciuri || [];

        matches.forEach(match => {
            const scorPauzaG = match.scor?.pauza_gazda || 0;
            const scorPauzaO = match.scor?.pauza_oaspete || 0;
            const scorFinalG = match.scor?.final_gazda || 0;
            const scorFinalO = match.scor?.final_oaspete || 0;

            const golR2 = (scorFinalG > scorPauzaG) || (scorFinalO > scorPauzaO);

            const matchData = {
                campionat: data.campionat?.nume_complet || data.campionat?.nume || 'Unknown',
                sezon: data.sezon || match.sezon,
                data: match.data_ora?.data,
                ora: match.data_ora?.ora,
                zi: match.data_ora?.zi_saptamana,
                scorPauza: `${scorPauzaG}-${scorPauzaO}`,
                scorFinal: `${scorFinalG}-${scorFinalO}`,
                scorPauzaG,
                scorPauzaO,
                tier_gazda: match.tier_gazda,
                tier_oaspete: match.tier_oaspete,
                cornere_pauza: (match.statistici?.cornere?.pauza_gazda || 0) + (match.statistici?.cornere?.pauza_oaspete || 0),
                suturi_pauza: (match.statistici?.suturi_pe_poarta?.pauza_gazda || 0) + (match.statistici?.suturi_pe_poarta?.pauza_oaspete || 0),
            };

            if (golR2) {
                cuGolR2.push(matchData);
            } else {
                faraGolR2.push(matchData);
            }
        });
    } catch (error) {
        // Skip
    }
});

console.log(`\n📊 Total: ${faraGolR2.length + cuGolR2.length} meciuri`);
console.log(`   ❌ Fără gol R2: ${faraGolR2.length}`);
console.log(`   ✅ Cu gol R2: ${cuGolR2.length}\n`);
console.log('='.repeat(80));

// ANALIZĂ 1: ORA + CAMPIONAT
console.log('\n🔍 COMBINAȚIE 1: ORA 18:00 + CAMPIONATE specifice\n');

const ora18Fara = faraGolR2.filter(m => m.ora && m.ora.startsWith('18:'));
const campOra18 = {};

ora18Fara.forEach(m => {
    campOra18[m.campionat] = (campOra18[m.campionat] || 0) + 1;
});

console.log('TOP campionate la ora 18:00 (fără gol R2):');
Object.entries(campOra18)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([camp, count], idx) => {
        console.log(`  ${(idx + 1).toString().padStart(2)}. ${camp.substring(0, 50).padEnd(52)} ${count} meciuri`);
    });

// ANALIZĂ 2: SCOR la PAUZĂ patterns
console.log('\n\n🔍 COMBINAȚIE 2: SCOR la PAUZĂ (meciuri fără gol R2)\n');

const scoruriPauza = {};
faraGolR2.forEach(m => {
    scoruriPauza[m.scorPauza] = (scoruriPauza[m.scorPauza] || 0) + 1;
});

console.log('TOP scoruri la pauză (fără gol R2):');
Object.entries(scoruriPauza)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([scor, count], idx) => {
        const pct = ((count / faraGolR2.length) * 100).toFixed(1);
        console.log(`  ${(idx + 1).toString().padStart(2)}. ${scor.padEnd(8)} ${count.toString().padStart(4)} meciuri (${pct}%)`);
    });

// ANALIZĂ 3: Meciuri cu MULTE goluri la pauză (dominate)
console.log('\n\n🔍 COMBINAȚIE 3: Meciuri DOMINATE la pauză (3+ goluri)\n');

const multiGoluriPauza = faraGolR2.filter(m => {
    const totalPauza = m.scorPauzaG + m.scorPauzaO;
    return totalPauza >= 3;
});

console.log(`Meciuri cu 3+ goluri la pauză (fără gol R2): ${multiGoluriPauza.length}`);
console.log(`Procent din total fără gol R2: ${((multiGoluriPauza.length / faraGolR2.length) * 100).toFixed(1)}%\n`);

const scoruriDominate = {};
multiGoluriPauza.forEach(m => {
    scoruriDominate[m.scorPauza] = (scoruriDominate[m.scorPauza] || 0) + 1;
});

console.log('Scoruri frecvente (3+ goluri la pauză):');
Object.entries(scoruriDominate)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([scor, count], idx) => {
        console.log(`  ${(idx + 1).toString().padStart(2)}. ${scor.padEnd(8)} ${count} meciuri`);
    });

// ANALIZĂ 4: Meciuri BLOCATE (0-0 la pauză)
console.log('\n\n🔍 COMBINAȚIE 4: Meciuri BLOCATE (0-0 la pauză)\n');

const meciBlocate = faraGolR2.filter(m => m.scorPauza === '0-0');

console.log(`Meciuri 0-0 la pauză (fără gol R2): ${meciBlocate.length}`);
console.log(`Procent din total fără gol R2: ${((meciBlocate.length / faraGolR2.length) * 100).toFixed(1)}%\n`);

const campBlocate = {};
meciBlocate.forEach(m => {
    campBlocate[m.campionat] = (campBlocate[m.campionat] || 0) + 1;
});

console.log('TOP campionate cu meciuri blocate (0-0):');
Object.entries(campBlocate)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([camp, count], idx) => {
        console.log(`  ${(idx + 1).toString().padStart(2)}. ${camp.substring(0, 50).padEnd(52)} ${count} meciuri`);
    });

// ANALIZĂ 5: ORA + ZI combinație
console.log('\n\n🔍 COMBINAȚIE 5: ORA + ZI (pattern-uri temporale)\n');

const oraZi = {};
faraGolR2.forEach(m => {
    if (!m.ora || !m.zi) return;
    const ora = m.ora.split(':')[0];
    const key = `${m.zi} ${ora}:00`;
    oraZi[key] = (oraZi[key] || 0) + 1;
});

console.log('TOP combinații ORA + ZI (fără gol R2):');
Object.entries(oraZi)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([combo, count], idx) => {
        console.log(`  ${(idx + 1).toString().padStart(2)}. ${combo.padEnd(20)} ${count} meciuri`);
    });

// ANALIZĂ 6: NORWAY în detaliu
console.log('\n\n🔍 COMBINAȚIE 6: NORWAY - Analiză detaliată\n');

const norwayFara = faraGolR2.filter(m => m.campionat.includes('NORWAY'));
const norwayCu = cuGolR2.filter(m => m.campionat.includes('NORWAY'));

console.log(`NORWAY meciuri fără gol R2: ${norwayFara.length}`);
console.log(`NORWAY meciuri cu gol R2: ${norwayCu.length}`);
console.log(`Procent FĂRĂ gol: ${((norwayFara.length / (norwayFara.length + norwayCu.length)) * 100).toFixed(1)}%\n`);

const norwayOre = {};
norwayFara.forEach(m => {
    if (!m.ora) return;
    const ora = m.ora.split(':')[0];
    norwayOre[ora] = (norwayOre[ora] || 0) + 1;
});

console.log('ORE meciuri NORWAY (fără gol R2):');
Object.entries(norwayOre)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([ora, count], idx) => {
        console.log(`  ${(idx + 1).toString().padStart(2)}. Ora ${ora}:00 → ${count} meciuri`);
    });

const norwayScoruri = {};
norwayFara.forEach(m => {
    norwayScoruri[m.scorPauza] = (norwayScoruri[m.scorPauza] || 0) + 1;
});

console.log('\nScoruri pauză NORWAY (fără gol R2):');
Object.entries(norwayScoruri)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([scor, count], idx) => {
        console.log(`  ${(idx + 1).toString().padStart(2)}. ${scor.padEnd(8)} ${count} meciuri`);
    });

// CONCLUZII
console.log('\n' + '='.repeat(80));
console.log('\n💡 CONCLUZII PATTERN-URI COMPLEXE:\n');

const top3Scoruri = Object.entries(scoruriPauza)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

console.log('1. SCORURI la PAUZĂ riscante:');
top3Scoruri.forEach(([scor, count], idx) => {
    const pct = ((count / faraGolR2.length) * 100).toFixed(1);
    console.log(`   ${idx + 1}. ${scor} → ${pct}% din anomalii`);
});

const pctBlocate = ((meciBlocate.length / faraGolR2.length) * 100).toFixed(1);
const pctDominate = ((multiGoluriPauza.length / faraGolR2.length) * 100).toFixed(1);

console.log(`\n2. CATEGORII meciuri problematice:`);
console.log(`   - Meciuri BLOCATE (0-0): ${pctBlocate}%`);
console.log(`   - Meciuri DOMINATE (3+ goluri): ${pctDominate}%`);

console.log(`\n3. NORWAY pattern:`);
console.log(`   - ${norwayFara.length} meciuri fără gol R2`);
console.log(`   - Risc: ${((norwayFara.length / (norwayFara.length + norwayCu.length)) * 100).toFixed(1)}%`);
console.log(`   - EVIT complet sugestii pentru NORWAY!`);

console.log('\n✅ Analiză completă!\n');
