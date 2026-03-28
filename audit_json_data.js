#!/usr/bin/env node
/**
 * 🔍 AUDIT JSON DATA - Verifică completitudinea datelor colectate
 *
 * Verifică pentru fiecare campionat:
 * - Meciuri din sezonul curent (2024-2025)
 * - Date complete (scor HT, FT, tier, statistici)
 * - Meciuri incomplete sau lipsă
 */

const fs = require('fs');
const glob = require('glob');
const path = require('path');

const SEASONS_DIR = path.join(__dirname, 'data', 'seasons');
const CURRENT_SEASON = '2025-2026';

function auditJSONFile(filePath) {
    const fileName = path.basename(filePath);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const report = {
        file: fileName,
        campionat: data.campionat || 'Unknown',
        sezon: data.sezon || 'Unknown',
        totalMeciuri: 0,
        meciuriComplete: 0,
        meciuriIncomplete: 0,
        problemeLipsa: {
            lipsa_scor_ht: 0,
            lipsa_scor_ft: 0,
            lipsa_tier_gazda: 0,
            lipsa_tier_oaspete: 0,
            lipsa_data: 0,
            lipsa_statistici_ht: 0,
            lipsa_statistici_r2: 0
        },
        samples: []
    };

    const meciuri = data.meciuri || [];
    report.totalMeciuri = meciuri.length;

    meciuri.forEach((meci, idx) => {
        let isComplete = true;
        const probleme = [];

        // Verifică scor HT
        if (typeof meci.scor?.pauza_gazda !== 'number' || typeof meci.scor?.pauza_oaspete !== 'number') {
            isComplete = false;
            probleme.push('SCOR_HT');
            report.problemeLipsa.lipsa_scor_ht++;
        }

        // Verifică scor FT
        if (typeof meci.scor?.final_gazda !== 'number' || typeof meci.scor?.final_oaspete !== 'number') {
            isComplete = false;
            probleme.push('SCOR_FT');
            report.problemeLipsa.lipsa_scor_ft++;
        }

        // Verifică tier
        if (!meci.tier_gazda) {
            isComplete = false;
            probleme.push('TIER_GAZDA');
            report.problemeLipsa.lipsa_tier_gazda++;
        }
        if (!meci.tier_oaspete) {
            isComplete = false;
            probleme.push('TIER_OASPETE');
            report.problemeLipsa.lipsa_tier_oaspete++;
        }

        // Verifică data
        if (!meci.data_ora?.data) {
            isComplete = false;
            probleme.push('DATA');
            report.problemeLipsa.lipsa_data++;
        }

        // Verifică statistici HT
        if (!meci.statistici?.cornere?.pauza_gazda || !meci.statistici?.suturi_pe_poarta?.pauza_gazda) {
            isComplete = false;
            probleme.push('STATS_HT');
            report.problemeLipsa.lipsa_statistici_ht++;
        }

        // Verifică statistici R2
        if (typeof meci.statistici?.cornere?.repriza_2_gazda !== 'number' ||
            typeof meci.statistici?.cornere?.repriza_2_oaspete !== 'number') {
            isComplete = false;
            probleme.push('STATS_R2');
            report.problemeLipsa.lipsa_statistici_r2++;
        }

        if (isComplete) {
            report.meciuriComplete++;
        } else {
            report.meciuriIncomplete++;

            // Păstrează primele 3 exemple incomplete
            if (report.samples.length < 3) {
                report.samples.push({
                    index: idx,
                    echipe: `${meci.echipa_gazda?.nume || 'Unknown'} vs ${meci.echipa_oaspete?.nume || 'Unknown'}`,
                    data: meci.data_ora?.data || 'N/A',
                    probleme
                });
            }
        }
    });

    return report;
}

