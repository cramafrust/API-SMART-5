#!/usr/bin/env node
/**
 * 🔄 CONVERTOR FORMAT VECHI → FORMAT API SMART 5
 *
 * Convertește JSON-urile vechi (array simplu) în formatul API SMART 5
 * (cu campionat + meciuri)
 */

const fs = require('fs');
const path = require('path');

// Mapping statistici engleză → română
const STATS_MAPPING = {
    'Total shots': 'total_suturi',
    'Shots on target': 'suturi_pe_poarta',
    'Shots off target': 'suturi_pe_langa',
    'Corner Kicks': 'cornere',
    'Yellow Cards': 'cartonase_galbene',
    'Red Cards': 'cartonase_rosii',
    'Offsides': 'ofsaiduri',
    'Free Kicks': 'lovituri_libere',
    'Fouls': 'faulturi',
    'Goalkeeper Saves': 'salvari_portar',
    'Ball Possession': 'posesie',
    'Throw-in': 'aruncari_de_la_margine',
    'Goal Kicks': 'lovituri_de_poarta'
};

/**
 * Extrage nume campionat din numele fișierului
 */
function extractLeagueInfo(filename) {
    const name = filename.replace('complete_FULL_SEASON_', '').replace('.json', '');

    // Map specific pentru campionate cunoscute
    const leagueMap = {
        'Bundesliga_2024-2025': { nume: 'Bundesliga', tara: 'GERMANY', sezon: '2024-2025' },
        'BRAZILSerieA_2024': { nume: 'Serie A', tara: 'BRAZIL', sezon: '2024' },
        'BRAZILSerieA_2025': { nume: 'Serie A', tara: 'BRAZIL', sezon: '2025' },
        'Eliteserien_2024': { nume: 'Eliteserien', tara: 'NORWAY', sezon: '2024' },
        'POLONIAEkstraklasa_2024-2025': { nume: 'Ekstraklasa', tara: 'POLAND', sezon: '2024-2025' },
        'PORTUGALLigaPortugal_2024-2025': { nume: 'Liga Portugal', tara: 'PORTUGAL', sezon: '2024-2025' },
        'PremierLeague_2024-2025': { nume: 'Premier League', tara: 'ENGLAND', sezon: '2024-2025' },
        'BELGIUMRegularSeason_2024-2025': { nume: 'Regular Season', tara: 'BELGIUM', sezon: '2024-2025' },
        'BELGIUMRegularSeason_2024-2025_ORIGINAL': { nume: 'Regular Season', tara: 'BELGIUM', sezon: '2024-2025' },
        'GREECESuperLeague_MULTI_2023-2025': { nume: 'Super League', tara: 'GREECE', sezon: '2023-2025' }
    };

    return leagueMap[name] || { nume: name, tara: 'UNKNOWN', sezon: '2024-2025' };
}

/**
 * Convertește data din "26.05.2025 21:30" în { data: "2025-05-26", ora: "21:30" }
 */
function parseDate(dateString) {
    if (!dateString) return { data: null, ora: null, zi_saptamana: null };

    const parts = dateString.split(' ');
    if (parts.length !== 2) return { data: null, ora: null, zi_saptamana: null };

    const [datePart, timePart] = parts;
    const [day, month, year] = datePart.split('.');

    const isoDate = `${year}-${month}-${day}`;
    const dateObj = new Date(isoDate);
    const days = ['Duminica', 'Luni', 'Marti', 'Miercuri', 'Joi', 'Vineri', 'Sambata'];

    return {
        data: isoDate,
        ora: timePart,
        zi_saptamana: days[dateObj.getDay()]
    };
}

/**
 * Extrage ID-ul meciului din URL FlashScore
 */
function extractMatchId(url) {
    if (!url) return null;
    const match = url.match(/mid=([A-Za-z0-9]+)/);
    return match ? match[1] : null;
}

/**
 * Convertește statisticile din format vechi în format nou
 */
function convertStatistics(htStats, ftStats) {
    const result = {};

    // Procesează toate statisticile
    Object.keys(STATS_MAPPING).forEach(oldKey => {
        const newKey = STATS_MAPPING[oldKey];

        const htHome = htStats?.home?.[oldKey] ? parseInt(htStats.home[oldKey]) || 0 : null;
        const htAway = htStats?.away?.[oldKey] ? parseInt(htStats.away[oldKey]) || 0 : null;
        const ftHome = ftStats?.home?.[oldKey] ? parseInt(ftStats.home[oldKey]) || 0 : null;
        const ftAway = ftStats?.away?.[oldKey] ? parseInt(ftStats.away[oldKey]) || 0 : null;

        // Calculează repriza 2 (total - pauza)
        const r2Home = (ftHome !== null && htHome !== null) ? ftHome - htHome : null;
        const r2Away = (ftAway !== null && htAway !== null) ? ftAway - htAway : null;

        result[newKey] = {
            pauza_gazda: htHome,
            pauza_oaspete: htAway,
            repriza_2_gazda: r2Home,
            repriza_2_oaspete: r2Away,
            total_gazda: ftHome,
            total_oaspete: ftAway
        };
    });

    return result;
}

/**
 * Convertește un meci din format vechi în format nou
 */
