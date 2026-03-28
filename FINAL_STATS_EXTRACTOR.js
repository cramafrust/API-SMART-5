/**
 * ⚽ FINAL_STATS_EXTRACTOR.js
 *
 * Extrage statistici FINALE (FT) + HT de la FlashScore API
 *
 * FUNCȚIONALITATE:
 * - Extrage date complete pentru un meci terminat
 * - Parsează statistici HT (Half Time)
 * - Parsează statistici FT (Full Time)
 * - Extrage scoruri HT și FT
 * - Returnează obiect formatat pentru salvare în JSON
 *
 * USAGE:
 *   const { extractFinalStats } = require('./FINAL_STATS_EXTRACTOR');
 *   const data = await extractFinalStats(matchId, matchInfo);
 */

const { fetchMatchDetails, getMatchFromMainFeed } = require('./flashscore-api');
const { getTeamPosition, getTierFromPosition } = require('./standings-scraper-puppeteer');

/**
 * Extrage statistici dintr-un array de records FlashScore
 *
 * Caută recorduri cu:
 * - SG = Stat category (e.g., "Total shots", "Shots on target")
 * - SH = Home value
 * - SI = Away value
 *
 * API-ul returnează 3 secțiuni de statistici:
 * 1. Full Time (Match) - prima secțiune "Top stats"
 * 2. 1st Half (HT) - a doua secțiune "Top stats"
 * 3. 2nd Half - a treia secțiune "Top stats"
 */
function parseStatistics(statsRecords) {
    const stats = {
        fulltime: { home: {}, away: {} },
        halftime: { home: {}, away: {} },
        secondhalf: { home: {}, away: {} } // ADĂUGAT: Statistici repriza 2
    };

    if (!statsRecords || statsRecords.length === 0) {
        return stats;
    }

    // Statisticile importante pe care le căutăm
    // Mapping: lowercase -> canonical name (cum salvăm în JSON)
    const statCategoriesMap = {
        'total shots': 'Total shots',
        'shots on target': 'Shots on target',
        'corner kicks': 'Corner Kicks',
        'yellow cards': 'Yellow Cards',
        'shots off target': 'Shots off target',
        'offsides': 'Offsides',
        'free kicks': 'Free Kicks',
        'fouls': 'Fouls',
        'goalkeeper saves': 'Goalkeeper Saves',
        'ball possession': 'Ball Possession',
        'red cards': 'Red Cards',
        'big chances': 'Big Chances',
        'expected goals (xg)': 'Expected Goals (xG)',
        'throw ins': 'Throw ins'
    };

    // Identificăm secțiunile: prima "Top stats" = FT, a doua "Top stats" = HT, a treia = 2nd Half
    let currentSection = null;
    let topStatsCount = 0;

    for (const record of statsRecords) {
        // Detectăm o nouă secțiune "Top stats"
        if (record.SF && record.SF === 'Top stats') {
            topStatsCount++;
            if (topStatsCount === 1) {
                currentSection = 'fulltime';
            } else if (topStatsCount === 2) {
                currentSection = 'halftime';
            } else if (topStatsCount === 3) {
                currentSection = 'secondhalf'; // CORECTAT: Extragem și statistici R2!
            } else {
                currentSection = null; // Ignorăm secțiunile suplimentare
            }
            continue;
        }

        // Extragem statisticile (SG = stat name, SH = home, SI = away)
        if (record.SG && record.SH !== undefined && record.SI !== undefined && currentSection) {
            const statNameRaw = record.SG;
            const statNameLower = statNameRaw.toLowerCase();

            // Verifică dacă este o statistică importantă (case-insensitive)
            const canonicalName = statCategoriesMap[statNameLower];
            if (canonicalName) {
                // Curăță valorile (elimină % și alte caractere)
                let homeValue = record.SH;
                let awayValue = record.SI;

                // Pentru Ball Possession, păstrează doar numărul
                if (canonicalName === 'Ball Possession') {
                    homeValue = homeValue.replace('%', '').trim();
                    awayValue = awayValue.replace('%', '').trim();
                }

                // Pentru Passes, extrage doar procentul
                if (statNameLower === 'passes' && homeValue.includes('(')) {
                    homeValue = homeValue.split('%')[0];
                    awayValue = awayValue.split('%')[0];
                }

                stats[currentSection].home[canonicalName] = homeValue;
                stats[currentSection].away[canonicalName] = awayValue;
            }
        }
    }

    return stats;
}

/**
 * Extrage scorurile HT și FT din datele API
 *
 * IMPORTANT: Scorul FINAL se CALCULEAZĂ din:
 * Final Score = 1st Half Goals + 2nd Half Goals
 *
 * Câmpurile DA/DZ din core returnează valori greșite (tot 3-3),
 * așa că folosim summary data pentru calcul corect.
 *
 * Summary data:
 * - AC = "1st Half" -> IG/IH = goluri repriza 1
 * - AC = "2nd Half" -> IG/IH = goluri repriza 2
 */
