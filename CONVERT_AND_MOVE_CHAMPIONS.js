#!/usr/bin/env node
/**
 * CONVERT_AND_MOVE_CHAMPIONS.js
 *
 * Convertește meciurile din formatul football-analyzer (engleză)
 * în formatul API SMART 4 (română) și le adaugă în fișierul corect
 */

const fs = require('fs');
const path = require('path');

// Fișiere
const WRONG_FILE = '/home/florian/football-analyzer/complete_FULL_SEASON_EUROPEChampionsLeagueLeaguephase_2024-2025.json';
const CORRECT_FILE = '/home/florian/API SMART 4/complete_FULL_SEASON_ChampionsLeague_2024-2025.json';

/**
 * Convertește un meci din formatul football-analyzer în formatul API SMART 4
 */
function convertMatchFormat(matchData) {
    const match = matchData.match;
    const halftime = matchData.halftime;
    const fulltime = matchData.fulltime;

    // Extrage ID meci din match dacă există
    const matchId = match.matchId || generateMatchId(match);

    // Convertește data din "04.11.2025, 19:45" în componente
    const [datePart, timePart] = match.date.split(', ');
    const [day, month, year] = datePart.split('.');
    const dateFormatted = `${year}-${month}-${day}`;

    // Mapare zile săptămână
    const dayOfWeek = getDayOfWeek(dateFormatted);

    return {
        id_meci: matchId,
        id_flashscore: matchId,
        sezon: match.season || "2024-2025",
        faza: "LEAGUE_PHASE",
        etapa: match.roundNumber || null,
        data_ora: {
            data: dateFormatted,
            ora: timePart || "00:00",
            zi_saptamana: dayOfWeek
        },
        echipa_gazda: {
            nume: match.homeTeam,
            nume_complet: match.homeTeam,
            pozitie_clasament_inainte: match.homePositionBefore || null
        },
        echipa_oaspete: {
            nume: match.awayTeam,
            nume_complet: match.awayTeam,
            pozitie_clasament_inainte: match.awayPositionBefore || null
        },
        scor: {
            final_gazda: parseInt(fulltime.score.home) || 0,
            final_oaspete: parseInt(fulltime.score.away) || 0,
            pauza_gazda: parseInt(halftime.score.home) || 0,
            pauza_oaspete: parseInt(halftime.score.away) || 0
        },
        statistici: convertStatistics(halftime.statistics, fulltime.statistics)
    };
}

/**
 * Convertește statisticile din format engleză în română
 */
function convertStatistics(halftimeStats, fulltimeStats) {
    const stats = {};

    // Mapare nume statistici
    const statsMapping = {
        'Shots on target': 'suturi_pe_poarta',
        'Total shots': 'total_suturi',
        'Corner Kicks': 'cornere',
        'Yellow Cards': 'cartonase_galbene',
        'Red Cards': 'cartonase_rosii',
        'Goalkeeper Saves': 'suturi_salvate',
        'Ball Possession': 'posesie',
        'Expected Goals (xG)': 'xG',
        'Big Chances': 'ocazii_mari',
        'Offsides': 'ofsaiduri',
        'Fouls': 'faulturi',
        'Free Kicks': 'lovituri_libere',
        'Shots off target': 'suturi_pe_langa'
    };

    // Procesează fiecare statistică
    for (const [englishName, romanianName] of Object.entries(statsMapping)) {
        const htHome = halftimeStats?.home?.[englishName];
        const htAway = halftimeStats?.away?.[englishName];
        const ftHome = fulltimeStats?.home?.[englishName];
        const ftAway = fulltimeStats?.away?.[englishName];

        // Calculează repriza 2 (total - pauză)
        const ht_home = parseFloat(htHome) || 0;
        const ht_away = parseFloat(htAway) || 0;
        const ft_home = parseFloat(ftHome) || 0;
        const ft_away = parseFloat(ftAway) || 0;
        const r2_home = ft_home - ht_home;
        const r2_away = ft_away - ht_away;

        stats[romanianName] = {
            pauza_gazda: ht_home,
            pauza_oaspete: ht_away,
            repriza_2_gazda: r2_home,
            repriza_2_oaspete: r2_away,
            total_gazda: ft_home,
            total_oaspete: ft_away
        };
    }

    return stats;
}

