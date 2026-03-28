#!/usr/bin/env node
/**
 * Analizează meciuri TOP vs LOW în detaliu
 * Pentru a înțelege DE CE nu e gol în R2
 */

const fs = require('fs');
const glob = require('glob');
const path = require('path');

console.log('\n🔍 ANALIZĂ DETALIATĂ: TOP vs LOW\n');
console.log('='.repeat(80));

const seasonFiles = glob.sync(path.join(__dirname, 'data', 'seasons', 'complete_FULL_SEASON_*.json'))
    .filter(f => !f.includes('BACKUP'));

let topVsLowMatches = [];

seasonFiles.forEach(file => {
    try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        const matches = data.meciuri || [];

        matches.forEach(match => {
            // TOP_1-5 vs LOW_11-14
            if ((match.tier_gazda === 'TOP_1-5' && match.tier_oaspete === 'LOW_11-14') ||
                (match.tier_oaspete === 'TOP_1-5' && match.tier_gazda === 'LOW_11-14')) {

                const scorPauzaG = match.scor?.pauza_gazda || 0;
                const scorPauzaO = match.scor?.pauza_oaspete || 0;
                const scorFinalG = match.scor?.final_gazda || 0;
                const scorFinalO = match.scor?.final_oaspete || 0;

                const golR2 = (scorFinalG > scorPauzaG) || (scorFinalO > scorPauzaO);

                // Cine e TOP și cine e LOW?
                const topEsteGazda = match.tier_gazda === 'TOP_1-5';
                const topScorPauza = topEsteGazda ? scorPauzaG : scorPauzaO;
                const topScorFinal = topEsteGazda ? scorFinalG : scorFinalO;
                const lowScorPauza = topEsteGazda ? scorPauzaO : scorPauzaG;
                const lowScorFinal = topEsteGazda ? scorFinalO : scorFinalG;

                const topCastiga = topScorFinal > lowScorFinal;
                const egal = topScorFinal === lowScorFinal;
                const topPierde = topScorFinal < lowScorFinal;

                // TOP marchează în R2?
                const topMarcheazaR2 = topScorFinal > topScorPauza;

                topVsLowMatches.push({
                    campionat: data.campionat?.nume_complet || 'Unknown',
                    gazda: match.echipa_gazda?.nume,
                    oaspete: match.echipa_oaspete?.nume,
                    scorPauza: `${scorPauzaG}-${scorPauzaO}`,
                    scorFinal: `${scorFinalG}-${scorFinalO}`,
                    topEsteGazda,
                    topCastiga,
                    egal,
                    topPierde,
                    golR2,
                    topMarcheazaR2,
                    topScorPauza,
                    topScorFinal,
                    lowScorPauza,
                    lowScorFinal
                });
            }
        });
    } catch (error) {
        // Skip
    }
});

console.log(`\n📊 Total meciuri TOP_1-5 vs LOW_11-14: ${topVsLowMatches.length}\n`);
console.log('='.repeat(80));

// Statistici generale
const cuGolR2 = topVsLowMatches.filter(m => m.golR2).length;
const faraGolR2 = topVsLowMatches.filter(m => !m.golR2).length;

console.log('\n⚽ GOL REPRIZA 2:');
console.log(`  ✅ Cu gol R2: ${cuGolR2} (${((cuGolR2 / topVsLowMatches.length) * 100).toFixed(1)}%)`);
console.log(`  ❌ Fără gol R2: ${faraGolR2} (${((faraGolR2 / topVsLowMatches.length) * 100).toFixed(1)}%)`);

// Rezultate finale
const topCastiga = topVsLowMatches.filter(m => m.topCastiga).length;
const egal = topVsLowMatches.filter(m => m.egal).length;
const topPierde = topVsLowMatches.filter(m => m.topPierde).length;

