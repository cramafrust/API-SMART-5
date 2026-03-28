/**
 * ⚽ CHAMPIONSHIP_JSON_MANAGER.js
 *
 * Gestionează salvarea datelor de meciuri în JSON-uri per campionat
 *
 * FUNCȚIONALITATE:
 * - Identifică campionatul din datele meciului
 * - Verifică dacă există JSON pentru campionat
 * - Creează JSON nou sau adaugă la cel existent
 * - Menține structura: array de meciuri cu match + halftime + fulltime
 *
 * STRUCTURĂ JSON:
 * complete_FULL_SEASON_<ChampionshipName>_<Season>.json
 * [
 *   {
 *     "match": { homeTeam, awayTeam, date, league, ... },
 *     "halftime": { score, statistics },
 *     "fulltime": { score, statistics }
 *   }
 * ]
 *
 * USAGE:
 *   const { saveMatchData } = require('./CHAMPIONSHIP_JSON_MANAGER');
 *   await saveMatchData(matchData, '/path/to/output/dir');
 */

const fs = require('fs');
const path = require('path');
const SafeFileWriter = require('./SAFE_FILE_WRITER');

/**
 * Mapping ligi către nume fișiere (normalizate)
 */
const LEAGUE_FILE_MAPPING = {
    // Premier League
    'Premier League': 'PremierLeague',
    'England - Premier League': 'PremierLeague',
    'ENGLAND: Premier League': 'PremierLeague',

    // La Liga
    'La Liga': 'LaLiga',
    'LaLiga': 'LaLiga',
    'Spain - La Liga': 'LaLiga',
    'SPAIN: LaLiga': 'LaLiga',

    // Serie A
    'Serie A': 'SerieA',
    'Italy - Serie A': 'SerieA',
    'ITALY: Serie A': 'SerieA',

    // Bundesliga
    'Bundesliga': 'Bundesliga',
    'Germany - Bundesliga': 'Bundesliga',
    'GERMANY: Bundesliga': 'Bundesliga',

    // Ligue 1
    'Ligue 1': 'Ligue1',
    'France - Ligue 1': 'Ligue1',
    'FRANCE: Ligue 1': 'Ligue1',

    // Primeira Liga
    'Primeira Liga': 'PrimeiraLiga',
    'Portugal - Primeira Liga': 'PrimeiraLiga',
    'PORTUGAL: Liga Portugal': 'PrimeiraLiga',

    // Eredivisie
    'Eredivisie': 'Eredivisie',
    'Netherlands - Eredivisie': 'Eredivisie',
    'NETHERLANDS: Eredivisie': 'Eredivisie',

    // Superliga Denmark
    'Superliga': 'Superliga',
    'Denmark - Superliga': 'Superliga',
    'DENMARK: Superliga': 'Superliga',

    // Eliteserien Norway
    'Eliteserien': 'Eliteserien',
    'Norway - Eliteserien': 'Eliteserien',
    'NORWAY: Eliteserien': 'Eliteserien',

    // Champions League (toate variantele)
    'Champions League': 'ChampionsLeague',
    'UEFA Champions League': 'ChampionsLeague',
    'EUROPE: Champions League': 'ChampionsLeague',
    'EUROPE: Champions League - League phase': 'ChampionsLeague',

    // Europa League
    'Europa League': 'EuropaLeague',
    'UEFA Europa League': 'EuropaLeague',
    'EUROPE: Europa League': 'EuropaLeague',
    'EUROPE: Europa League - League phase': 'EuropaLeague',

    // Conference League
    'Conference League': 'ConferenceLeague',
    'UEFA Conference League': 'ConferenceLeague',
    'EUROPE: Conference League': 'ConferenceLeague',
    'EUROPE: Conference League - League phase': 'ConferenceLeague',

    // 🇷🇴 România Superliga - Playoff & Playout
    'ROMANIA: Superliga': 'ROMANIASuperliga',
    'ROMANIA: Superliga - Championship Group': 'ROMANIASuperligaChampionshipGroup',
    'ROMANIA: Superliga - Relegation Group': 'ROMANIASuperligaRelegationGroup'
};

/**
 * Normalizează numele campionatului pentru a obține numele fișierului
 */
