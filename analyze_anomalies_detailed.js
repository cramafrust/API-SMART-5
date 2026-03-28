#!/usr/bin/env node
/**
 * Analizează meciuri colectate și identifică pattern-uri comune
 * la cele cu/fără gol repriza 2
 *
 * Focus: ORE, ZILE, CAMPIONATE, TIER-URI
 */

const fs = require('fs');
const glob = require('glob');
const path = require('path');

console.log('\n🔍 ANALIZĂ DETALIATĂ PATTERN-URI ANOMALII\n');
console.log('='.repeat(80));

// Citim toate meciurile
const seasonFiles = glob.sync(path.join(__dirname, 'data', 'seasons', 'complete_FULL_SEASON_*.json'))
    .filter(f => !f.includes('BACKUP') && !f.includes('ORIGINAL'));

let cuGolR2 = [];
let faraGolR2 = [];
let total = 0;

console.log('\n📊 Procesare meciuri...\n');

seasonFiles.forEach(file => {
    try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        const matches = data.meciuri || [];

        matches.forEach(match => {
            total++;

            const scorPauzaG = match.scor?.pauza_gazda || 0;
            const scorPauzaO = match.scor?.pauza_oaspete || 0;
            const scorFinalG = match.scor?.final_gazda || 0;
            const scorFinalO = match.scor?.final_oaspete || 0;

            // Gol repriza 2?
            const golR2 = (scorFinalG > scorPauzaG) || (scorFinalO > scorPauzaO);

            const matchData = {
                campionat: data.campionat?.nume_complet || data.campionat?.nume || 'Unknown',
                sezon: data.sezon || match.sezon,
                data: match.data_ora?.data,
                ora: match.data_ora?.ora,
                zi: match.data_ora?.zi_saptamana,
                gazda: match.echipa_gazda?.nume,
                oaspete: match.echipa_oaspete?.nume,
                scorPauza: `${scorPauzaG}-${scorPauzaO}`,
                scorFinal: `${scorFinalG}-${scorFinalO}`,
                tier_gazda: match.tier_gazda,
                tier_oaspete: match.tier_oaspete,
                cornere_pauza: (match.statistici?.cornere?.pauza_gazda || 0) + (match.statistici?.cornere?.pauza_oaspete || 0),
                suturi_pauza: (match.statistici?.suturi_pe_poarta?.pauza_gazda || 0) + (match.statistici?.suturi_pe_poarta?.pauza_oaspete || 0),
                cartonase_pauza: (match.statistici?.cartonase_galbene?.pauza_gazda || 0) + (match.statistici?.cartonase_galbene?.pauza_oaspete || 0)
            };

            if (golR2) {
                cuGolR2.push(matchData);
            } else {
                faraGolR2.push(matchData);
            }
        });
    } catch (error) {
        // Skip erori
    }
});

console.log(`Total meciuri: ${total}`);
console.log(`✅ Cu gol R2: ${cuGolR2.length} (${((cuGolR2.length / total) * 100).toFixed(1)}%)`);
console.log(`❌ Fără gol R2: ${faraGolR2.length} (${((faraGolR2.length / total) * 100).toFixed(1)}%)\n`);
console.log('='.repeat(80));

// ANALIZĂ ORE
console.log('\n⏰ ANALIZĂ ORE (meciuri FĂRĂ gol R2):\n');

const oreFaraGol = {};
const oreCuGol = {};

faraGolR2.forEach(m => {
    if (!m.ora) return;
    const ora = parseInt(m.ora.split(':')[0]);
    oreFaraGol[ora] = (oreFaraGol[ora] || 0) + 1;
});

cuGolR2.forEach(m => {
    if (!m.ora) return;
    const ora = parseInt(m.ora.split(':')[0]);
    oreCuGol[ora] = (oreCuGol[ora] || 0) + 1;
});

// Calculăm procent fără gol pentru fiecare oră
const oreStats = [];
for (let ora = 0; ora < 24; ora++) {
    const faraGol = oreFaraGol[ora] || 0;
    const cuGol = oreCuGol[ora] || 0;
    const total = faraGol + cuGol;

    if (total > 10) { // Doar ore cu suficiente date
        const pctFaraGol = ((faraGol / total) * 100).toFixed(1);
        oreStats.push({ ora, faraGol, cuGol, total, pctFaraGol: parseFloat(pctFaraGol) });
    }
}

// Sortăm după procent fără gol (cele mai riscante ore)
oreStats.sort((a, b) => b.pctFaraGol - a.pctFaraGol);

console.log('TOP ORE cu risc mare (% fără gol R2):');
oreStats.slice(0, 10).forEach((stat, idx) => {
    const bar = '█'.repeat(Math.floor(stat.pctFaraGol / 5));
    console.log(`  ${(idx + 1).toString().padStart(2)}. Ora ${stat.ora.toString().padStart(2)}:00 → ${stat.pctFaraGol.toString().padStart(5)}% (${stat.total} meciuri) ${bar}`);
});

// ANALIZĂ ZILE
console.log('\n📅 ANALIZĂ ZILE SĂPTĂMÂNĂ (meciuri FĂRĂ gol R2):\n');

const zileFaraGol = {};
const zileCuGol = {};