function extractScores(coreData, summaryData) {
    const scores = {
        halftime: { home: null, away: null },
        fulltime: { home: null, away: null }
    };

    let firstHalfHome = 0;
    let firstHalfAway = 0;
    let secondHalfHome = 0;
    let secondHalfAway = 0;

    // Extrage goluri din summary data (repriza 1 și 2)
    if (summaryData && Array.isArray(summaryData)) {
        for (const record of summaryData) {
            // Repriza 1 (HT)
            if (record.AC === '1st Half' && record.IG !== undefined && record.IH !== undefined) {
                firstHalfHome = parseInt(record.IG) || 0;
                firstHalfAway = parseInt(record.IH) || 0;
                scores.halftime.home = firstHalfHome.toString();
                scores.halftime.away = firstHalfAway.toString();
            }
            // Repriza 2
            else if (record.AC === '2nd Half' && record.IG !== undefined && record.IH !== undefined) {
                secondHalfHome = parseInt(record.IG) || 0;
                secondHalfAway = parseInt(record.IH) || 0;
            }
        }
    }

    // Calculează scor FINAL = Repriza 1 + Repriza 2
    const finalHome = firstHalfHome + secondHalfHome;
    const finalAway = firstHalfAway + secondHalfAway;

    scores.fulltime.home = finalHome.toString();
    scores.fulltime.away = finalAway.toString();

    // Fallback pentru HT dacă nu s-a găsit în summary
    if (scores.halftime.home === null && coreData) {
        if (coreData.DB !== undefined) {
            scores.halftime.home = coreData.DB;
            scores.halftime.away = coreData.DD || coreData.DG || '0';
        }
    }

    return scores;
}

/**
 * Extrage statistici FINALE complete pentru un meci
 *
 * @param {string} matchId - ID-ul meciului FlashScore
 * @param {object} matchInfo - Informații despre meci (homeTeam, awayTeam, league, etc.)
 * @returns {object} - Date complete formatate pentru salvare
 */