console.log('\n🏆 REZULTATE FINALE:');
console.log(`  ✅ TOP câștigă: ${topCastiga} (${((topCastiga / topVsLowMatches.length) * 100).toFixed(1)}%)`);
console.log(`  🤝 Egal: ${egal} (${((egal / topVsLowMatches.length) * 100).toFixed(1)}%)`);
console.log(`  ❌ TOP pierde: ${topPierde} (${((topPierde / topVsLowMatches.length) * 100).toFixed(1)}%)`);

// TOP marchează în R2?
const topMarcheazaR2 = topVsLowMatches.filter(m => m.topMarcheazaR2).length;

console.log('\n🎯 TOP MARCHEAZĂ ÎN R2:');
console.log(`  ✅ Da: ${topMarcheazaR2} (${((topMarcheazaR2 / topVsLowMatches.length) * 100).toFixed(1)}%)`);
console.log(`  ❌ Nu: ${topVsLowMatches.length - topMarcheazaR2} (${(((topVsLowMatches.length - topMarcheazaR2) / topVsLowMatches.length) * 100).toFixed(1)}%)`);

// Analiză: DE CE nu e gol în R2?
console.log('\n' + '='.repeat(80));
console.log('\n🔍 ANALIZĂ: DE CE NU E GOL ÎN R2?\n');

const faraGolR2Matches = topVsLowMatches.filter(m => !m.golR2);

// Categorii
let topDominaPauza = 0; // TOP are 2+ goluri la pauză
let meciBlocate = 0;    // 0-0 la pauză
let lowConducePauza = 0; // LOW conduce la pauză

faraGolR2Matches.forEach(m => {
    if (m.topScorPauza >= 2) {
        topDominaPauza++;
    } else if (m.topScorPauza === 0 && m.lowScorPauza === 0) {
        meciBlocate++;
    } else if (m.lowScorPauza > m.topScorPauza) {
        lowConducePauza++;
    }
});

console.log('📋 Categorii meciuri FĂRĂ gol R2:');
console.log(`  1. TOP domină la pauză (2+ goluri): ${topDominaPauza} (${((topDominaPauza / faraGolR2Matches.length) * 100).toFixed(1)}%)`);
console.log(`     → TOP a marcat în R1, se relaxează în R2`);
console.log(`  2. Meci blocat (0-0 la pauză): ${meciBlocate} (${((meciBlocate / faraGolR2Matches.length) * 100).toFixed(1)}%)`);
console.log(`     → Apărare LOW foarte bună, NU se marchează deloc`);
console.log(`  3. LOW conduce la pauză: ${lowConducePauza} (${((lowConducePauza / faraGolR2Matches.length) * 100).toFixed(1)}%)`);
console.log(`     → Surpriză! LOW face joc defensiv în R2`);

// Scoruri la pauză (meciuri fără gol R2)
console.log('\n⚽ TOP 10 Scoruri la pauză (meciuri FĂRĂ gol R2):');

const scoruriPauza = {};
faraGolR2Matches.forEach(m => {
    scoruriPauza[m.scorPauza] = (scoruriPauza[m.scorPauza] || 0) + 1;
});

Object.entries(scoruriPauza)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([scor, count], idx) => {
        console.log(`  ${(idx + 1).toString().padStart(2)}. ${scor.padEnd(8)} ${count} meciuri`);
    });

console.log('\n' + '='.repeat(80));
console.log('\n💡 CONCLUZIE:\n');

const pctTopDomina = ((topDominaPauza / faraGolR2Matches.length) * 100).toFixed(1);

if (topDominaPauza > faraGolR2Matches.length * 0.4) {
    console.log(`⚠️  În ${pctTopDomina}% din cazuri, TOP domină la PAUZĂ (2+ goluri),`);
    console.log(`   apoi NU mai marchează în R2 (joc controlat/relaxat)!\n`);
    console.log(`📌 Pattern-ul "Gol R2" NU e potrivit când TOP domină deja la pauză!`);
} else {
    console.log(`⚠️  Apărarea LOW este foarte eficientă - multe meciuri blocate!\n`);
    console.log(`📌 TOP vs LOW e imprevizibil pentru "Gol R2"!`);
}

console.log('\n✅ Analiză completă!\n');