function normalizeLeagueName(leagueName) {
    // Caută în mapping
    if (LEAGUE_FILE_MAPPING[leagueName]) {
        return LEAGUE_FILE_MAPPING[leagueName];
    }

    // Fallback: Normalizare automată
    // Remove special characters, spaces, hyphens
    const normalized = leagueName
        .replace(/[^a-zA-Z0-9]/g, '')
        .replace(/\s+/g, '')
        .trim();

    return normalized || 'UnknownLeague';
}

/**
 * Generează numele fișierului JSON pentru campionat
 *
 * Format: complete_FULL_SEASON_<ChampionshipName>_<Season>.json
 */
function getChampionshipFilename(leagueName, season) {
    const normalizedLeague = normalizeLeagueName(leagueName);
    return `complete_FULL_SEASON_${normalizedLeague}_${season}.json`;
}

/**
 * Convertește din formatul SMART 5 (engleză) în formatul API SMART 4 (română)
 */
function convertToAPISMART4Format(matchData) {
    const match = matchData.match;
    const halftime = matchData.halftime;
    const fulltime = matchData.fulltime;
    const secondhalf = matchData.secondhalf;

    // Extrage ID meci
    const matchId = matchData.metadata?.matchId || match.matchId || generateMatchId(match);

    // Convertește data din "04.11.2025, 19:45" în componente
    const [datePart, timePart] = match.date.split(', ');
    const [day, month, year] = datePart.split('.');
    const dateFormatted = `${year}-${month}-${day}`;

    // Mapare zile săptămână
    const daysRO = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
    const dayOfWeek = daysRO[new Date(dateFormatted).getDay()];

    // Convertește statistici - folosim secondhalf direct din API dacă e disponibil
    const statistics = convertStatisticsToRomanian(halftime.statistics, fulltime.statistics, secondhalf?.statistics);

    return {
        id_meci: matchId,
        id_flashscore: matchId,
        sezon: match.season || "2024-2025",
        faza: determineFaza(match.league),
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
        statistici: statistics,
        tier_gazda: match.homeTier || null,
        tier_oaspete: match.awayTier || null
    };
}

/**
 * Determină faza competiției din numele ligii
 */
function determineFaza(leagueName) {
    const normalized = leagueName.toLowerCase();
    if (normalized.includes('league phase')) return 'LEAGUE_PHASE';
    if (normalized.includes('group')) return 'GRUPE';
    if (normalized.includes('final')) return 'FINALA';
    if (normalized.includes('semi')) return 'SEMIFINALE';
    if (normalized.includes('quarter')) return 'SFERTURI';
    return 'REGULAR';
}

/**
 * Convertește statisticile din engleză în română
 */
