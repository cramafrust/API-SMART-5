/**
 * STATS MONITOR - DAEMON
 *
 * Monitorizează programul de verificări și extrage statistici automat
 * Verifică la fiecare 1 minut dacă a sosit timpul vreunei verificări
 */

const fs = require('fs');
const path = require('path');
const { fetchMatchDetails } = require('./flashscore-api');
const PatternChecker = require('./pattern-checker');
const ProcenteLoader = require('./PROCENTE_LOADER');
const EmailNotifier = require('./email-notifier');
const { getTeamPosition, getTierFromPosition } = require('./standings-scraper-puppeteer');
const { getPositionFromHistory } = require('./POSITION_FALLBACK');
const { getTeamStreak, getStreakStats, getScoringStreak, getScoringStreakStats, getGoalStreak, getGoalStreakStats } = require('./WINNING_STREAK');
const { checkAndSendPreMatchEmails, sendGoalsCardsEmail } = require('./PRE_MATCH_STREAKS');
const { refreshDailyMatches } = require('./DAILY_MATCHES');
// DEZACTIVAT — FlashScore nu adaugă meciuri în cursul zilei, discovery-ul genera gunoi
// const { checkLiveForPlayoff, discoverPlayoffMatches } = require('./PLAYOFF_DISCOVERY');
const NotificationTracker = require('./NOTIFICATION_TRACKER');
const lifecycle = require('./LIFECYCLE_MANAGER');
const logger = require('./LOG_MANAGER');

// Interval verificare: 1 minut = 60000 ms
const CHECK_INTERVAL = 60000;

// Toleranță: consideră "sosit timpul" dacă suntem în intervalul [ora_verificare - 1 min, ora_verificare + 2 min]
const TIME_TOLERANCE_BEFORE = 60; // secunde înainte
const TIME_TOLERANCE_AFTER = 120;  // secunde după

/**
 * Formatează timestamp în format HH:MM:SS
 */
