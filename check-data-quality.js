#!/usr/bin/env node
/**
 * Script rapid pentru verificare calitate date în JSON-uri
 */

const fs = require('fs');
const path = require('path');

function checkMatchData(jsonFile, targetDates = ['22/11/2024', '23/11/2024']) {
    const filepath = path.join(__dirname, 'data', 'seasons', jsonFile);

    if (!fs.existsSync(filepath)) {
        console.log(`❌ Fișier negăsit: ${jsonFile}`);
        return;
    }

    const jsonData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    const league = jsonFile.replace('complete_FULL_SEASON_', '').replace('.json', '');

    // Suport pentru ambele formate: array vechi sau obiect nou
    let meciuri;
    if (Array.isArray(jsonData)) {
        meciuri = jsonData;
    } else if (jsonData.meciuri && Array.isArray(jsonData.meciuri)) {
        meciuri = jsonData.meciuri;
    } else {
        console.log(`⚠️  ${league}: Format JSON necunoscut`);
        return;
    }

    // Găsește meciuri din datele țintă
    const recentMatches = meciuri.filter(m => {
        // Format nou API SMART 4
        if (m.data_si_ora_start) {
            const date = m.data_si_ora_start.split(' ')[0];
            return targetDates.includes(date);
        }
        // Format vechi
        if (m.match && m.match.startTime) {
            const date = m.match.startTime.split(' ')[0];
            return targetDates.includes(date);
        }
        return false;
    });

    if (recentMatches.length === 0) {
        console.log(`\n⚠️  ${league}: Nu sunt meciuri din ${targetDates.join(' sau ')}`);
        return;
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 ${league} - Meciuri din ${targetDates.join(', ')}`);
    console.log(`${'='.repeat(70)}`);
    console.log(`Total meciuri găsite: ${recentMatches.length}\n`);

    // Verifică primele 2 meciuri
    recentMatches.slice(0, 2).forEach((m, i) => {
        // Suport ambele formate
        const homeTeam = m.echipa_gazda || m.match?.homeTeam?.name || 'Unknown';
        const awayTeam = m.echipa_oaspeti || m.match?.awayTeam?.name || 'Unknown';
        const startTime = m.data_si_ora_start || m.match?.startTime || 'Unknown';
        const htScore = m.scor_pauza || m.match?.homeScore?.halfTime + '-' + m.match?.awayScore?.halfTime || '?-?';
        const ftScore = m.scor_final || m.match?.homeScore?.current + '-' + m.match?.awayScore?.current || '?-?';

        console.log(`\n🏟️  Meci ${i + 1}: ${homeTeam} vs ${awayTeam}`);
        console.log(`   Data: ${startTime}`);
        console.log(`   Scor HT: ${htScore}`);
        console.log(`   Scor FT: ${ftScore}`);

        // Check NULL values
        let nullCount = 0;
        const htStats = m.statistici_pauza || m.statistics?.halfTime || {};
        const ftStats = m.statistici_final || m.statistics?.fullTime || {};

        console.log(`\n   📈 Statistici HT: ${Object.keys(htStats).length} categorii`);
        Object.entries(htStats).forEach(([key, val]) => {
            const homeVal = val.home || val.gazda;
            const awayVal = val.away || val.oaspeti;

            if (homeVal === null || awayVal === null) {
                console.log(`      ❌ ${key}: home=${homeVal}, away=${awayVal}`);
                nullCount++;
            }
        });

        console.log(`   📈 Statistici FT: ${Object.keys(ftStats).length} categorii`);
        Object.entries(ftStats).forEach(([key, val]) => {
            const homeVal = val.home || val.gazda;
            const awayVal = val.away || val.oaspeti;

            if (homeVal === null || awayVal === null) {
                console.log(`      ❌ ${key}: home=${homeVal}, away=${awayVal}`);
                nullCount++;
            }
        });

        if (nullCount === 0) {
            console.log(`\n   ✅ TOATE DATELE SUNT VALIDE (0 NULL-uri)`);
        } else {
            console.log(`\n   ⚠️  GĂSITE ${nullCount} NULL-URI`);
        }
    });
}

// Verifică câteva campionate importante
const leaguesToCheck = [
    'complete_FULL_SEASON_TURKEYSuperLig_2024-2025.json',
    'complete_FULL_SEASON_PremierLeague_2024-2025.json',
    'complete_FULL_SEASON_SerieA_2024-2025.json',
    'complete_FULL_SEASON_ENGLANDChampionship_2024-2025.json',
    'complete_FULL_SEASON_GERMANY2Bundesliga_2024-2025.json',
];

console.log('\n🔍 VERIFICARE CALITATE DATE - 22-23 NOIEMBRIE 2024\n');

leaguesToCheck.forEach(checkMatchData);

console.log('\n' + '='.repeat(70));
console.log('✅ VERIFICARE COMPLETĂ\n');