function main() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                                                              ║');
    console.log('║         🔍 AUDIT JSON DATA - Sezon 2025-2026                 ║');
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const files = glob.sync(path.join(SEASONS_DIR, 'complete_FULL_SEASON_*.json'))
        .filter(f => !f.includes('BACKUP') && !f.includes('ORIGINAL') && !f.includes('OLD_FORMAT'));

    console.log(`📁 Fișiere găsite: ${files.length}\n`);
    console.log('='.repeat(80));

    const reports = files.map(auditJSONFile);

    // Sortează după % completitudine
    reports.sort((a, b) => {
        const percA = a.totalMeciuri > 0 ? (a.meciuriComplete / a.totalMeciuri) * 100 : 0;
        const percB = b.totalMeciuri > 0 ? (b.meciuriComplete / b.totalMeciuri) * 100 : 0;
        return percB - percA;
    });

    // Afișează rapoarte
    reports.forEach((r, idx) => {
        const percComplete = r.totalMeciuri > 0 ? Math.round((r.meciuriComplete / r.totalMeciuri) * 100) : 0;
        const status = percComplete === 100 ? '✅' : percComplete >= 90 ? '🟡' : percComplete >= 50 ? '🟠' : '🔴';

        console.log(`\n${idx + 1}. ${status} ${r.campionat || path.basename(r.file, '.json').substring(20)}`);
        console.log(`   Sezon: ${r.sezon || 'Unknown'}`);
        console.log(`   Meciuri: ${r.totalMeciuri} total | ${r.meciuriComplete} complete | ${r.meciuriIncomplete} incomplete`);
        console.log(`   Completitudine: ${percComplete}%`);

        if (r.meciuriIncomplete > 0) {
            console.log(`\n   ⚠️  Probleme detectate:`);
            if (r.problemeLipsa.lipsa_scor_ht > 0) console.log(`      - SCOR HT lipsă: ${r.problemeLipsa.lipsa_scor_ht} meciuri`);
            if (r.problemeLipsa.lipsa_scor_ft > 0) console.log(`      - SCOR FT lipsă: ${r.problemeLipsa.lipsa_scor_ft} meciuri`);
            if (r.problemeLipsa.lipsa_tier_gazda > 0) console.log(`      - TIER Gazdă lipsă: ${r.problemeLipsa.lipsa_tier_gazda} meciuri`);
            if (r.problemeLipsa.lipsa_tier_oaspete > 0) console.log(`      - TIER Oaspeți lipsă: ${r.problemeLipsa.lipsa_tier_oaspete} meciuri`);
            if (r.problemeLipsa.lipsa_data > 0) console.log(`      - DATA lipsă: ${r.problemeLipsa.lipsa_data} meciuri`);
            if (r.problemeLipsa.lipsa_statistici_ht > 0) console.log(`      - STATISTICI HT lipsa: ${r.problemeLipsa.lipsa_statistici_ht} meciuri`);
            if (r.problemeLipsa.lipsa_statistici_r2 > 0) console.log(`      - STATISTICI R2 lipsă: ${r.problemeLipsa.lipsa_statistici_r2} meciuri`);

            if (r.samples.length > 0) {
                console.log(`\n   📋 Exemple meciuri incomplete:`);
                r.samples.forEach(s => {
                    console.log(`      [${s.index}] ${s.echipe} (${s.data})`);
                    console.log(`          Probleme: ${s.probleme.join(', ')}`);
                });
            }
        }

        console.log('   ' + '-'.repeat(76));
    });

    // Statistici globale
    const totalMeciuri = reports.reduce((sum, r) => sum + r.totalMeciuri, 0);
    const totalComplete = reports.reduce((sum, r) => sum + r.meciuriComplete, 0);
    const totalIncomplete = reports.reduce((sum, r) => sum + r.meciuriIncomplete, 0);
    const percGlobal = totalMeciuri > 0 ? Math.round((totalComplete / totalMeciuri) * 100) : 0;

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 STATISTICI GLOBALE:\n');
    console.log(`   Total campionate: ${reports.length}`);
    console.log(`   Total meciuri: ${totalMeciuri}`);
    console.log(`   Meciuri complete: ${totalComplete} (${percGlobal}%)`);
    console.log(`   Meciuri incomplete: ${totalIncomplete} (${100 - percGlobal}%)`);

    const perfect = reports.filter(r => r.meciuriIncomplete === 0).length;
    const good = reports.filter(r => {
        const perc = r.totalMeciuri > 0 ? (r.meciuriComplete / r.totalMeciuri) * 100 : 0;
        return perc >= 90 && perc < 100;
    }).length;
    const medium = reports.filter(r => {
        const perc = r.totalMeciuri > 0 ? (r.meciuriComplete / r.totalMeciuri) * 100 : 0;
        return perc >= 50 && perc < 90;
    }).length;
    const bad = reports.filter(r => {
        const perc = r.totalMeciuri > 0 ? (r.meciuriComplete / r.totalMeciuri) * 100 : 0;
        return perc < 50;
    }).length;

    console.log(`\n   ✅ Perfecte (100%): ${perfect} campionate`);
    console.log(`   🟡 Bune (90-99%): ${good} campionate`);
    console.log(`   🟠 Medii (50-89%): ${medium} campionate`);
    console.log(`   🔴 Slabe (<50%): ${bad} campionate`);

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Audit complet!\n');
}

main();