function convertMatch(oldMatch) {
    const dateInfo = parseDate(oldMatch.match?.date);
    const matchId = extractMatchId(oldMatch.match?.url);

    return {
        id_meci: matchId || `unknown_${Date.now()}`,
        id_flashscore: matchId || null,
        sezon: dateInfo.data ? dateInfo.data.split('-')[0] : '2024-2025',
        faza: 'REGULAR',
        etapa: oldMatch.match?.roundNumber || null,
        data_ora: dateInfo,
        echipa_gazda: {
            nume: oldMatch.halftime?.teams?.home || oldMatch.match?.homeTeam || 'Unknown',
            nume_complet: oldMatch.halftime?.teams?.home || oldMatch.match?.homeTeam || 'Unknown',
            pozitie_clasament_inainte: oldMatch.match?.homePositionBefore || null
        },
        echipa_oaspete: {
            nume: oldMatch.halftime?.teams?.away || oldMatch.match?.awayTeam || 'Unknown',
            nume_complet: oldMatch.halftime?.teams?.away || oldMatch.match?.awayTeam || 'Unknown',
            pozitie_clasament_inainte: oldMatch.match?.awayPositionBefore || null
        },
        scor: {
            final_gazda: parseInt(oldMatch.fulltime?.score?.home) || 0,
            final_oaspete: parseInt(oldMatch.fulltime?.score?.away) || 0,
            pauza_gazda: parseInt(oldMatch.halftime?.score?.home) || 0,
            pauza_oaspete: parseInt(oldMatch.halftime?.score?.away) || 0
        },
        statistici: convertStatistics(
            oldMatch.halftime?.statistics,
            oldMatch.fulltime?.statistics
        ),
        tier_gazda: oldMatch.match?.homeTier || null,
        tier_oaspete: oldMatch.match?.awayTier || null
    };
}

/**
 * Convertește un JSON complet
 */
function convertJSON(oldData, filename) {
    const leagueInfo = extractLeagueInfo(filename);

    return {
        campionat: {
            nume: leagueInfo.nume,
            nume_complet: `${leagueInfo.tara}: ${leagueInfo.nume}`,
            tara: leagueInfo.tara,
            id_flashscore: filename.replace('complete_FULL_SEASON_', '').replace('.json', '').toUpperCase(),
            sezon: leagueInfo.sezon,
            sistem_organizare: 'REGULAR',
            numar_echipe: null,
            numar_total_etape: null,
            data_start_sezon: null,
            data_sfarsit_sezon: null,
            explicatie_sistem: null
        },
        meciuri: oldData.map(match => convertMatch(match))
    };
}

/**
 * Main conversion function
 */
async function convertAllOldJSONs(dryRun = false) {
    const seasonsDir = path.join(__dirname, 'data', 'seasons');
    const files = fs.readdirSync(seasonsDir).filter(f =>
        f.startsWith('complete_FULL_SEASON_') && f.endsWith('.json')
    );

    console.log('\n🔄 CONVERSIE FORMAT VECHI → FORMAT API SMART 5\n');
    console.log('='.repeat(70));
    console.log(`Mod: ${dryRun ? 'DRY RUN (test)' : 'PRODUCȚIE (salvare efectivă)'}\n`);

    let converted = 0;
    let skipped = 0;
    let errors = 0;

    for (const file of files) {
        const filepath = path.join(seasonsDir, file);

        try {
            const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

            // Skip dacă e deja în format nou
            if (!Array.isArray(data)) {
                console.log(`⏭️  SKIP: ${file} (deja în format API SMART 5)`);
                skipped++;
                continue;
            }

            console.log(`\n🔄 Convertesc: ${file}`);
            console.log(`   Meciuri de convertit: ${data.length}`);

            // Convertește
            const newData = convertJSON(data, file);

            console.log(`   ✅ Conversie reușită`);
            console.log(`   📊 Rezultat: ${newData.meciuri.length} meciuri în format nou`);

            if (!dryRun) {
                // Salvează backup
                const backupPath = filepath.replace('.json', '_OLD_FORMAT_BACKUP.json');
                fs.copyFileSync(filepath, backupPath);
                console.log(`   💾 Backup salvat: ${path.basename(backupPath)}`);

                // Salvează noul format
                fs.writeFileSync(filepath, JSON.stringify(newData, null, 2), 'utf8');
                console.log(`   💾 Salvat în format nou API SMART 5`);
            } else {
                console.log(`   [DRY RUN] Ar salva ${newData.meciuri.length} meciuri`);
            }

            converted++;

        } catch (error) {
            console.error(`\n❌ EROARE: ${file}`);
            console.error(`   ${error.message}`);
            errors++;
        }
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n📊 RAPORT FINAL CONVERSIE:\n');
    console.log(`Total fișiere procesate: ${files.length}`);
    console.log(`✅ Convertite cu succes: ${converted}`);
    console.log(`⏭️  Skip (deja convertite): ${skipped}`);
    console.log(`❌ Erori: ${errors}`);
    console.log('\n' + '='.repeat(70) + '\n');

    return { converted, skipped, errors };
}

// Parse arguments
const dryRun = process.argv.includes('--dry-run');

// Run
convertAllOldJSONs(dryRun).then(result => {
    if (result.errors > 0) {
        process.exit(1);
    }
}).catch(error => {
    console.error('\n❌ EROARE FATALĂ:', error.message);
    process.exit(1);
});
