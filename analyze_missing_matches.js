#!/usr/bin/env node
/**
 * 🔍 ANALYZE MISSING MATCHES
 *
 * Analizează ce meciuri lipsesc din fiecare campionat
 * pentru a identifica etape incomplete
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const SEASONS_DIR = path.join(__dirname, 'data', 'seasons');

function analyzeChampionship(file) {
    const content = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(content);

    const campionatName = data.campionat?.nume_complet ||
                          data.campionat?.nume ||
                          data.campionat ||
                          path.basename(file, '.json').substring(20);

    const matches = data.meciuri || [];

    if (matches.length === 0) return null;

    // Extrage datele meciurilor
    const dates = matches
        .map(m => m.data_ora?.data)
        .filter(d => d)
        .sort();

    if (dates.length === 0) return null;

    const firstDate = new Date(dates[0]);
    const lastDate = new Date(dates[dates.length - 1]);

    // Calculează câte zile au trecut
    const daysDiff = Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24));

    // Estimează numărul așteptat de meciuri
    // Majoritatea ligilor au ~38 etape, cu ~10 meciuri pe etapă
    let expectedMatches = 0;
    const sistemOrganizare = data.campionat?.sistem_organizare || 'REGULAR';
    const numarEchipe = data.campionat?.numar_echipe || 20;

    if (sistemOrganizare === 'REGULAR') {
        // Liga regulată: numar_echipe * (numar_echipe - 1) meciuri
        // (fiecare echipă joacă cu fiecare)
        expectedMatches = numarEchipe * (numarEchipe - 1);

        // Dacă nu știm numărul de echipe, estimăm din meciuri existente
        if (!numarEchipe) {
            // Extragem echipele unice
            const teams = new Set();
            matches.forEach(m => {
                if (m.echipa_gazda?.nume) teams.add(m.echipa_gazda.nume);
                if (m.echipa_oaspete?.nume) teams.add(m.echipa_oaspete.nume);
            });

            const estimatedTeams = teams.size;
            expectedMatches = estimatedTeams * (estimatedTeams - 1);
        }
    } else if (sistemOrganizare === 'KNOCKOUT') {
        // Knockout: mai puține meciuri
        expectedMatches = matches.length; // Nu putem estima
    } else {
        // Champions League, Europa League etc - format special
        expectedMatches = matches.length;
    }

    // Calculează % completitudine
    const completeness = expectedMatches > 0 ?
        Math.round((matches.length / expectedMatches) * 100) : 100;

    const missingMatches = Math.max(0, expectedMatches - matches.length);

    // Verifică dacă sunt gap-uri în date (meciuri lipsă între etape)
    const dateGaps = [];
    for (let i = 1; i < dates.length; i++) {
        const prevDate = new Date(dates[i - 1]);
        const currDate = new Date(dates[i]);
        const gapDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));

        // Dacă gap > 30 zile, probabil lipsesc meciuri
        if (gapDays > 30) {
            dateGaps.push({
                from: dates[i - 1],
                to: dates[i],
                days: gapDays
            });
        }
    }

    return {
        file: path.basename(file),
        campionat: campionatName,
        sezon: data.sezon || data.campionat?.sezon || 'Unknown',
        sistem: sistemOrganizare,
        numarEchipe: numarEchipe,
        meciuriActuale: matches.length,
        meciuriEstimate: expectedMatches,
        meciuriLipsa: missingMatches,
        completeness,
        firstDate: dates[0],
        lastDate: dates[dates.length - 1],
        daysCovered: daysDiff,
        dateGaps
    };
}

function main() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                                                              ║');
    console.log('║         🔍 ANALYZE MISSING MATCHES                           ║');
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const files = glob.sync(path.join(SEASONS_DIR, 'complete_FULL_SEASON_*.json'))
        .filter(f => !f.includes('BACKUP') && !f.includes('ORIGINAL') && !f.includes('OLD_FORMAT'));

    console.log(`📁 Fișiere găsite: ${files.length}\n`);
    console.log('='.repeat(80));

    const results = files.map(analyzeChampionship).filter(r => r !== null);

    // Sortează după % completitudine (crescător)
    results.sort((a, b) => a.completeness - b.completeness);

    // Afișează rezultate
    let totalMissing = 0;
    let championshipsWithGaps = 0;

    results.forEach((r, idx) => {
        const status = r.completeness >= 95 ? '✅' :
                      r.completeness >= 80 ? '🟡' :
                      r.completeness >= 50 ? '🟠' : '🔴';

        console.log(`\n${idx + 1}. ${status} ${r.campionat}`);
        console.log(`   Sezon: ${r.sezon} | Sistem: ${r.sistem}`);
        console.log(`   Meciuri: ${r.meciuriActuale}/${r.meciuriEstimate} (${r.completeness}%)`);

        if (r.meciuriLipsa > 0) {
            console.log(`   ⚠️  MECIURI LIPSĂ: ${r.meciuriLipsa}`);
            totalMissing += r.meciuriLipsa;
        }

        console.log(`   📅 Perioada: ${r.firstDate} → ${r.lastDate} (${r.daysCovered} zile)`);

        if (r.dateGaps.length > 0) {
            championshipsWithGaps++;
            console.log(`   🕳️  GAP-uri detectate: ${r.dateGaps.length}`);
            r.dateGaps.forEach(gap => {
                console.log(`      - ${gap.from} → ${gap.to} (${gap.days} zile)`);
            });
        }

        console.log('   ' + '-'.repeat(76));
    });

    // Statistici globale
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 STATISTICI GLOBALE:\n');

    const perfect = results.filter(r => r.completeness >= 95).length;
    const good = results.filter(r => r.completeness >= 80 && r.completeness < 95).length;
    const medium = results.filter(r => r.completeness >= 50 && r.completeness < 80).length;
    const poor = results.filter(r => r.completeness < 50).length;

    console.log(`   ✅ Complete (≥95%): ${perfect} campionate`);
    console.log(`   🟡 Bune (80-94%): ${good} campionate`);
    console.log(`   🟠 Medii (50-79%): ${medium} campionate`);
    console.log(`   🔴 Slabe (<50%): ${poor} campionate`);
    console.log(`\n   📊 Total meciuri lipsă: ${totalMissing}`);
    console.log(`   🕳️  Campionate cu gap-uri: ${championshipsWithGaps}`);

    // Top 10 cu cele mai multe meciuri lipsă
    console.log('\n' + '='.repeat(80));
    console.log('\n🔴 TOP 10 Campionate cu cele mai multe meciuri lipsă:\n');

    const topMissing = results
        .filter(r => r.meciuriLipsa > 0)
        .sort((a, b) => b.meciuriLipsa - a.meciuriLipsa)
        .slice(0, 10);

    topMissing.forEach((r, idx) => {
        console.log(`   ${idx + 1}. ${r.campionat}`);
        console.log(`      Lipsă: ${r.meciuriLipsa} meciuri (${r.completeness}%)`);
        console.log(`      Perioada: ${r.firstDate} → ${r.lastDate}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Analiză completă!\n');
}

main();