function formatTimeDetailed(timestamp) {
    const date = new Date(timestamp * 1000);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

/**
 * Formatează data în format DD.MM.YYYY
 */
function formatDate(date = new Date()) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

/**
 * Determină pragul minim de probabilitate în funcție de ligă
 *
 * PRAGURI (bazate pe analiză rata gol R2 din ~15.000 meciuri 2024-2026):
 *   85% — Ligi foarte slabe (rata R2 < 65%)
 *   80% — Ligi sub-medie (rata R2 65-75%)
 *   75% — Standard (rata R2 75-80%)
 *   70% — Competiții europene (rata R2 78-82%)
 *
 * PENALIZARE TIER (aplicată separat în logica de pattern):
 *   Analiza arată că problema NU e tier-ul echipei ci DIFERENȚA de tier:
 *   - LOW vs LOW: 57.5% (OK)      TOP vs TOP: 53.2% (OK)
 *   - LOW vs TOP: 44.4% (SLAB)    LOW vs MID: 48.5% (SLAB)
 *   → Se aplică +5% la prag când echipa joacă contra tier superior
 */
function getMinimumThreshold(leagueName) {
    const europeanCompetitions = [
        'Champions League',
        'Europa League',
        'Conference League'
    ];

    // Ligi foarte slabe — rata gol R2 sub 65%
    const veryWeakLeagues = [
        'NORWAY: Eliteserien',        // 36.9% rata R2 — extrem de slab
        'Eliteserien'                  // varianta scurtă
    ];

    // Ligi sub-medie — rata gol R2 65-75%
    const weakLeagues = [
        'BELGIUM',                     // 65-75% rata R2
        'ARGENTINA',                   // 70.9%
        'ROMANIA: Superliga',          // 72.1%
        'ENGLAND: Championship',       // 75.1% (la limită)
        'GREECE',                      // 74.8%
        'PORTUGAL: Liga Portugal',     // 78.5% — scos din very weak, e OK
        'ITALY: Serie A',             // 77.4% — scos din very weak, e OK
        'BRAZIL: Serie A'             // 61.5% (Betano) / 92.5% (Serie A principală) — variabilă
    ];

    // NOTĂ: Serbia (77.8%) și Scotland (82.1%) SCOASE din weakLeagues — performanță bună

    const isEuropean = europeanCompetitions.some(comp =>
        leagueName && leagueName.includes(comp)
    );

    const isVeryWeak = veryWeakLeagues.some(wl =>
        leagueName && leagueName.includes(wl)
    );

    const isWeakLeague = weakLeagues.some(wl =>
        leagueName && leagueName.includes(wl)
    );

    if (isEuropean) return 70;
    if (isVeryWeak) return 85;
    if (isWeakLeague) return 80;
    return 75;
}

/**
 * Calculează penalizarea de tier bazată pe DIFERENȚA de tier
 *
 * Analiza (15.000 meciuri):
 *   LOW vs TOP: 44.4% (slab) → +5% penalty
 *   LOW vs MID: 48.5% (slab) → +5% penalty
 *   MID vs TOP: 49.6% (marginal) → +3% penalty
 *   Restul: fără penalty (tier egal sau echipa e mai bună)
 */
function getTierDifferencePenalty(teamTier, opponentTier) {
    const tierRank = { 'TOP': 3, 'MID': 2, 'LOW': 1 };

    function normRank(tier) {
        if (!tier) return 2; // default MID
        const t = tier.toUpperCase();
        if (t.includes('TOP')) return 3;
        if (t.includes('MID') || t.includes('MIDDLE')) return 2;
        return 1; // LOW, BOTTOM
    }

    const teamRank = normRank(teamTier);
    const oppRank = normRank(opponentTier);
    const diff = oppRank - teamRank; // pozitiv = adversar mai bun

    if (diff >= 2) return 5;  // LOW vs TOP → +5%
    if (diff >= 1) return 3;  // LOW vs MID sau MID vs TOP → +3%
    return 0;                  // egal sau echipa e mai bună
}

/**
 * Calculează scorul real din summary data
 */
function calculateRealScore(summary) {
    if (!summary || summary.length === 0) {
        return { home: 0, away: 0, ht: { home: 0, away: 0 } };
    }

    let homeTotal = 0;
    let awayTotal = 0;
    let htHome = 0;
    let htAway = 0;

    // Căutăm repriza 1 pentru scorul HT
    const firstHalf = summary.find(s => s.AC === '1st Half');
    if (firstHalf) {
        htHome = parseInt(firstHalf.IG) || 0;
        htAway = parseInt(firstHalf.IH) || 0;
        homeTotal += htHome;
        awayTotal += htAway;
    }

    // Căutăm repriza 2 pentru scorul final curent
    const secondHalf = summary.find(s => s.AC === '2nd Half');
    if (secondHalf) {
        homeTotal += parseInt(secondHalf.IG) || 0;
        awayTotal += parseInt(secondHalf.IH) || 0;
    }

    return {
        home: homeTotal,
        away: awayTotal,
        ht: {
            home: htHome,
            away: htAway
        }
    };
}

/**
 * Mapare statistici FlashScore → format SMART 4
 */
const STATS_MAPPING = {
    'Shots on target': 'suturi_pe_poarta',
    'Total shots': 'total_suturi',
    'Corner Kicks': 'cornere',
    'Yellow Cards': 'cartonase_galbene',
    'Red Cards': 'cartonase_rosii',
    'Goalkeeper Saves': 'suturi_salvate',
    'Fouls': 'faulturi',
    'Offsides': 'ofsaiduri',
    'Expected Goals (xG)': 'xG',
    'Ball Possession': 'posesie'
};

/**
 * Parse valoare statistică (poate fi "5", "50%", "75% (15/20)", etc)
 */
function parseStatValue(value) {
    if (!value) return 0;

    const str = String(value).trim();

    // Dacă e format "75% (15/20)", extrage doar numărul din paranteză
    const parenMatch = str.match(/\((\d+)\/\d+\)/);
    if (parenMatch) {
        return parseInt(parenMatch[1]) || 0;
    }

    // Dacă e procent "50%", întoarce doar numărul
    const percentMatch = str.match(/^(\d+)%/);
    if (percentMatch) {
        return parseInt(percentMatch[1]) || 0;
    }

    // Altfel încearcă să parsezi ca număr
    const num = parseInt(str);
    return isNaN(num) ? 0 : num;
}

/**
 * Extrage statistici pentru un meci (DOAR cei 8 parametri necesari)
 * + VERIFICĂ PATTERN-URI + TRIMITE NOTIFICARE
 */
async function extractMatchStats(verificare, procenteLoader, emailNotifier) {
    logger.info(`\n📊 EXTRAGERE STATISTICI LA PAUZĂ: ${verificare.homeTeam} vs ${verificare.awayTeam}`);
    logger.info(`   Match ID: ${verificare.matchId}`);
    logger.info(`   Liga: ${verificare.liga}`);
    logger.info(`   Minut verificare: ${verificare.minutMeci}\n`);

    try {
        // Fetch detalii meci
        const details = await fetchMatchDetails(verificare.matchId);

        // Calculează scor real
        const score = calculateRealScore(details.summary);

        // Construiește obiect statistici (format SMART 4)
        const stats = {
            id_meci: verificare.matchId,
            id_flashscore: verificare.matchId,
            data_ora: {
                data: verificare.oraStart.split(' ')[0] || new Date().toISOString().split('T')[0],
                ora: verificare.oraStart
            },
            echipa_gazda: {
                nume: verificare.homeTeam
            },
            echipa_oaspete: {
                nume: verificare.awayTeam
            },
            liga: verificare.liga,

            // Scor la pauză
            scor: {
                pauza_gazda: score.ht.home,
                pauza_oaspete: score.ht.away
            },

            // Statistici la pauză
            statistici: {
                suturi_pe_poarta: { pauza_gazda: 0, pauza_oaspete: 0 },
                total_suturi: { pauza_gazda: 0, pauza_oaspete: 0 },
                cornere: { repriza_1_gazda: 0, repriza_1_oaspete: 0 },  // Pattern checker așteaptă repriza_1_
                cartonase_galbene: { pauza_gazda: 0, pauza_oaspete: 0 },
                cartonase_rosii: { pauza_gazda: 0, pauza_oaspete: 0 },
                suturi_salvate: { pauza_gazda: 0, pauza_oaspete: 0 },
                faulturi: { pauza_gazda: 0, pauza_oaspete: 0 },
                ofsaiduri: { pauza_gazda: 0, pauza_oaspete: 0 },
                xG: { pauza_gazda: null, pauza_oaspete: null },
                posesie: { pauza_gazda: null, pauza_oaspete: null }
            },

            // Metadata
            timestampExtragere: Math.floor(Date.now() / 1000),
            dataExtragere: new Date().toISOString()
        };

        // Parsează statisticile FlashScore și mapează la format SMART 4
        // API-ul returnează secțiuni: prima "Top stats" = FT, a doua = HT, a treia = R2
        // Noi vrem DOAR secțiunea HT (a doua). Dacă nu există, folosim prima (FT) ca fallback.
        if (details.statsData && details.statsData.length > 0) {
            // Separăm secțiunile
            const sections = { ft: [], ht: [] };
            let topStatsCount = 0;
            let currentSection = null;

            for (const stat of details.statsData) {
                if (stat.SF && stat.SF === 'Top stats') {
                    topStatsCount++;
                    currentSection = topStatsCount === 1 ? 'ft' : topStatsCount === 2 ? 'ht' : null;
                    continue;
                }
                if (currentSection && stat.SG) {
                    sections[currentSection].push(stat);
                }
            }

            // Preferăm HT, fallback pe FT dacă HT lipsește
            const statsToUse = sections.ht.length > 0 ? sections.ht : sections.ft;
            const sectionUsed = sections.ht.length > 0 ? 'HT' : (sections.ft.length > 0 ? 'FT (fallback)' : 'NONE');
            logger.info(`      📊 Secțiune statistici: ${sectionUsed} (${statsToUse.length} stats)`);

            const parsedStats = new Set();
            statsToUse.forEach(stat => {
                const flashscoreName = stat.SG ? stat.SG.trim() : null;

                // Verifică dacă e una din statisticile noastre
                if (flashscoreName && STATS_MAPPING[flashscoreName]) {
                    const smart4Name = STATS_MAPPING[flashscoreName];
                    parsedStats.add(smart4Name);

                    // Cornere folosesc repriza_1_ în loc de pauza_
                    if (smart4Name === 'cornere') {
                        stats.statistici[smart4Name] = {
                            repriza_1_gazda: parseStatValue(stat.SH),
                            repriza_1_oaspete: parseStatValue(stat.SI)
                        };
                    } else if (smart4Name === 'xG') {
                        // xG e float (ex: "0.85", "1.23")
                        stats.statistici[smart4Name] = {
                            pauza_gazda: parseFloat(stat.SH) || null,
                            pauza_oaspete: parseFloat(stat.SI) || null
                        };
                    } else if (smart4Name === 'posesie') {
                        // Posesia vine ca "65%" sau "65"
                        stats.statistici[smart4Name] = {
                            pauza_gazda: parseInt(String(stat.SH).replace('%', '')) || null,
                            pauza_oaspete: parseInt(String(stat.SI).replace('%', '')) || null
                        };
                    } else {
                        stats.statistici[smart4Name] = {
                            pauza_gazda: parseStatValue(stat.SH),
                            pauza_oaspete: parseStatValue(stat.SI)
                        };
                    }
                }
            });

            // Log date lipsă
            const expectedStats = ['suturi_pe_poarta', 'total_suturi', 'cornere', 'posesie', 'faulturi', 'ofsaiduri'];
            const missing = expectedStats.filter(s => !parsedStats.has(s));
            if (missing.length > 0) {
                logger.info(`      ⚠️  Statistici lipsă: ${missing.join(', ')}`);
            }
        }

        // Log rezultate
        logger.info(`   ✅ Extragere completă!`);
        logger.info(`   Scor la pauză: ${score.ht.home}-${score.ht.away}`);
        logger.info(`   Statistici extrase (cei 8 parametri):`);
        logger.info(`      suturi_pe_poarta: ${stats.statistici.suturi_pe_poarta.pauza_gazda} - ${stats.statistici.suturi_pe_poarta.pauza_oaspete}`);
        logger.info(`      total_suturi: ${stats.statistici.total_suturi.pauza_gazda} - ${stats.statistici.total_suturi.pauza_oaspete}`);
        logger.info(`      cornere: ${stats.statistici.cornere.repriza_1_gazda} - ${stats.statistici.cornere.repriza_1_oaspete}`);
        logger.info('');

        // =====================================
        // 🎯 VERIFICARE PATTERN-URI
        // =====================================
        if (procenteLoader && procenteLoader.loaded) {
            logger.info(`   🎯 Verificare pattern-uri...`);

            // Pregătește date pentru pattern checker
            const matchData = {
                matchId: verificare.matchId,
                homeTeam: verificare.homeTeam,
                awayTeam: verificare.awayTeam,
                leagueName: verificare.liga,
                scor: stats.scor,
                statistici: stats.statistici
            };

            // Verifică pattern-uri
            const patternChecker = new PatternChecker();
            const patterns = patternChecker.checkAllPatterns(matchData);

            if (patterns.length === 0) {
                logger.info(`      ⚪ Niciun pattern găsit\n`);
            } else {
                logger.info(`      ✅ Găsite ${patterns.length} pattern-uri!`);

                // Pentru fiecare pattern, verifică probabilitatea
                const validPatterns = [];

                // Determină pragul minim pentru această ligă
                const minThreshold = getMinimumThreshold(verificare.liga);
                logger.info(`      📊 Prag probabilitate pentru ${verificare.liga}: ${minThreshold}%`);

                const allPatterns = []; // TOATE pattern-urile (inclusiv < threshold)

                // Pre-fetch pozițiile ambelor echipe (o singură dată, refolosim pentru toate pattern-urile)
                let homePosition = null, awayPosition = null;
                let homeTier = 'MID_6-10', awayTier = 'MID_6-10';

                for (const teamInfo of [
                    { name: matchData.homeTeam, side: 'gazda' },
                    { name: matchData.awayTeam, side: 'oaspete' }
                ]) {
                    if (!teamInfo.name) continue;
                    try {
                        const teamPos = await getTeamPosition(verificare.liga, teamInfo.name, null);
                        if (teamPos) {
                            const t = getTierFromPosition(teamPos.position, teamPos.totalTeams, verificare.liga);
                            if (teamInfo.side === 'gazda') {
                                homePosition = teamPos.position;
                                homeTier = t;
                            } else {
                                awayPosition = teamPos.position;
                                awayTier = t;
                            }
                            logger.info(`         📊 ${teamInfo.name}: Poziție ${teamPos.position}/${teamPos.totalTeams}, Tier: ${t}`);
                        } else {
                            // FALLBACK: caută în datele istorice (sezoane salvate)
                            const histPos = getPositionFromHistory(verificare.liga, teamInfo.name);
                            if (histPos && histPos.tier) {
                                if (teamInfo.side === 'gazda') {
                                    homePosition = histPos.position;
                                    homeTier = histPos.tier;
                                } else {
                                    awayPosition = histPos.position;
                                    awayTier = histPos.tier;
                                }
                                logger.info(`         📊 ${teamInfo.name}: Tier ${histPos.tier} (din date istorice: ${histPos.matchDate || 'N/A'})`);
                            } else {
                                logger.info(`         ⚠️  Nu am găsit clasament pentru ${teamInfo.name} (nici live, nici istoric)`);
                            }
                        }
                    } catch (scrapeError) {
                        // FALLBACK și la eroare de scraping
                        const histPos = getPositionFromHistory(verificare.liga, teamInfo.name);
                        if (histPos && histPos.tier) {
                            if (teamInfo.side === 'gazda') {
                                homePosition = histPos.position;
                                homeTier = histPos.tier;
                            } else {
                                awayPosition = histPos.position;
                                awayTier = histPos.tier;
                            }
                            logger.info(`         📊 ${teamInfo.name}: Tier ${histPos.tier} (fallback istoric, scraping eșuat: ${scrapeError.message})`);
                        } else {
                            logger.info(`         ⚠️  Eroare scraping + fără date istorice pentru ${teamInfo.name}: ${scrapeError.message}`);
                        }
                    }
                }

                for (const pattern of patterns) {
                    let tier, position;

                    if (pattern.team === 'gazda') {
                        tier = homeTier;
                        position = homePosition;
                    } else if (pattern.team === 'oaspete') {
                        tier = awayTier;
                        position = awayPosition;
                    } else {
                        // Pattern la nivel de meci — folosim cel mai bun tier (cel mai mare procent)
                        // Încercăm ambele tier-uri și alegem pe cel cu probabilitate mai mare
                        const probHome = procenteLoader.getPatternProbabilityWithFallback(verificare.liga, homeTier, pattern.name);
                        const probAway = procenteLoader.getPatternProbabilityWithFallback(verificare.liga, awayTier, pattern.name);

                        if (probHome && probAway) {
                            // Alegem tier-ul cu probabilitatea mai mare
                            if (probHome.procent >= probAway.procent) {
                                tier = homeTier;
                                position = homePosition;
                            } else {
                                tier = awayTier;
                                position = awayPosition;
                            }
                        } else if (probHome) {
                            tier = homeTier;
                            position = homePosition;
                        } else if (probAway) {
                            tier = awayTier;
                            position = awayPosition;
                        } else {
                            tier = homeTier; // fallback
                            position = homePosition;
                        }
                        logger.info(`         📊 Pattern meci — tier ales: ${tier} (gazdă: ${homeTier}, oaspete: ${awayTier})`);
                    }

                    // Obține probabilitatea pentru tier-ul calculat
                    const prob = procenteLoader.getPatternProbabilityWithFallback(
                        verificare.liga,
                        tier,
                        pattern.name
                    );

                    if (prob) {
                        // Calculează winning streak pentru echipa relevantă
                        let winStreak = null;
                        let streakProb = null;
                        try {
                            const streakTeam = pattern.team === 'gazda' ? matchData.homeTeam :
                                               pattern.team === 'oaspete' ? matchData.awayTeam : null;
                            if (streakTeam) {
                                const streak = getTeamStreak(verificare.liga, streakTeam);
                                if (streak.currentWinStreak >= 3) {
                                    winStreak = streak.currentWinStreak;
                                    // Verificăm stats per campionat pentru seria curentă
                                    const stats = getStreakStats(verificare.liga, streak.currentWinStreak);
                                    if (stats) {
                                        streakProb = stats; // { won, total, rate }
                                        logger.info(`         🔥 ${streakTeam}: ${streak.currentWinStreak} victorii la rând — ${stats.won}/${stats.total} (${stats.rate}%) au continuat`);
                                    }
                                }
                            } else {
                                // Pattern de meci — verificăm ambele echipe, luăm max
                                const streakHome = getTeamStreak(verificare.liga, matchData.homeTeam);
                                const streakAway = getTeamStreak(verificare.liga, matchData.awayTeam);
                                const best = streakHome.currentWinStreak >= streakAway.currentWinStreak
                                    ? { team: matchData.homeTeam, streak: streakHome }
                                    : { team: matchData.awayTeam, streak: streakAway };
                                if (best.streak.currentWinStreak >= 3) {
                                    winStreak = best.streak.currentWinStreak;
                                    const stats = getStreakStats(verificare.liga, best.streak.currentWinStreak);
                                    if (stats) {
                                        streakProb = stats;
                                        logger.info(`         🔥 ${best.team}: ${best.streak.currentWinStreak} victorii la rând — ${stats.won}/${stats.total} (${stats.rate}%) au continuat`);
                                    }
                                }
                            }
                        } catch (streakErr) {
                            logger.warn(`         ⚠️  Eroare calcul streak: ${streakErr.message}`);
                        }

                        // Calculează scoring streak (serie meciuri cu 2+ goluri)
                        let scoringStreak = null;
                        let scoringStreakProb = null;
                        try {
                            const scoringTeam = pattern.team === 'gazda' ? matchData.homeTeam :
                                                pattern.team === 'oaspete' ? matchData.awayTeam : null;
                            if (scoringTeam) {
                                const ss = getScoringStreak(verificare.liga, scoringTeam);
                                if (ss.currentScoringStreak >= 3) {
                                    scoringStreak = ss.currentScoringStreak;
                                    const ssStats = getScoringStreakStats(verificare.liga, ss.currentScoringStreak, tier);
                                    if (ssStats) {
                                        scoringStreakProb = ssStats;
                                        logger.info(`         ⚽ ${scoringTeam}: ${ss.currentScoringStreak} meciuri cu 2+ goluri — ${ssStats.scored}/${ssStats.total} (${ssStats.rate}%) au marcat și în următorul`);
                                    }
                                }
                            } else {
                                // Pattern de meci — verificăm ambele, luăm max
                                const ssHome = getScoringStreak(verificare.liga, matchData.homeTeam);
                                const ssAway = getScoringStreak(verificare.liga, matchData.awayTeam);
                                const bestSS = ssHome.currentScoringStreak >= ssAway.currentScoringStreak
                                    ? { team: matchData.homeTeam, streak: ssHome, tier: homeTier }
                                    : { team: matchData.awayTeam, streak: ssAway, tier: awayTier };
                                if (bestSS.streak.currentScoringStreak >= 3) {
                                    scoringStreak = bestSS.streak.currentScoringStreak;
                                    const ssStats = getScoringStreakStats(verificare.liga, bestSS.streak.currentScoringStreak, bestSS.tier);
                                    if (ssStats) {
                                        scoringStreakProb = ssStats;
                                        logger.info(`         ⚽ ${bestSS.team}: ${bestSS.streak.currentScoringStreak} meciuri cu 2+ goluri — ${ssStats.scored}/${ssStats.total} (${ssStats.rate}%) au marcat și în următorul`);
                                    }
                                }
                            }
                        } catch (ssErr) {
                            logger.warn(`         ⚠️  Eroare calcul scoring streak: ${ssErr.message}`);
                        }

                        // Calculează goal streak (serie meciuri cu 1+ gol)
                        let goalStreak = null;
                        let goalStreakProb = null;
                        try {
                            const goalTeam = pattern.team === 'gazda' ? matchData.homeTeam :
                                             pattern.team === 'oaspete' ? matchData.awayTeam : null;
                            if (goalTeam) {
                                const gs = getGoalStreak(verificare.liga, goalTeam);
                                if (gs.currentGoalStreak >= 5) {
                                    goalStreak = gs.currentGoalStreak;
                                    const gsStats = getGoalStreakStats(verificare.liga, gs.currentGoalStreak, tier);
                                    if (gsStats) {
                                        goalStreakProb = gsStats;
                                        logger.info(`         🎯 ${goalTeam}: ${gs.currentGoalStreak} meciuri consecutive cu gol — ${gsStats.scored}/${gsStats.total} (${gsStats.rate}%) au marcat și în următorul`);
                                    }
                                }
                            } else {
                                // Pattern de meci — verificăm ambele, luăm max
                                const gsHome = getGoalStreak(verificare.liga, matchData.homeTeam);
                                const gsAway = getGoalStreak(verificare.liga, matchData.awayTeam);
                                const bestGS = gsHome.currentGoalStreak >= gsAway.currentGoalStreak
                                    ? { team: matchData.homeTeam, streak: gsHome, tier: homeTier }
                                    : { team: matchData.awayTeam, streak: gsAway, tier: awayTier };
                                if (bestGS.streak.currentGoalStreak >= 5) {
                                    goalStreak = bestGS.streak.currentGoalStreak;
                                    const gsStats = getGoalStreakStats(verificare.liga, bestGS.streak.currentGoalStreak, bestGS.tier);
                                    if (gsStats) {
                                        goalStreakProb = gsStats;
                                        logger.info(`         🎯 ${bestGS.team}: ${bestGS.streak.currentGoalStreak} meciuri consecutive cu gol — ${gsStats.scored}/${gsStats.total} (${gsStats.rate}%) au marcat și în următorul`);
                                    }
                                }
                            }
                        } catch (gsErr) {
                            logger.warn(`         ⚠️  Eroare calcul goal streak: ${gsErr.message}`);
                        }

                        const patternWithProb = {
                            ...pattern,
                            tier: tier,
                            position: position,
                            probability: prob.procent,
                            isEstimate: prob.isEstimate,
                            cazuri: prob.cazuri || null,
                            succes: prob.succes || null,
                            winStreak: winStreak,
                            streakProb: streakProb,
                            scoringStreak: scoringStreak,
                            scoringStreakProb: scoringStreakProb,
                            goalStreak: goalStreak,
                            goalStreakProb: goalStreakProb
                        };

                        // Adaugă în TOATE pattern-urile
                        allPatterns.push(patternWithProb);

                        // Calculează xG echipei cu predicția
                        let xgTeam = null;
                        if (pattern.team === 'gazda') {
                            xgTeam = stats.statistici.xG.pauza_gazda;
                        } else if (pattern.team === 'oaspete') {
                            xgTeam = stats.statistici.xG.pauza_oaspete;
                        } else {
                            const xgH = stats.statistici.xG.pauza_gazda;
                            const xgA = stats.statistici.xG.pauza_oaspete;
                            // Doar dacă ambele sunt disponibile, calculăm suma
                            xgTeam = (xgH !== null && xgA !== null) ? xgH + xgA : null;
                        }

                        // Penalizare xG: dacă xG e disponibil și < 0.5, pragul crește cu 10%
                        // Fix: xG === 0 vine de la FlashScore când datele lipsesc, nu e xG real 0
                        const XG_PENALTY = 10;
                        const xgPenalty = (xgTeam !== null && xgTeam > 0 && xgTeam < 0.5) ? XG_PENALTY : 0;

                        // Penalizare diferență tier: echipa joacă contra tier superior
                        // LOW vs TOP: +5%, LOW vs MID / MID vs TOP: +3%
                        const teamTier = pattern.team === 'gazda' ? homeTier : (pattern.team === 'oaspete' ? awayTier : tier);
                        const oppTier = pattern.team === 'gazda' ? awayTier : (pattern.team === 'oaspete' ? homeTier : null);
                        const tierPenalty = oppTier ? getTierDifferencePenalty(teamTier, oppTier) : 0;

                        const effectiveThreshold = minThreshold + xgPenalty + tierPenalty;

                        // Adaugă în validPatterns doar dacă >= threshold efectiv
                        const penaltyParts = [];
                        if (xgPenalty > 0) penaltyParts.push(`xG ${xgTeam.toFixed(2)}<0.5 → +${xgPenalty}%`);
                        if (tierPenalty > 0) penaltyParts.push(`tier ${teamTier} vs ${oppTier} → +${tierPenalty}%`);
                        const penaltyStr = penaltyParts.length > 0 ? ` (${penaltyParts.join(', ')})` : '';

                        if (prob.procent >= effectiveThreshold) {
                            validPatterns.push(patternWithProb);
                            logger.info(`         ✅ ${pattern.name} (${pattern.team}): ${prob.procent}% >= ${effectiveThreshold}%${penaltyStr} - EMAIL + TRACKING`);
                        } else if (prob.procent >= minThreshold) {
                            logger.info(`         ⛔ ${pattern.name} (${pattern.team}): ${prob.procent}% >= ${minThreshold}% dar < ${effectiveThreshold}%${penaltyStr} - BLOCAT`);
                        } else {
                            logger.info(`         📊 ${pattern.name} (${pattern.team}): ${prob.procent}% < ${minThreshold}% - DOAR TRACKING`);
                        }
                    }
                }

                // Salvează TOATE pattern-urile în stats (pentru tracking)
                stats.patterns = allPatterns;

                // Dacă avem pattern-uri valide (>= threshold), FILTRĂM și trimitem EMAIL + TRACKING
                if (validPatterns.length > 0) {
                    logger.info(`\n      🎉 GĂSITE ${validPatterns.length} PATTERN-URI VALIDE (>=${minThreshold}%)!`);

                    // FILTRARE: păstrează doar cel mai bun pattern din fiecare categorie
                    const filteredPatterns = filterBestPatternsOnly(validPatterns);

                    // 🎯 Salvează în tracking DOAR pattern-urile FILTRATE (cel mai bun per categorie)
                    logger.info(`      📊 Salvare ${filteredPatterns.length} pattern-uri FILTRATE în tracking...`);
                    try {
                        for (const pattern of filteredPatterns) {
                            await NotificationTracker.addNotification({
                                matchId: verificare.matchId,
                                homeTeam: matchData.homeTeam,
                                awayTeam: matchData.awayTeam,
                                event: `${pattern.team === 'gazda' ? matchData.homeTeam : pattern.team === 'oaspete' ? matchData.awayTeam : 'Meci'} va marca în repriza 2`,
                                initialOdd: 1.25, // Default, va fi actualizat de ODDS_MONITOR
                                probability: pattern.probability,
                                pattern: {
                                    name: pattern.name,
                                    team: pattern.team,
                                    tier: pattern.tier,
                                    position: pattern.position,
                                    isEstimate: pattern.isEstimate
                                },
                                notificationSent: true
                            });

                            logger.info(`         ✅ ${pattern.name}: ${pattern.probability}% - Salvat pentru monitorizare cote`);
                        }
                    } catch (trackError) {
                        logger.error(`      ❌ Eroare salvare tracking: ${trackError.message}`);
                    }

                    // Trimite notificare email CU PATTERN-URI FILTRATE
                    if (emailNotifier && filteredPatterns.length > 0) {
                        logger.info(`      📧 Trimitere notificare email cu ${filteredPatterns.length} pattern-uri...`);
                        try {
                            const emailResult = await emailNotifier.sendNotificationWithMultiplePatterns(matchData, filteredPatterns);
                            if (emailResult) {
                                logger.info(`      ✅ Email trimis cu succes!\n`);
                            } else {
                                logger.error(`      ❌ Email NU a fost trimis (sendNotification returned false)\n`);
                            }
                        } catch (emailError) {
                            logger.error(`      ❌ Eroare trimitere email: ${emailError.message}\n`);
                        }
                    }
                } else if (allPatterns.length > 0) {
                    logger.info(`\n      📊 ${allPatterns.length} pattern-uri detectate (< ${minThreshold}%) - NU se salvează în tracking (nu se monitorizează cote)\n`);
                } else {
                    logger.info(`\n      ⚪ Niciun pattern detectat\n`);
                }
            }
        }

        return stats;

    } catch (error) {
        logger.error(`   ❌ Eroare la extragere: ${error.message}\n`);
        return null;
    }
}

/**
 * Salvează statistici în fișier JSON
 */
function saveStats(stats, verificare) {
    const filename = `stats-${verificare.matchId}-HT.json`;
    const filepath = path.join(__dirname, filename);

    fs.writeFileSync(filepath, JSON.stringify(stats, null, 2), 'utf8');

    logger.info(`   💾 Salvat: ${filename}\n`);
    return filename;
}

/**
 * Filtrează pattern-uri în 2 pași:
 *
 * Pas 1: Per categorie × echipă → păstrează doar cel mai bun pattern
 *   Categorii: PATTERN_1.x, PATTERN_2.x, PATTERN_3.x, etc.
 *   Grupare pe: categorie + echipă (gazda/oaspete/meci)
 *
 * Pas 2: Din rezultatele Pas 1 → păstrează maxim 2 pattern-uri
 *   (cele cu probabilitatea cea mai mare)
 *
 * @param {Array} patterns - Pattern-uri cu probabilități calculate
 * @returns {Array} - Pattern-uri filtrate (maxim 2 per meci)
 */
function filterBestPatternsOnly(patterns) {
    if (patterns.length === 0) return patterns;

    const MAX_PATTERNS_PER_MATCH = 2;

    logger.info(`\n   🔍 Filtrare pattern-uri (2 pași)...`);
    logger.info(`      Pattern-uri inițiale: ${patterns.length}`);

    // === PAS 1: Cel mai bun pattern per categorie × echipă ===
    const groups = {};
    for (const p of patterns) {
        // Extrage categoria: PATTERN_3.4 → "3", PATTERN_12.1 → "12", PATTERN_8.3.2.3 → "8"
        const match = p.name.match(/PATTERN_(\d+)/);
        const category = match ? match[1] : p.name;
        const team = p.team || 'meci';
        const key = category + '_' + team;

        if (!groups[key] || p.probability > groups[key].probability) {
            groups[key] = p;
        }
    }

    const afterStep1 = Object.values(groups);
    logger.info(`      Pas 1 (cel mai bun per categorie×echipă): ${patterns.length} → ${afterStep1.length}`);

    for (const p of afterStep1) {
        logger.info(`         • ${p.name} (${p.team || 'meci'}) - ${p.probability}%`);
    }

    // === PAS 2: Maxim MAX_PATTERNS_PER_MATCH, cele mai bune probabilități ===
    const sorted = [...afterStep1].sort((a, b) => b.probability - a.probability);
    const best = sorted.slice(0, MAX_PATTERNS_PER_MATCH);

    if (afterStep1.length > MAX_PATTERNS_PER_MATCH) {
        logger.info(`      Pas 2 (maxim ${MAX_PATTERNS_PER_MATCH} per meci):`);
        for (const p of best) {
            logger.info(`         ✅ Păstrat: ${p.name} (${p.team || 'meci'}) - ${p.probability}%`);
        }
        for (let i = MAX_PATTERNS_PER_MATCH; i < sorted.length; i++) {
            logger.info(`         ↳ Eliminat: ${sorted[i].name} (${sorted[i].team || 'meci'}) - ${sorted[i].probability}%`);
        }
    } else {
        for (const p of best) {
            logger.info(`      ✅ Păstrat: ${p.name} (${p.team || 'meci'}) - ${p.probability}%`);
        }
    }

    logger.info(`      Rezultat final: ${best.length} pattern-uri\n`);

    return best;
}

/**
 * Actualizează status verificare în fișierul de program
 */
function updateVerificationStatus(scheduleFile, matchId, status, statsFile = null) {
    const schedule = JSON.parse(fs.readFileSync(scheduleFile, 'utf8'));

    const verificare = schedule.verificari.find(v => v.matchId === matchId);
    if (verificare) {
        verificare.status = status;
        if (statsFile) {
            verificare.statsFile = statsFile;
        }
        verificare.completedAt = new Date().toISOString();
    }

    fs.writeFileSync(scheduleFile, JSON.stringify(schedule, null, 2), 'utf8');
}

/**
 * Verifică dacă a sosit timpul pentru o verificare
 */
function isTimeForCheck(verificare, nowTimestamp) {
    const timeDiff = nowTimestamp - verificare.timestampVerificare;

    // Suntem în fereastra de timp?
    return timeDiff >= -TIME_TOLERANCE_BEFORE && timeDiff <= TIME_TOLERANCE_AFTER;
}

/**
 * Verifică și creează lock file pentru a preveni multiple instanțe
 */
function acquireLock() {
    const lockFile = path.join(__dirname, '.monitor.lock');

    // Verifică dacă există deja un lock file
    if (fs.existsSync(lockFile)) {
        try {
            const lockData = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
            const oldPid = lockData.pid;

            // Verifică dacă procesul vechi încă rulează
            try {
                process.kill(oldPid, 0); // Signal 0 = verificare existență, nu ucide procesul
                logger.error(`\n❌ EROARE: Un alt monitor rulează deja (PID: ${oldPid})`);
                logger.error(`\n💡 Pentru a opri monitorul existent, rulează:`);
                logger.error(`   kill ${oldPid}\n`);
                logger.error(`   sau`);
                logger.error(`   pkill -f "API-SMART-5.js monitor"\n`);
                process.exit(1);
            } catch (e) {
                // Procesul nu mai rulează, ștergem lock-ul vechi
                logger.info(`⚠️  Lock file găsit pentru proces mort (PID: ${oldPid}), cleanup...`);
                fs.unlinkSync(lockFile);
            }
        } catch (error) {
            // Lock file corupt, îl ștergem
            logger.info(`⚠️  Lock file corupt, cleanup...`);
            fs.unlinkSync(lockFile);
        }
    }

    // Creează lock file nou
    const lockData = {
        pid: process.pid,
        startTime: new Date().toISOString(),
        startTimeRo: new Date().toLocaleString('ro-RO')
    };

    fs.writeFileSync(lockFile, JSON.stringify(lockData, null, 2));
    logger.info(`🔒 Lock file creat: PID ${process.pid}\n`);

    return lockFile;
}

/**
 * Eliberează lock file
 * @param {boolean} silent - Dacă true, nu logează (folosit în exit handler)
 */
// ============================================================
// HEALTH ALERT — alertă email dacă rata de eșec e mare
// ============================================================
const HEALTH_ALERT_FILE = path.join(__dirname, 'data', 'health_alert_sent.json');

function isHealthAlertSent() {
    try {
        if (fs.existsSync(HEALTH_ALERT_FILE)) {
            const sent = JSON.parse(fs.readFileSync(HEALTH_ALERT_FILE, 'utf8'));
            return sent.date === new Date().toISOString().split('T')[0];
        }
    } catch (e) {}
    return false;
}

async function sendHealthAlertIfNeeded(schedule, scheduleFile) {
    if (isHealthAlertSent()) return;

    const verificari = schedule.verificari || [];
    const total = verificari.length;
    if (total === 0) return;

    const completate = verificari.filter(v => v.status === 'completat').length;
    const erori = verificari.filter(v => v.status === 'eroare').length;
    const programate = verificari.filter(v => v.status === 'programat').length;

    // Alertă doar dacă toate sunt procesate și rata de eșec > 10%
    if (programate > 0) return;
    const rataEsec = Math.round((erori / total) * 100);
    if (rataEsec <= 10) {
        logger.info(`   ✅ Health check OK: ${completate}/${total} completate (${rataEsec}% eșec)`);
        // Marchează trimis chiar dacă nu trimite alertă (nu re-verifica)
        const today = new Date().toISOString().split('T')[0];
        fs.writeFileSync(HEALTH_ALERT_FILE, JSON.stringify({ date: today, status: 'ok', rate: rataEsec }, null, 2), 'utf8');
        return;
    }

    // Construiește lista de meciuri eșuate
    const failed = verificari.filter(v => v.status === 'eroare');
    let failList = failed.map(v => `• ${v.oraVerificare || '??:??'} | ${v.homeTeam} vs ${v.awayTeam} | ${v.liga}`).join('<br>');

    const today = new Date().toISOString().split('T')[0];
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #c62828, #b71c1c); color: white; padding: 20px; border-radius: 12px 12px 0 0;">
            <h2 style="margin: 0;">🚨 ALERTĂ SISTEM — RATĂ EȘEC RIDICATĂ</h2>
            <div style="font-size: 14px; opacity: 0.9; margin-top: 8px;">${today}</div>
            <div style="font-size: 20px; font-weight: bold; margin-top: 10px;">${erori}/${total} verificări eșuate (${rataEsec}%)</div>
        </div>
        <div style="background: white; padding: 16px; border: 1px solid #e0e0e0;">
            <h3 style="color: #c62828; margin-top: 0;">Meciuri neverificate la pauză:</h3>
            <div style="font-size: 13px; color: #333; line-height: 1.8;">${failList}</div>
            <hr style="margin: 16px 0; border: none; border-top: 1px solid #e0e0e0;">
            <div style="font-size: 12px; color: #999;">
                <strong>Completate:</strong> ${completate} | <strong>Eșuate:</strong> ${erori} | <strong>Total:</strong> ${total}<br>
                Cauze posibile: erori rețea TLS, supraîncărcare conexiuni Superbet, API FlashScore indisponibil
            </div>
        </div>
        <div style="background: #c62828; color: white; padding: 10px 16px; border-radius: 0 0 12px 12px; font-size: 11px; text-align: center;">
            Alertă automată API SMART 5 — verifică logurile pentru detalii
        </div>
    </div>`;

    try {
        const emailService = require('./EMAIL_SERVICE');
        const result = await emailService.send({
            subject: `🚨 ALERTĂ: ${erori}/${total} meciuri NEVERIFICATE (${rataEsec}% eșec) — ${today}`,
            html: html
        });
        if (result.success) {
            fs.writeFileSync(HEALTH_ALERT_FILE, JSON.stringify({ date: today, status: 'alert_sent', rate: rataEsec }, null, 2), 'utf8');
            logger.info(`   🚨 HEALTH ALERT trimis: ${erori}/${total} eșuate (${rataEsec}%)`);
        }
    } catch (e) {
        logger.error(`   ❌ Eroare health alert: ${e.message}`);
    }
}

function releaseLock(lockFile, silent = false) {
    if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
        if (!silent) {
            logger.info(`🔓 Lock file șters\n`);
        }
    }
}

/**
 * Main monitoring loop
 */
async function monitorSchedule(scheduleFile) {
    logger.info(`\n🔍 STATS MONITOR - START\n`);
    logger.info(`📂 Fișier program: ${path.basename(scheduleFile)}`);
    logger.info(`⏱️  Interval verificare: ${CHECK_INTERVAL / 1000} secunde`);
    logger.info(`📅 Data: ${formatDate()}\n`);

    // Verifică și creează lock pentru a preveni multiple instanțe
    const lockFile = acquireLock();

    // Citește programul
    if (!fs.existsSync(scheduleFile)) {
        logger.error(`❌ Fișierul nu există: ${scheduleFile}`);
        releaseLock(lockFile);
        return;
    }

    const schedule = JSON.parse(fs.readFileSync(scheduleFile, 'utf8'));

    if (schedule.verificari.length === 0) {
        logger.info('⚠️  Nu sunt verificări programate momentan.\n');
        logger.info('🔄 Monitorizare continuă activă - sistemul va verifica din nou la fiecare minut.\n');
    } else {
        logger.info(`📊 Total verificări: ${schedule.verificari.length}\n`);
        logger.info('🕐 PROGRAM:\n');
        schedule.verificari.forEach((v, idx) => {
            logger.info(`${idx + 1}. ${v.oraVerificare} - ${v.homeTeam} vs ${v.awayTeam} [${v.status}]`);
        });
    }
    logger.info('\n' + '='.repeat(60));
    logger.info('🚀 Monitorizare activă...\n');

    // Initialize ProcenteLoader și EmailNotifier
    logger.info('📊 Încărcare JSON PROCENTE...');
    const procenteLoader = new ProcenteLoader();
    if (!procenteLoader.load()) {
        logger.error('❌ Nu am putut încărca JSON PROCENTE - pattern checking DEZACTIVAT\n');
    } else {
        logger.info('✅ JSON PROCENTE încărcat cu succes!\n');
    }

    const emailNotifier = new EmailNotifier();
    logger.info('✅ EmailNotifier inițializat!\n');

    // Loop de monitorizare
    let checksCount = 0;

    lifecycle.setInterval('stats-monitor', async () => {
        checksCount++;
        const now = Date.now() / 1000;
        const nowDate = new Date();

        logger.info(`[${nowDate.toLocaleTimeString('ro-RO')}] Check #${checksCount}`);

        // Verifică dacă trebuie trimise emailuri pre-meci
        try {
            await checkAndSendPreMatchEmails();
        } catch (e) {
            logger.error(`   ⚠️  Eroare checkPreMatch: ${e.message}`);
        }

        // Email zilnic sugestii goluri + cartonașe (trimite o dată pe zi, la ora 10)
        if (nowDate.getHours() >= 10) {
            try {
                await sendGoalsCardsEmail();
            } catch (e) {
                logger.error(`   ⚠️  Eroare sendGoalsCardsEmail: ${e.message}`);
            }
        }

        // PLAYOFF DISCOVERY — DEZACTIVAT
        // FlashScore nu adaugă meciuri noi în cursul zilei.
        // Clasificarea playoff/playout se face corect la generarea listei (fixRomaniaLeagueName).
        // Puppeteer discovery genera sute de match ID-uri istorice cu "Unknown vs Unknown".

        // REFRESH MECIURI la 13:00 - prinde meciuri adăugate târziu de FlashScore
        const refreshHour = 13;
        const refreshKey = `refresh_${nowDate.toISOString().split('T')[0]}`;
        if (nowDate.getHours() === refreshHour && nowDate.getMinutes() < 2 && !monitorSchedule._refreshDone?.[refreshKey]) {
            try {
                logger.info('🔄 REFRESH MECIURI 13:00 - verificare meciuri noi pe FlashScore...');
                const refreshResult = await refreshDailyMatches();
                if (refreshResult && refreshResult.added > 0) {
                    logger.info(`   ✅ Adăugate ${refreshResult.added} meciuri noi! Regenerez programul...`);
                    // Regenerează schedule-ul cu meciurile noi
                    const { generateCheckSchedule } = require('./GENERATE_CHECK_SCHEDULE');
                    const matchesFile = path.join(__dirname, `meciuri-${nowDate.getFullYear()}-${String(nowDate.getMonth()+1).padStart(2,'0')}-${String(nowDate.getDate()).padStart(2,'0')}.json`);
                    generateCheckSchedule(matchesFile);
                    logger.info('   ✅ Program verificări regenerat cu meciurile noi!');
                } else {
                    logger.info('   ✅ Niciun meci nou de adăugat');
                }
            } catch (e) {
                logger.error(`   ⚠️  Eroare refresh meciuri: ${e.message}`);
            }
            if (!monitorSchedule._refreshDone) monitorSchedule._refreshDone = {};
            monitorSchedule._refreshDone[refreshKey] = true;
        }

        // VERIFICARE ROMANIA 13:05 - raport playoff + playout
        const verifyKey = `verify_romania_${nowDate.toISOString().split('T')[0]}`;
        if (nowDate.getHours() === 13 && nowDate.getMinutes() >= 5 && nowDate.getMinutes() < 7 && !monitorSchedule._refreshDone?.[verifyKey]) {
            try {
                const matchesFilePath = path.join(__dirname, `meciuri-${nowDate.getFullYear()}-${String(nowDate.getMonth()+1).padStart(2,'0')}-${String(nowDate.getDate()).padStart(2,'0')}.json`);
                if (fs.existsSync(matchesFilePath)) {
                    const matchesData = JSON.parse(fs.readFileSync(matchesFilePath, 'utf8'));
                    const { fixRomaniaLeagueName } = require('./DAILY_MATCHES');
                    // Corectează clasificarea înainte de numărare
                    const romaniaMatches = matchesData.meciuri
                        .filter(m => m.liga.toLowerCase().includes('romania'))
                        .map(m => ({ ...m, liga: fixRomaniaLeagueName(m.liga, m.homeTeam, m.awayTeam) }));
                    const playoff = romaniaMatches.filter(m => m.liga.includes('Championship'));
                    const playout = romaniaMatches.filter(m => m.liga.includes('Relegation'));

                    logger.info('🇷🇴 VERIFICARE ROMANIA 13:05:');
                    logger.info(`   Championship Group (playoff): ${playoff.length} meciuri`);
                    playoff.forEach(m => logger.info(`     ⚽ ${m.ora} ${m.homeTeam} vs ${m.awayTeam}`));
                    logger.info(`   Relegation Group (playout): ${playout.length} meciuri`);
                    playout.forEach(m => logger.info(`     ⚽ ${m.ora} ${m.homeTeam} vs ${m.awayTeam}`));

                    if (playoff.length === 0 && playout.length === 0) {
                        logger.info('   ⚠️  Niciun meci românesc azi — skip verificare + email');
                    } else {
                        if (playoff.length === 0 && playout.length > 0) {
                            logger.info('   ⚠️  ATENȚIE: Doar playout, fără playoff!');
                        } else {
                            logger.info('   ✅ Ambele grupe prezente!');
                        }

                        // Trimite email doar dacă avem meciuri românești
                        const emailService = require('./EMAIL_SERVICE');
                        const subject = `🇷🇴 Verificare Romania: ${playoff.length} playoff + ${playout.length} playout`;
                        let body = `<h2>Verificare meciuri România - ${matchesData.data}</h2>`;
                        body += `<h3>Championship Group (playoff): ${playoff.length} meciuri</h3>`;
                        if (playoff.length > 0) {
                            body += '<ul>' + playoff.map(m => `<li>${m.ora} - ${m.homeTeam} vs ${m.awayTeam}</li>`).join('') + '</ul>';
                        } else {
                            body += '<p>Niciun meci playoff azi</p>';
                        }
                        body += `<h3>Relegation Group (playout): ${playout.length} meciuri</h3>`;
                        if (playout.length > 0) {
                            body += '<ul>' + playout.map(m => `<li>${m.ora} - ${m.homeTeam} vs ${m.awayTeam}</li>`).join('') + '</ul>';
                        } else {
                            body += '<p>Niciun meci playout azi</p>';
                        }
                        body += `<p><small>Total meciuri colectate: ${matchesData.totalMatches} | Generat: ${matchesData.generatedAt}${matchesData.lastRefresh ? ' | Refresh: ' + matchesData.lastRefresh : ''}</small></p>`;
                        await emailService.send({ subject, html: body });
                        logger.info('   📧 Email verificare România trimis!');
                    }
                }
            } catch (e) {
                logger.error(`   ⚠️  Eroare verificare România: ${e.message}`);
            }
            if (!monitorSchedule._refreshDone) monitorSchedule._refreshDone = {};
            monitorSchedule._refreshDone[verifyKey] = true;
        }

        // Re-citește programul (pentru status actualizat)
        const currentSchedule = JSON.parse(fs.readFileSync(scheduleFile, 'utf8'));

        // Găsește verificările care trebuie executate ACUM
        const pendingChecks = currentSchedule.verificari.filter(v =>
            v.status === 'programat' && isTimeForCheck(v, now)
        );

        if (pendingChecks.length > 0) {
            logger.info(`   ⚡ Găsite ${pendingChecks.length} verificări de executat!\n`);

            // Execută fiecare verificare
            for (const verificare of pendingChecks) {
                // Marchează ca "in progress"
                updateVerificationStatus(scheduleFile, verificare.matchId, 'in_progress');

                // Extrage statistici (cu pattern checking + email) - PASS procenteLoader și emailNotifier din scope
                // RETRY: dacă eșuează (eroare rețea), reîncearcă de 2 ori cu delay
                let stats = null;
                const MAX_HT_RETRIES = 3;
                for (let htAttempt = 1; htAttempt <= MAX_HT_RETRIES; htAttempt++) {
                    stats = await extractMatchStats(verificare, procenteLoader, emailNotifier);
                    if (stats) break;
                    if (htAttempt < MAX_HT_RETRIES) {
                        const delayMs = htAttempt * 60000; // 1 min, apoi 2 min
                        logger.info(`   🔄 Extragere eșuată (încercarea ${htAttempt}/${MAX_HT_RETRIES}), retry în ${delayMs / 1000}s...`);
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                    }
                }

                if (stats) {
                    // Salvează statistici
                    const statsFile = saveStats(stats, verificare);

                    // Marchează ca "completat"
                    updateVerificationStatus(scheduleFile, verificare.matchId, 'completat', statsFile);

                    logger.info(`   ✅ Verificare completă: ${verificare.homeTeam} vs ${verificare.awayTeam}\n`);
                } else {
                    // Marchează ca "eroare"
                    updateVerificationStatus(scheduleFile, verificare.matchId, 'eroare');
                    logger.info(`   ❌ Verificare eșuată după ${MAX_HT_RETRIES} încercări: ${verificare.homeTeam} vs ${verificare.awayTeam}\n`);
                }
            }
        } else {
            // Afișează următoarea verificare
            const remaining = currentSchedule.verificari.filter(v => v.status === 'programat');
            if (remaining.length > 0) {
                const next = remaining[0];
                const timeUntil = next.timestampVerificare - now;
                const minutesUntil = Math.floor(timeUntil / 60);
                logger.info(`   ⏳ Următoarea verificare: ${next.oraVerificare} (${next.homeTeam} vs ${next.awayTeam}) - în ${minutesUntil} minute`);
            } else {
                logger.info(`   ✅ Toate verificările au fost completate! Monitorizare continuă activă...`);

                // HEALTH CHECK: trimite alertă dacă rata de eșec e mare
                await sendHealthAlertIfNeeded(currentSchedule, scheduleFile);
            }
        }

    }, CHECK_INTERVAL);

    // Cleanup la exit (SIGINT, SIGTERM, etc.)
    const cleanup = () => {
        logger.info('\n\n🛑 Monitor oprit manual.\n');
        lifecycle.clearInterval('stats-monitor');
        releaseLock(lockFile);
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    // Exit handler - silent mode pentru a evita logging după ce logger.end() a fost apelat
    process.on('exit', () => releaseLock(lockFile, true));
}

/**
 * Main function
 */
function main() {
    const args = process.argv.slice(2);

    // Determină fișierul de program
    let scheduleFile;
    if (args.length > 0) {
        scheduleFile = args[0];
    } else {
        // Folosește fișierul pentru data curentă
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        scheduleFile = path.join(__dirname, `verificari-${year}-${month}-${day}.json`);
    }

    if (!fs.existsSync(scheduleFile)) {
        logger.error(`\n❌ Fișierul nu există: ${scheduleFile}\n`);
        logger.info('💡 Generează mai întâi programul cu:');
        logger.info('   node GENERATE_CHECK_SCHEDULE.js\n');
        process.exit(1);
    }

    monitorSchedule(scheduleFile);
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    monitorSchedule,
    extractMatchStats
};