/**
 * Generează ID meci dacă nu există
 */
function generateMatchId(match) {
    const str = `${match.homeTeam}_${match.awayTeam}_${match.date}`;
    return Buffer.from(str).toString('base64').substring(0, 8);
}

/**
 * Obține ziua săptămânii în română
 */
function getDayOfWeek(dateString) {
    const days = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
    const date = new Date(dateString);
    return days[date.getDay()];
}

/**
 * Verifică dacă meciul există deja
 */
function matchExists(meciuri, newMatch) {
    return meciuri.some(m => {
        // Verifică după ID
        if (m.id_meci === newMatch.id_meci) return true;

        // Verifică după echipe + dată
        if (m.echipa_gazda.nume === newMatch.echipa_gazda.nume &&
            m.echipa_oaspete.nume === newMatch.echipa_oaspete.nume &&
            m.data_ora.data === newMatch.data_ora.data) {
            return true;
        }

        return false;
    });
}

/**
 * Main
 */
async function main() {
    console.log('\n⚽ CONVERSIE ȘI MUTARE MECIURI CHAMPIONS LEAGUE\n');
    console.log('='.repeat(60));

    // Citește fișierul greșit
    if (!fs.existsSync(WRONG_FILE)) {
        console.error(`❌ Fișierul greșit nu există: ${WRONG_FILE}`);
        process.exit(1);
    }

    const wrongMatches = JSON.parse(fs.readFileSync(WRONG_FILE, 'utf8'));
    console.log(`📄 Citit fișier greșit: ${wrongMatches.length} meciuri`);

    // Citește fișierul corect
    if (!fs.existsSync(CORRECT_FILE)) {
        console.error(`❌ Fișierul corect nu există: ${CORRECT_FILE}`);
        process.exit(1);
    }

    const correctData = JSON.parse(fs.readFileSync(CORRECT_FILE, 'utf8'));
    console.log(`📄 Citit fișier corect: ${correctData.meciuri.length} meciuri existente`);

    console.log('\n🔄 Conversie meciuri...\n');

    let added = 0;
    let duplicates = 0;

    for (const wrongMatch of wrongMatches) {
        const convertedMatch = convertMatchFormat(wrongMatch);

        console.log(`   Convertesc: ${convertedMatch.echipa_gazda.nume} vs ${convertedMatch.echipa_oaspete.nume}`);

        // Verifică duplicate
        if (matchExists(correctData.meciuri, convertedMatch)) {
            console.log(`      ⚠️  DUPLICATE - SKIP`);
            duplicates++;
            continue;
        }

        // Adaugă meciul
        correctData.meciuri.push(convertedMatch);
        console.log(`      ✅ ADĂUGAT`);
        added++;
    }

    // Sortează meciurile după dată
    correctData.meciuri.sort((a, b) => {
        const dateA = new Date(a.data_ora.data);
        const dateB = new Date(b.data_ora.data);
        return dateA - dateB;
    });

    // Salvează backup
    const backupFile = CORRECT_FILE.replace('.json', `.backup-${Date.now()}.json`);
    fs.copyFileSync(CORRECT_FILE, backupFile);
    console.log(`\n💾 Backup creat: ${path.basename(backupFile)}`);

    // Salvează fișierul actualizat
    fs.writeFileSync(CORRECT_FILE, JSON.stringify(correctData, null, 2), 'utf8');
    console.log(`💾 Fișier actualizat: ${path.basename(CORRECT_FILE)}`);

    // Raport final
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 RAPORT FINAL:\n');
    console.log(`   Meciuri de convertit: ${wrongMatches.length}`);
    console.log(`   ✅ Adăugate: ${added}`);
    console.log(`   ⚠️  Duplicate (skip): ${duplicates}`);
    console.log(`   📊 Total meciuri în fișier: ${correctData.meciuri.length}`);
    console.log('\n' + '='.repeat(60));

    // Șterge fișierul greșit?
    console.log(`\n⚠️  Fișierul greșit a rămas la: ${WRONG_FILE}`);
    console.log(`   Poți să-l ștergi manual după verificare.`);
}

// Run
main().catch(err => {
    console.error('\n❌ EROARE:', err.message);
    console.error(err.stack);
    process.exit(1);
});