faraGolR2.forEach(m => {
    if (!m.zi) return;
    zileFaraGol[m.zi] = (zileFaraGol[m.zi] || 0) + 1;
});

cuGolR2.forEach(m => {
    if (!m.zi) return;
    zileCuGol[m.zi] = (zileCuGol[m.zi] || 0) + 1;
});

const zileStats = [];
['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'].forEach(zi => {
    const faraGol = zileFaraGol[zi] || 0;
    const cuGol = zileCuGol[zi] || 0;
    const total = faraGol + cuGol;

    if (total > 0) {
        const pctFaraGol = ((faraGol / total) * 100).toFixed(1);
        zileStats.push({ zi, faraGol, cuGol, total, pctFaraGol: parseFloat(pctFaraGol) });
    }
});

zileStats.sort((a, b) => b.pctFaraGol - a.pctFaraGol);

zileStats.forEach((stat, idx) => {
    const bar = '█'.repeat(Math.floor(stat.pctFaraGol / 3));
    console.log(`  ${(idx + 1).toString().padStart(2)}. ${stat.zi.padEnd(10)} → ${stat.pctFaraGol.toString().padStart(5)}% fără gol (${stat.total} meciuri) ${bar}`);
});

// ANALIZĂ CAMPIONATE
console.log('\n🏆 TOP 15 CAMPIONATE cu risc mare (% fără gol R2):\n');

const campFaraGol = {};
const campCuGol = {};

faraGolR2.forEach(m => {
    campFaraGol[m.campionat] = (campFaraGol[m.campionat] || 0) + 1;
});

cuGolR2.forEach(m => {
    campCuGol[m.campionat] = (campCuGol[m.campionat] || 0) + 1;
});

const campStats = [];
Object.keys({...campFaraGol, ...campCuGol}).forEach(camp => {
    const faraGol = campFaraGol[camp] || 0;
    const cuGol = campCuGol[camp] || 0;
    const total = faraGol + cuGol;

    if (total >= 20) { // Doar campionate cu suficiente date
        const pctFaraGol = ((faraGol / total) * 100).toFixed(1);
        campStats.push({ campionat: camp, faraGol, cuGol, total, pctFaraGol: parseFloat(pctFaraGol) });
    }
});

campStats.sort((a, b) => b.pctFaraGol - a.pctFaraGol);

campStats.slice(0, 15).forEach((stat, idx) => {
    const campShort = stat.campionat.substring(0, 45);
    console.log(`  ${(idx + 1).toString().padStart(2)}. ${campShort.padEnd(47)} ${stat.pctFaraGol.toString().padStart(5)}% (${stat.total} meciuri)`);
});

// ANALIZĂ TIER
console.log('\n🎯 ANALIZĂ TIER-URI (meciuri FĂRĂ gol R2):\n');

const tierFaraGol = {};
const tierCuGol = {};

faraGolR2.forEach(m => {
    const tier = `${m.tier_gazda || 'N/A'} vs ${m.tier_oaspete || 'N/A'}`;
    tierFaraGol[tier] = (tierFaraGol[tier] || 0) + 1;
});

cuGolR2.forEach(m => {
    const tier = `${m.tier_gazda || 'N/A'} vs ${m.tier_oaspete || 'N/A'}`;
    tierCuGol[tier] = (tierCuGol[tier] || 0) + 1;
});

const tierStats = [];
Object.keys({...tierFaraGol, ...tierCuGol}).forEach(tier => {
    const faraGol = tierFaraGol[tier] || 0;
    const cuGol = tierCuGol[tier] || 0;
    const total = faraGol + cuGol;

    if (total >= 10) {
        const pctFaraGol = ((faraGol / total) * 100).toFixed(1);
        tierStats.push({ tier, faraGol, cuGol, total, pctFaraGol: parseFloat(pctFaraGol) });
    }
});

tierStats.sort((a, b) => b.pctFaraGol - a.pctFaraGol);

console.log('TOP Tier-uri cu risc mare:');
tierStats.slice(0, 15).forEach((stat, idx) => {
    console.log(`  ${(idx + 1).toString().padStart(2)}. ${stat.tier.padEnd(35)} ${stat.pctFaraGol.toString().padStart(5)}% (${stat.total} meciuri)`);
});

// CONCLUZIE
console.log('\n' + '='.repeat(80));
console.log('\n💡 PATTERN-URI IDENTIFICATE (ANOMALII - fără gol R2):\n');

const topOra = oreStats[0];
const topZi = zileStats[0];
const topCamp = campStats[0];

if (topOra && topOra.pctFaraGol > 40) {
    console.log(`⚠️  ORA ${topOra.ora}:00 are ${topOra.pctFaraGol}% risc fără gol R2!`);
}

if (topZi && topZi.pctFaraGol > 40) {
    console.log(`⚠️  ${topZi.zi.toUpperCase()} are ${topZi.pctFaraGol}% risc fără gol R2!`);
}

if (topCamp && topCamp.pctFaraGol > 45) {
    console.log(`⚠️  ${topCamp.campionat} are ${topCamp.pctFaraGol}% risc fără gol R2!`);
}

console.log('\n✅ Analiză completă!\n');