function convertStatisticsToRomanian(halftimeStats, fulltimeStats, secondhalfStats) {
    const stats = {};

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
        'Shots off target': 'suturi_pe_langa',
        'Throw ins': 'aruncari_de_la_margine'
    };

    for (const [englishName, romanianName] of Object.entries(statsMapping)) {
        const htHome = halftimeStats?.home?.[englishName];
        const htAway = halftimeStats?.away?.[englishName];
        const ftHome = fulltimeStats?.home?.[englishName];
        const ftAway = fulltimeStats?.away?.[englishName];
        const r2Home = secondhalfStats?.home?.[englishName];
        const r2Away = secondhalfStats?.away?.[englishName];

        const ht_home = parseFloat(htHome) || 0;
        const ht_away = parseFloat(htAway) || 0;
        const ft_home = parseFloat(ftHome) || 0;
        const ft_away = parseFloat(ftAway) || 0;

        // Folosește valorile directe din API pentru repriza 2 dacă sunt disponibile
        // Altfel, calculează ca FT - HT (dar doar pentru statistici non-procentuale)
        let r2_home, r2_away;
        if (r2Home !== undefined && r2Home !== null) {
            r2_home = parseFloat(r2Home) || 0;
            r2_away = parseFloat(r2Away) || 0;
        } else if (englishName === 'Ball Possession') {
            // Posesia e procentuală - nu scădem, lăsăm null dacă nu avem date directe
            r2_home = null;
            r2_away = null;
        } else {
            // Calcul fallback pentru statistici absolute (suturi, cornere etc.)
            r2_home = ft_home - ht_home;
            r2_away = ft_away - ht_away;
        }

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
 * Creează structura inițială pentru un campionat nou
 */
function createChampionshipStructure(leagueName, season) {
    // Normalizare nume campionat
    const cleanLeagueName = leagueName
        .replace(/^[A-Z]+:\s*/, '')  // Remove country prefix
        .replace(/\s*-\s*League phase$/i, '')
        .replace(/\s*-\s*.*$/i, '')
        .trim();

    return {
        campionat: {
            nume: cleanLeagueName,
            nume_complet: leagueName,
            tara: extractCountry(leagueName),
            id_flashscore: normalizeLeagueName(leagueName).toUpperCase() + '_' + season.replace('-', '_'),
            sezon: season,
            sistem_organizare: determineFaza(leagueName),
            numar_echipe: null,
            numar_total_etape: null,
            data_start_sezon: null,
            data_sfarsit_sezon: null,
            explicatie_sistem: null
        },
        meciuri: []
    };
}

/**
 * Extrage țara din numele ligii
 */
function extractCountry(leagueName) {
    const match = leagueName.match(/^([A-Z]+):/);
    return match ? match[1] : 'Unknown';
}

/**
 * Verifică dacă un meci există deja în JSON (evită duplicate)
 *
 * Compară: homeTeam + awayTeam + date (sau matchId)
 */
function matchExists(existingMatches, newMatch) {
    for (const match of existingMatches) {
        // Compară după ID
        if (match.id_meci === newMatch.id_meci) {
            return true;
        }

        // Compară după echipe + dată
        if (match.echipa_gazda.nume === newMatch.echipa_gazda.nume &&
            match.echipa_oaspete.nume === newMatch.echipa_oaspete.nume &&
            match.data_ora.data === newMatch.data_ora.data) {
            return true;
        }
    }

    return false;
}

/**
 * Caută un JSON existent pentru o ligă (indiferent de sezon și director)
 *
 * @param {string} league - Numele ligii
 * @returns {string|null} - Calea către JSON-ul găsit sau null
 */
function findExistingChampionshipJSON(league, season = null) {
    // Normalizează numele ligii pentru a căuta
    const normalizedLeague = normalizeLeagueName(league);

    // Directoare unde să caute (în ordine: API SMART 5/data/seasons, apoi API SMART 4, apoi folders vechi)
    const searchDirs = [
        '/home/florian/API SMART 5/data/seasons',
        '/home/florian/API SMART 4',
        '/home/florian/API SMART 5',
        '/home/florian/football-analyzer'
    ];

    // CĂUTARE STRICTĂ: Fișierul trebuie să înceapă EXACT cu liga normalizată
    const exactPattern = `complete_FULL_SEASON_${normalizedLeague}_`;

    // Dacă avem sezon, căutăm EXACT acel fișier mai întâi
    if (season) {
        const exactFile = `complete_FULL_SEASON_${normalizedLeague}_${season}.json`;
        for (const dir of searchDirs) {
            if (!fs.existsSync(dir)) continue;
            const fullPath = path.join(dir, exactFile);
            if (fs.existsSync(fullPath)) {
                console.log(`   🔍 Găsit JSON existent (sezon exact): ${fullPath}`);
                return fullPath;
            }
        }
    }

    // Fallback: caută orice fișier cu liga respectivă
    // IMPORTANT: Dacă avem sezon specificat dar fișierul exact nu există,
    // returnăm null (va crea fișier nou) - NU facem fallback la alt sezon!
    if (season) {
        console.log(`   🔍 Nu există JSON pentru ${normalizedLeague}_${season} - va fi creat nou`);
        return null;
    }

    // Fără sezon specificat: caută cel mai recent fișier (comportament vechi)
    for (const dir of searchDirs) {
        if (!fs.existsSync(dir)) continue;

        const files = fs.readdirSync(dir).filter(f =>
            f.startsWith('complete_FULL_SEASON_') &&
            f.endsWith('.json') &&
            !f.includes('.backup-') &&
            !f.includes('OLD_FORMAT') &&
            !f.includes('ORIGINAL') &&
            !f.includes('pre-migration')
        );

        // Gasim toate fisierele pentru aceasta liga
        const matches = files.filter(f => f.startsWith(exactPattern));
        if (matches.length > 0) {
            // Sortam descrescator (cel mai recent sezon primul)
            matches.sort().reverse();
            const fullPath = path.join(dir, matches[0]);
            console.log(`   🔍 Găsit JSON existent: ${fullPath}`);
            return fullPath;
        }
    }

    // Dacă nu găsește exact, returnează null (va crea fișier nou)
    return null;
}

/**
 * Salvează datele unui meci în JSON-ul corespunzător campionatului
 *
 * @param {object} matchData - Date meci formatate (cu match, halftime, fulltime)
 * @param {string} outputDir - Director unde se salvează JSON-urile (default: /home/florian/API SMART 5/data/seasons)
 * @returns {object} - { success, filename, isNew, matchCount }
 */
function saveMatchData(matchData, outputDir = '/home/florian/API SMART 5/data/seasons') {
    console.log(`\n💾 SALVARE DATE MECI\n`);
    console.log('='.repeat(60));

    const league = matchData.match.league;
    const season = matchData.match.season || '2024-2025';

    console.log(`📋 Liga: ${league}`);
    console.log(`📅 Sezon: ${season}`);
    console.log(`⚽ Meci: ${matchData.match.homeTeam} vs ${matchData.match.awayTeam}`);

    // CONVERTEȘTE în formatul API SMART 4 (română)
    const convertedMatch = convertToAPISMART4Format(matchData);
    console.log(`   🔄 Convertit în format API SMART 4`);

    // CAUTĂ MAI ÎNTÂI JSON-URI EXISTENTE (cu sezon exact dacă e disponibil)
    let filepath = findExistingChampionshipJSON(league, season);
    let filename;
    let isNew = false;
    let championshipData;

    if (filepath) {
        // Găsit JSON existent!
        filename = path.basename(filepath);
        console.log(`📄 Fișier EXISTENT găsit: ${filename}`);
        isNew = false;
    } else {
        // Nu există, creează unul nou în outputDir (API SMART 4)
        filename = getChampionshipFilename(league, season);
        filepath = path.join(outputDir, filename);
        console.log(`📄 Fișier NOU va fi creat: ${filename}`);
        isNew = true;
    }

    // Verifică dacă fișierul există
    if (fs.existsSync(filepath)) {
        console.log(`   ✅ Citesc date existente...`);

        try {
            const content = fs.readFileSync(filepath, 'utf8');
            championshipData = JSON.parse(content);

            // Verifică structura - trebuie să fie în format API SMART 5
            if (Array.isArray(championshipData)) {
                // Format vechi detectat - NU mai facem conversie automată!
                console.error(`   ❌ EROARE: JSON în format VECHI detectat!`);
                console.error(`   ❌ Fișier: ${filepath}`);
                console.error(`   💡 Soluție: Rulează scriptul de conversie:`);
                console.error(`      cd "/home/florian/API SMART 5" && node convert-old-json-to-api5.js`);

                throw new Error('JSON în format vechi! Folosește scriptul convert-old-json-to-api5.js pentru conversie manuală.');
            }

            // Verifică că avem campionat și meciuri
            if (!championshipData.campionat || !Array.isArray(championshipData.meciuri)) {
                throw new Error('Format JSON invalid! Lipsește structura campionat sau meciuri.');
            }

            // Verifică dacă meciul există deja
            if (matchExists(championshipData.meciuri, convertedMatch)) {
                console.log(`   ⚠️  Meciul există deja în JSON, SKIP salvare`);
                return {
                    success: false,
                    filename: filename,
                    filepath: filepath,
                    isNew: false,
                    matchCount: championshipData.meciuri.length,
                    reason: 'duplicate'
                };
            }

        } catch (error) {
            console.error(`   ⚠️  Eroare la citire JSON: ${error.message}`);
            console.log(`   🔄 Creez backup și resetez fișierul...`);

            // Backup fișier corupt
            const backupPath = filepath.replace('.json', `.backup-${Date.now()}.json`);
            fs.copyFileSync(filepath, backupPath);

            championshipData = createChampionshipStructure(league, season);
        }

    } else {
        console.log(`   🆕 Fișier NOU, va fi creat`);
        championshipData = createChampionshipStructure(league, season);
        isNew = true;
    }

    // Adaugă meciul nou
    championshipData.meciuri.push(convertedMatch);

    // Sortează după dată
    championshipData.meciuri.sort((a, b) => {
        const dateA = new Date(a.data_ora.data);
        const dateB = new Date(b.data_ora.data);
        return dateA - dateB;
    });

    // Salvează JSON cu protecție anti-suprascriereaccidentală
    try {
        const writer = new SafeFileWriter({ backupDir: path.join(__dirname, 'backups') });

        // Salvare SIGURĂ cu backup automat
        writer.safeWrite(filepath, championshipData, {
            backup: true,              // Creează backup înainte de salvare
            minSize: 500,              // Minim 500 bytes
            requireArray: true,        // Verifică că e array non-gol
            warnOnly: false            // Blochează salvarea dacă e problematică
        });

        console.log(`   📊 Total meciuri în JSON: ${championshipData.meciuri.length}`);
        console.log(`   📁 Salvat în: ${filepath}`);

        console.log('='.repeat(60));

        return {
            success: true,
            filename: filename,
            filepath: filepath,
            isNew: isNew,
            matchCount: championshipData.meciuri.length
        };

    } catch (error) {
        console.error(`   ❌ EROARE la salvare: ${error.message}`);
        console.log('='.repeat(60));

        return {
            success: false,
            filename: filename,
            filepath: filepath,
            error: error.message
        };
    }
}

/**
 * Salvează mai multe meciuri (batch)
 *
 * @param {Array} matchesData - Array de date meciuri
 * @param {string} outputDir - Director output (default: API SMART 5/data/seasons)
 * @returns {object} - Statistici salvare
 */
function saveMultipleMatches(matchesData, outputDir = '/home/florian/API SMART 5/data/seasons') {
    console.log(`\n📦 SALVARE BATCH: ${matchesData.length} meciuri\n`);
    console.log('='.repeat(60));

    const results = {
        total: matchesData.length,
        saved: 0,
        duplicates: 0,
        errors: 0,
        newFiles: 0,
        byLeague: {}
    };

    for (const matchData of matchesData) {
        const result = saveMatchData(matchData, outputDir);

        if (result.success) {
            results.saved++;

            if (result.isNew) {
                results.newFiles++;
            }

            // Contorizare pe ligă
            const league = matchData.match.league;
            if (!results.byLeague[league]) {
                results.byLeague[league] = 0;
            }
            results.byLeague[league]++;

        } else if (result.reason === 'duplicate') {
            results.duplicates++;
        } else {
            results.errors++;
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 REZULTATE SALVARE BATCH:\n`);
    console.log(`   Total meciuri: ${results.total}`);
    console.log(`   ✅ Salvate: ${results.saved}`);
    console.log(`   🔄 Duplicate (skip): ${results.duplicates}`);
    console.log(`   ❌ Erori: ${results.errors}`);
    console.log(`   🆕 Fișiere noi create: ${results.newFiles}`);

    if (Object.keys(results.byLeague).length > 0) {
        console.log(`\n   📋 Pe ligi:`);
        Object.entries(results.byLeague).forEach(([league, count]) => {
            console.log(`      ${league}: ${count} meciuri`);
        });
    }

    console.log('='.repeat(60));

    return results;
}

/**
 * Afișează statistici pentru un JSON de campionat
 */
function displayChampionshipStats(filepath) {
    if (!fs.existsSync(filepath)) {
        console.log(`❌ Fișierul nu există: ${filepath}`);
        return;
    }

    const matches = JSON.parse(fs.readFileSync(filepath, 'utf8'));

    console.log(`\n📊 STATISTICI CAMPIONAT\n`);
    console.log('='.repeat(60));
    console.log(`📄 Fișier: ${path.basename(filepath)}`);
    console.log(`📋 Total meciuri: ${matches.length}`);

    if (matches.length > 0) {
        const firstMatch = matches[0];
        const lastMatch = matches[matches.length - 1];

        console.log(`\n📅 Primul meci: ${firstMatch.match.date}`);
        console.log(`   ${firstMatch.match.homeTeam} ${firstMatch.fulltime.score.home}-${firstMatch.fulltime.score.away} ${firstMatch.match.awayTeam}`);

        console.log(`\n📅 Ultimul meci: ${lastMatch.match.date}`);
        console.log(`   ${lastMatch.match.homeTeam} ${lastMatch.fulltime.score.home}-${lastMatch.fulltime.score.away} ${lastMatch.match.awayTeam}`);
    }

    console.log('='.repeat(60));
}

// Export
module.exports = {
    saveMatchData,
    saveMultipleMatches,
    displayChampionshipStats,
    getChampionshipFilename,
    normalizeLeagueName,
    findExistingChampionshipJSON
};

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
📖 USAGE:

   node CHAMPIONSHIP_JSON_MANAGER.js stats <championship-file.json>

📝 EXEMPLU:

   node CHAMPIONSHIP_JSON_MANAGER.js stats complete_FULL_SEASON_PremierLeague_2025-2026.json
`);
        process.exit(0);
    }

    if (args[0] === 'stats') {
        displayChampionshipStats(args[1]);
    }
}