async function extractFinalStats(matchId, matchInfo = {}) {
    console.log(`\n🔍 EXTRAGERE STATISTICI FINALE: ${matchId}`);
    console.log(`   ${matchInfo.homeTeam || '?'} vs ${matchInfo.awayTeam || '?'}`);

    try {
        // Fetch detalii complete meci
        const matchDetails = await fetchMatchDetails(matchId);

        if (!matchDetails || !matchDetails.core) {
            throw new Error('Nu s-au putut extrage detaliile meciului');
        }

        // Verifică dacă meciul s-a terminat
        const status = matchDetails.core.AB || '';
        if (status !== '100' && !matchDetails.core.AZ) {
            console.log(`   ⚠️  Meciul nu este încă terminat (status: ${status})`);
            return null;
        }

        // Extrage scoruri HT și FT
        const scores = extractScores(matchDetails.core, matchDetails.summary);

        // Parsează statistici
        const stats = parseStatistics(matchDetails.statsData);

        // Informații echipe
        const homeTeam = matchInfo.homeTeam || matchDetails.core.AE || 'Unknown';
        const awayTeam = matchInfo.awayTeam || matchDetails.core.AF || 'Unknown';

        // Timestamp și dată
        const matchTimestamp = matchInfo.matchStartTime || parseInt(matchDetails.core.AD) || 0;
        const matchDate = new Date(matchTimestamp * 1000);
        const dateFormatted = matchDate.toLocaleString('ro-RO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Obține poziția în clasament și calculează TIER pentru fiecare echipă
        let homePositionBefore = null;
        let awayPositionBefore = null;
        let homeTier = null;
        let awayTier = null;

        const leagueName = matchInfo.league || 'Unknown League';
        const tournamentId = matchInfo.leagueId || null;

        try {
            // Obține poziția echipei gazdă
            const homePos = await getTeamPosition(leagueName, homeTeam, tournamentId);
            if (homePos && homePos.position) {
                homePositionBefore = homePos.position;
                homeTier = getTierFromPosition(homePos.position, homePos.totalTeams, leagueName);
                console.log(`   📊 ${homeTeam}: Poziție ${homePos.position}/${homePos.totalTeams} → TIER: ${homeTier}`);
            }

            // Obține poziția echipei oaspete
            const awayPos = await getTeamPosition(leagueName, awayTeam, tournamentId);
            if (awayPos && awayPos.position) {
                awayPositionBefore = awayPos.position;
                awayTier = getTierFromPosition(awayPos.position, awayPos.totalTeams, leagueName);
                console.log(`   📊 ${awayTeam}: Poziție ${awayPos.position}/${awayPos.totalTeams} → TIER: ${awayTier}`);
            }
        } catch (error) {
            console.log(`   ⚠️  Nu s-au putut obține poziții din clasament: ${error.message}`);
            // Continuă fără TIER - nu e blocker
        }

        // Construiește obiectul final în formatul cerut
        const finalData = {
            match: {
                homeTeam: homeTeam,
                awayTeam: awayTeam,
                date: dateFormatted,
                league: matchInfo.league || 'Unknown League',
                country: matchInfo.country || 'Unknown',
                season: '2025-2026', // Sezon curent
                round: null, // TODO: Extract round if needed
                roundNumber: null,
                homePositionBefore: homePositionBefore,
                awayPositionBefore: awayPositionBefore,
                homeTier: homeTier,
                awayTier: awayTier
            },
            halftime: {
                teams: {
                    home: homeTeam,
                    away: awayTeam
                },
                score: {
                    home: scores.halftime.home || '0',
                    away: scores.halftime.away || '0'
                },
                statistics: stats.halftime // Statistici HT separate
            },
            fulltime: {
                teams: {
                    home: homeTeam,
                    away: awayTeam
                },
                score: {
                    home: scores.fulltime.home || '0',
                    away: scores.fulltime.away || '0'
                },
                statistics: stats.fulltime // Statistici FT separate
            },
            secondhalf: {
                teams: {
                    home: homeTeam,
                    away: awayTeam
                },
                statistics: stats.secondhalf // ADĂUGAT: Statistici R2 separate!
            },
            htScoreReal: null,
            metadata: {
                matchId: matchId,
                extractedAt: new Date().toISOString(),
                source: 'FlashScore API'
            }
        };

        console.log(`   ✅ Scor HT: ${scores.halftime.home}-${scores.halftime.away}`);
        console.log(`   ✅ Scor FT: ${scores.fulltime.home}-${scores.fulltime.away}`);
        console.log(`   ✅ Statistici HT: ${Object.keys(stats.halftime.home).length} categorii`);
        console.log(`   ✅ Statistici FT: ${Object.keys(stats.fulltime.home).length} categorii`);
        console.log(`   ✅ Statistici R2: ${Object.keys(stats.secondhalf.home).length} categorii`); // ADĂUGAT: Log R2

        return finalData;

    } catch (error) {
        console.error(`   ❌ EROARE la extragere: ${error.message}`);
        throw error;
    }
}

/**
 * Extrage statistici pentru mai multe meciuri (batch)
 *
 * @param {Array} matches - Array de obiecte { matchId, homeTeam, awayTeam, ... }
 * @param {number} delayMs - Delay între request-uri (default: 2000ms)
 * @returns {Array} - Array cu date extrase (successful + failed)
 */
async function extractMultipleFinalStats(matches, delayMs = 2000) {
    console.log(`\n📦 EXTRAGERE BATCH: ${matches.length} meciuri\n`);
    console.log('='.repeat(60));

    const results = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];

        console.log(`\n[${i + 1}/${matches.length}] ${match.homeTeam} vs ${match.awayTeam}`);

        try {
            const data = await extractFinalStats(match.matchId, match);

            if (data) {
                results.push({
                    success: true,
                    data: data,
                    matchId: match.matchId
                });
                successful++;
            } else {
                results.push({
                    success: false,
                    error: 'Meciul nu este terminat',
                    matchId: match.matchId
                });
                failed++;
            }

        } catch (error) {
            console.error(`   ❌ Eroare: ${error.message}`);
            results.push({
                success: false,
                error: error.message,
                matchId: match.matchId
            });
            failed++;
        }

        // Delay între request-uri pentru a nu suprasolicita API-ul
        if (i < matches.length - 1) {
            console.log(`   ⏳ Waiting ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n✅ REZULTATE BATCH:`);
    console.log(`   Succesful: ${successful}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total: ${matches.length}`);

    return results;
}

// Export
module.exports = {
    extractFinalStats,
    extractMultipleFinalStats,
    parseStatistics,
    extractScores
};

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
📖 USAGE:

   node FINAL_STATS_EXTRACTOR.js <matchId>

📝 EXEMPLU:

   node FINAL_STATS_EXTRACTOR.js 4fR7aBcD

   Extrage statistici finale pentru meciul specificat
`);
        process.exit(0);
    }

    const matchId = args[0];

    (async () => {
        try {
            const data = await extractFinalStats(matchId);

            if (data) {
                console.log('\n📊 DATE EXTRASE:\n');
                console.log(JSON.stringify(data, null, 2));
            }

        } catch (error) {
            console.error(`\n❌ EROARE: ${error.message}\n`);
            process.exit(1);
        }
    })();
}
