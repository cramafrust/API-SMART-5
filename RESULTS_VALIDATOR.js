/**
 * ✅ RESULTS_VALIDATOR.js
 *
 * Validează rezultatele pentru pattern-urile trimise în notificări
 *
 * FUNCȚIONALITATE:
 * - Găsește notificări nevalidate
 * - Extrage date finale pentru meciuri (FT stats)
 * - Verifică dacă pattern-ul a ieșit sau nu
 * - Actualizează tracking cu rezultat
 * - Generează raport performanță
 *
 * VALIDĂRI SUPORTATE:
 * - Over/Under goluri (echipă/meci)
 * - BTTS (Both Teams To Score)
 * - Cornere (echipă/meci)
 * - Cartonașe (echipă/meci)
 *
 * USAGE:
 *   node RESULTS_VALIDATOR.js validate     # Validează toate notificările pending
 *   node RESULTS_VALIDATOR.js report       # Raport performanță
 *   node RESULTS_VALIDATOR.js match <matchId>  # Validează un meci specific
 */

const NotificationTracker = require('./NOTIFICATION_TRACKER');
const { extractFinalStats } = require('./FINAL_STATS_EXTRACTOR');
const fs = require('fs');
const path = require('path');

/**
 * Caută datele unui meci în fișierele daily_collected_*.json
 * Folosește datele colectate dimineața în loc de request-uri noi la API
 */
function findMatchInCollectedData(matchId, homeTeam, awayTeam) {
    try {
        const baseDir = path.join(__dirname);

        // Caută fișierele daily_collected din ultimele 7 zile
        const now = new Date();
        for (let i = 0; i < 7; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const filePath = path.join(baseDir, `daily_collected_${dateStr}.json`);

            if (!fs.existsSync(filePath)) continue;

            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const matches = data.matches || data.meciuri || (Array.isArray(data) ? data : []);

            // Caută după matchId sau după echipe
            const found = matches.find(m => {
                const mId = m.metadata?.matchId || m.matchId;
                if (mId && mId === matchId) return true;

                const mHome = m.match?.homeTeam || m.homeTeam;
                const mAway = m.match?.awayTeam || m.awayTeam;
                if (mHome === homeTeam && mAway === awayTeam) return true;

                return false;
            });

            if (found && found.fulltime && found.halftime) {
                console.log(`   📂 Găsit în daily_collected_${dateStr}.json`);
                return found;
            }
        }

        return null;
    } catch (error) {
        console.log(`   ⚠️  Eroare căutare date colectate: ${error.message}`);
        return null;
    }
}

/**
 * Validează un pattern de tip OVER/UNDER Goluri
 */
function validateGoalsPattern(patternName, team, actualGoals) {
    // Extract threshold from pattern name
    if (patternName.includes('OVER_2_5')) {
        return actualGoals > 2.5;
    }
    if (patternName.includes('OVER_3_5')) {
        return actualGoals > 3.5;
    }
    if (patternName.includes('OVER_1_5')) {
        return actualGoals > 1.5;
    }
    if (patternName.includes('UNDER_2_5')) {
        return actualGoals < 2.5;
    }

    // Default: unknown pattern
    return null;
}

/**
 * Calculează golurile marcate în REPRIZA 2
 */
function calculateR2Goals(fulltime, halftime) {
    const ftHome = parseInt(fulltime.score.home) || 0;
    const ftAway = parseInt(fulltime.score.away) || 0;
    const htHome = parseInt(halftime.score.home) || 0;
    const htAway = parseInt(halftime.score.away) || 0;

    return {
        home: ftHome - htHome,
        away: ftAway - htAway,
        total: (ftHome - htHome) + (ftAway - htAway)
    };
}

/**
 * Extrage cornere R2 din statistici (dacă sunt disponibile)
 * CORECTAT: Folosește datele DIRECTE din secondhalf, nu calcul FT - HT
 * Suportă ambele formate: 'Corner Kicks' (API) și 'corners' (salvat)
 */
function calculateR2Corners(fulltime, halftime, secondhalf) {
    // PRIORITATE 1: Folosește datele DIRECTE din secondhalf (dacă există)
    // Suportă ambele structuri: { home, away } și { statistics: { home, away } }
    const r2Home = secondhalf?.home || secondhalf?.statistics?.home;
    const r2Away = secondhalf?.away || secondhalf?.statistics?.away;

    if (r2Home && r2Away) {
        let r2HomeCorners = parseInt(r2Home['Corner Kicks']);
        let r2AwayCorners = parseInt(r2Away['Corner Kicks']);

        // Dacă nu găsește, încearcă format camelCase
        if (isNaN(r2HomeCorners)) {
            r2HomeCorners = parseInt(r2Home.corners);
            r2AwayCorners = parseInt(r2Away.corners);
        }

        if (!isNaN(r2HomeCorners) && !isNaN(r2AwayCorners)) {
            return {
                home: r2HomeCorners,
                away: r2AwayCorners,
                total: r2HomeCorners + r2AwayCorners,
                hasData: true,
                source: 'secondhalf_direct'
            };
        }
    }

    // FALLBACK: Calculează din FT - HT (metoda veche)
    let ftHomeCorners = parseInt(fulltime.statistics?.home?.['Corner Kicks']);
    let ftAwayCorners = parseInt(fulltime.statistics?.away?.['Corner Kicks']);
    let htHomeCorners = parseInt(halftime.statistics?.home?.['Corner Kicks']);
    let htAwayCorners = parseInt(halftime.statistics?.away?.['Corner Kicks']);

    // Dacă nu găsește, încearcă format camelCase (date salvate)
    if (isNaN(ftHomeCorners)) {
        ftHomeCorners = parseInt(fulltime.statistics?.home?.corners);
        ftAwayCorners = parseInt(fulltime.statistics?.away?.corners);
    }
    if (isNaN(htHomeCorners)) {
        htHomeCorners = parseInt(halftime.statistics?.home?.corners);
        htAwayCorners = parseInt(halftime.statistics?.away?.corners);
    }

    // Verifică dacă avem date valide (nu null/undefined/NaN)
    const hasData = !isNaN(ftHomeCorners) && !isNaN(ftAwayCorners) &&
                    !isNaN(htHomeCorners) && !isNaN(htAwayCorners);

    if (!hasData) {
        return null; // Nu avem date despre cornere
    }

    return {
        home: ftHomeCorners - htHomeCorners,
        away: ftAwayCorners - htAwayCorners,
        total: (ftHomeCorners - htHomeCorners) + (ftAwayCorners - htAwayCorners),
        hasData: true,
        source: 'calculated_ft_minus_ht' // Pentru debugging
    };
}

/**
 * Extrage cartonașe R2 din statistici (dacă sunt disponibile)
 * CORECTAT: Folosește datele DIRECTE din secondhalf, nu calcul FT - HT
 * Suportă ambele formate: 'Yellow Cards' (API) și 'yellowCards' (salvat)
 */
function calculateR2Cards(fulltime, halftime, secondhalf) {
    // PRIORITATE 1: Folosește datele DIRECTE din secondhalf (dacă există)
    // Suportă ambele structuri: { home, away } și { statistics: { home, away } }
    const r2Home = secondhalf?.home || secondhalf?.statistics?.home;
    const r2Away = secondhalf?.away || secondhalf?.statistics?.away;

    if (r2Home && r2Away) {
        let r2HomeCards = parseInt(r2Home['Yellow Cards']);
        let r2AwayCards = parseInt(r2Away['Yellow Cards']);

        // Dacă nu găsește, încearcă format camelCase
        if (isNaN(r2HomeCards)) {
            r2HomeCards = parseInt(r2Home.yellowCards);
            r2AwayCards = parseInt(r2Away.yellowCards);
        }

        if (!isNaN(r2HomeCards) && !isNaN(r2AwayCards)) {
            return {
                home: r2HomeCards,
                away: r2AwayCards,
                total: r2HomeCards + r2AwayCards,
                hasData: true,
                source: 'secondhalf_direct'
            };
        }
    }

    // FALLBACK: Calculează din FT - HT (metoda veche)
    let ftHomeCards = parseInt(fulltime.statistics?.home?.['Yellow Cards']);
    let ftAwayCards = parseInt(fulltime.statistics?.away?.['Yellow Cards']);
    let htHomeCards = parseInt(halftime.statistics?.home?.['Yellow Cards']);
    let htAwayCards = parseInt(halftime.statistics?.away?.['Yellow Cards']);

    // Dacă nu găsește, încearcă format camelCase (date salvate)
    if (isNaN(ftHomeCards)) {
        ftHomeCards = parseInt(fulltime.statistics?.home?.yellowCards);
        ftAwayCards = parseInt(fulltime.statistics?.away?.yellowCards);
    }
    if (isNaN(htHomeCards)) {
        htHomeCards = parseInt(halftime.statistics?.home?.yellowCards);
        htAwayCards = parseInt(halftime.statistics?.away?.yellowCards);
    }

    // Verifică dacă avem date valide (nu null/undefined/NaN)
    const hasData = !isNaN(ftHomeCards) && !isNaN(ftAwayCards) &&
                    !isNaN(htHomeCards) && !isNaN(htAwayCards);

    if (!hasData) {
        return null; // Nu avem date despre cartonașe
    }

    return {
        home: ftHomeCards - htHomeCards,
        away: ftAwayCards - htAwayCards,
        total: (ftHomeCards - htHomeCards) + (ftAwayCards - htAwayCards),
        hasData: true,
        source: 'calculated_ft_minus_ht' // Pentru debugging
    };
}

/**
 * Validează pattern BTTS (Both Teams To Score)
 */
function validateBTTSPattern(patternName, homeGoals, awayGoals) {
    if (patternName.includes('BTTS_GOLURI_AMBELE')) {
        return homeGoals > 0 && awayGoals > 0;
    }
    if (patternName.includes('BTTS_NU')) {
        return homeGoals === 0 || awayGoals === 0;
    }

    return null;
}

/**
 * Validează pattern de cornere
 */
function validateCornersPattern(patternName, team, actualCorners, totalMatchCorners) {
    if (patternName.includes('OVER_CORNERE_MECI')) {
        return totalMatchCorners > 9.5;
    }
    if (patternName.includes('OVER_CORNERE_R2')) {
        // Pentru repriza 2, trebuie să avem statistici separate
        // Deocamdată aproximăm: dacă total corners > 6, probabil și R2 > 3.5
        return actualCorners > 3.5;
    }

    return null;
}

/**
 * Validează pattern de cartonașe
 */
function validateCardsPattern(patternName, team, actualCards, totalMatchCards) {
    if (patternName.includes('CARTONASE_MECI')) {
        return totalMatchCards > 4.5;
    }
    if (patternName.includes('CARTONASE_R2')) {
        return actualCards > 2.5;
    }

    return null;
}

/**
 * Validează un pattern individual
 */
function validatePattern(pattern, matchData) {
    const patternName = pattern.patternName || pattern.name || '';
    const team = pattern.team;
    const teamName = pattern.teamName || pattern.team || '';
    const { fulltime, halftime, secondhalf } = matchData;

    let result = {
        pattern: patternName,
        team: teamName,
        success: null,
        reason: '',
        actualValue: null
    };

    try {
        // Calculează goluri, cornere și cartonașe în R2
        const r2Goals = calculateR2Goals(fulltime, halftime);
        const r2Corners = calculateR2Corners(fulltime, halftime, secondhalf); // CORECTAT: Adăugat secondhalf
        const r2Cards = calculateR2Cards(fulltime, halftime, secondhalf); // CORECTAT: Adăugat secondhalf

        // PATTERN 0, 1, 2, 4, 7, 8, 10, 11, 12, 13, 14, 16, 17, 18: Echipa va marca GOL în R2
        // PATTERN 0.0: Adversar cu cartonas rosu → echipa marcheaza R2
        // PATTERN 10.x: xG ridicat fara gol → echipa marcheaza R2
        // PATTERN 11.x: Posesie dominanta fara gol → echipa marcheaza R2
        // PATTERN 12.x: xG + Posesie combinat → echipa marcheaza R2
        // PATTERN 13.x: Posesie + Suturi pe poarta → echipa marcheaza R2
        // PATTERN 14: Adversarul va marca in R2
        // PATTERN 16: Ofsaiduri + presiune ofensiva → echipa marcheaza R2
        // PATTERN 17: Salvari gardian adversar multe → echipa marcheaza R2
        // PATTERN 18: Dominare totala → echipa marcheaza R2
        if (patternName.match(/PATTERN_[1248]\./) || patternName.match(/PATTERN_7\./) ||
            patternName.match(/PATTERN_0\./) || patternName.match(/PATTERN_1[0-48]/) ||
            patternName === 'PATTERN_16' || patternName === 'PATTERN_17' ||
            patternName === 'PATTERN_18') {
            // PATTERN_14 e special: "adversarul va marca" — verificăm golurile ADVERSARULUI
            let goalsR2;
            if (patternName === 'PATTERN_14') {
                // Inversăm: dacă team=oaspete, adversarul e gazda
                goalsR2 = team === 'gazda' ? r2Goals.away :
                         team === 'oaspete' ? r2Goals.home : r2Goals.total;
            } else {
                goalsR2 = team === 'gazda' ? r2Goals.home :
                         team === 'oaspete' ? r2Goals.away : r2Goals.home;
            }

            result.actualValue = goalsR2;
            result.success = goalsR2 > 0;
            result.reason = result.success ?
                `Echipa a marcat ${goalsR2} gol(uri) în R2 (HT: ${halftime.score.home}-${halftime.score.away} → FT: ${fulltime.score.home}-${fulltime.score.away})` :
                `Echipa NU a marcat în R2 (HT: ${halftime.score.home}-${halftime.score.away} → FT: ${fulltime.score.home}-${fulltime.score.away})`;
        }

        // PATTERN 3, 19: Meciul va avea goluri în R2 (oricare echipă)
        // PATTERN 19: Meci deschis (egal >=1-1, 6+ suturi pe poarta) → gol in R2
        else if (patternName.match(/PATTERN_3\./) || patternName === 'PATTERN_19') {
            result.actualValue = r2Goals.total;
            result.success = r2Goals.total > 0;
            result.reason = result.success ?
                `Meciul a avut ${r2Goals.total} gol(uri) în R2 (HT: ${halftime.score.home}-${halftime.score.away} → FT: ${fulltime.score.home}-${fulltime.score.away})` :
                `Meciul NU a avut goluri în R2 (HT: ${halftime.score.home}-${halftime.score.away} → FT: ${fulltime.score.home}-${fulltime.score.away})`;
        }

        // PATTERN 5, 6: Echipa va avea minim 2 CORNERE în R2
        else if (patternName.match(/PATTERN_[56]\./)) {
            if (!r2Corners || !r2Corners.hasData) {
                // Nu avem date despre cornere
                result.success = null;
                result.reason = 'Statistici cornere R2 nu sunt disponibile în datele finale';
            } else {
                const cornersR2 = team === 'gazda' ? r2Corners.home :
                                 team === 'oaspete' ? r2Corners.away : r2Corners.home;

                result.actualValue = cornersR2;
                result.success = cornersR2 >= 2;
                result.reason = result.success ?
                    `Echipa a avut ${cornersR2} cornere în R2 (≥2 cornere)` :
                    `Echipa a avut doar ${cornersR2} cornere în R2 (<2 cornere)`;
            }
        }

        // PATTERN 9: Cartonașe în R2 (cel puțin 1 cartonaș suplimentar)
        else if (patternName.match(/PATTERN_9\./)) {
            const r2Cards = calculateR2Cards(fulltime, halftime, secondhalf);

            if (!r2Cards || !r2Cards.hasData) {
                // Nu avem date despre cartonașe
                result.success = null;
                result.reason = 'Statistici cartonașe R2 nu sunt disponibile în date finale';
            } else {
                // Pentru PATTERN 9, validăm dacă a fost cel puțin 1 cartonaș în R2
                result.actualValue = r2Cards.total;
                result.success = r2Cards.total >= 1;
                result.reason = result.success ?
                    `Au fost ${r2Cards.total} cartonaș(e) în R2 (≥1 cartonaș)` :
                    `Nu au fost cartonașe în R2 (0 cartonașe)`;
            }
        }

        // Goluri echipă (legacy - pentru compatibilitate)
        else if (patternName.includes('OVER') && patternName.includes('GOLURI') && !patternName.includes('MECI')) {
            const actualGoals = team === 'gazda' ?
                parseInt(fulltime.score.home) :
                parseInt(fulltime.score.away);

            result.actualValue = actualGoals;
            result.success = validateGoalsPattern(patternName, team, actualGoals);
            result.reason = result.success ?
                `Echipa a marcat ${actualGoals} goluri` :
                `Echipa a marcat doar ${actualGoals} goluri`;
        }

        // Goluri meci (legacy)
        else if (patternName.includes('GOLURI_MECI')) {
            const totalGoals = parseInt(fulltime.score.home) + parseInt(fulltime.score.away);

            result.actualValue = totalGoals;
            result.success = validateGoalsPattern(patternName, 'meci', totalGoals);
            result.reason = result.success ?
                `Meciul a avut ${totalGoals} goluri` :
                `Meciul a avut doar ${totalGoals} goluri`;
        }

        // BTTS (legacy)
        else if (patternName.includes('BTTS')) {
            const homeGoals = parseInt(fulltime.score.home);
            const awayGoals = parseInt(fulltime.score.away);

            result.actualValue = `${homeGoals}-${awayGoals}`;
            result.success = validateBTTSPattern(patternName, homeGoals, awayGoals);
            result.reason = result.success ?
                `Ambele echipe au marcat (${homeGoals}-${awayGoals})` :
                `Nu au marcat ambele echipe (${homeGoals}-${awayGoals})`;
        }

        // GOL echipă în R2 (format nou: GOL_GAZDA_REPRIZA_2, GOL_OASPETE_REPRIZA_2)
        else if (patternName.includes('GOL') && patternName.includes('REPRIZA_2')) {
            const teamSide = patternName.includes('GAZDA') || team === 'gazda' ? 'home' : 'away';
            const goalsR2 = teamSide === 'home' ? r2Goals.home : r2Goals.away;

            result.actualValue = goalsR2;
            result.success = goalsR2 > 0;
            result.reason = result.success ?
                `Echipa a marcat ${goalsR2} gol(uri) în R2 (HT: ${halftime.score.home}-${halftime.score.away} → FT: ${fulltime.score.home}-${fulltime.score.away})` :
                `Echipa NU a marcat în R2 (HT: ${halftime.score.home}-${halftime.score.away} → FT: ${fulltime.score.home}-${fulltime.score.away})`;
        }

        // Echipa marchează peste X.Y (format nou: "Echipa HOME marchează peste 1.5")
        else if (patternName.includes('marchează') || patternName.includes('marcheaza')) {
            const teamSide = patternName.includes('HOME') || patternName.includes('GAZDA') || team === 'gazda' ? 'home' : 'away';
            const totalGoals = teamSide === 'home' ?
                parseInt(fulltime.score.home) :
                parseInt(fulltime.score.away);

            // Extrage threshold din pattern name (1.5, 0.5, 2.5)
            const thresholdMatch = patternName.match(/(\d+\.?\d*)/);
            const threshold = thresholdMatch ? parseFloat(thresholdMatch[1]) : 0.5;

            result.actualValue = totalGoals;
            result.success = totalGoals > threshold;
            result.reason = result.success ?
                `Echipa a marcat ${totalGoals} goluri (> ${threshold})` :
                `Echipa a marcat doar ${totalGoals} goluri (≤ ${threshold})`;
        }

        // Pattern necunoscut
        else {
            result.success = null;
            result.reason = `Pattern necunoscut pentru validare: ${patternName}`;
        }

    } catch (error) {
        result.success = null;
        result.reason = `Eroare la validare: ${error.message}`;
    }

    return result;
}

/**
 * Validează o notificare completă (cu toate pattern-urile)
 */
async function validateNotification(notification) {
    console.log(`\n🔍 VALIDARE NOTIFICARE: ${notification.id}\n`);
    console.log('='.repeat(60));

    // Adaptare pentru noua structură de notificări
    // Notificările vechi aveau: { match: {homeTeam, awayTeam}, patterns: [...] }
    // Notificările noi au: { matchId, homeTeam, awayTeam, match: "string", pattern: {...} }

    let matchObj, patternsArray;

    if (notification.homeTeam && notification.awayTeam) {
        // Nouă structură
        matchObj = {
            homeTeam: notification.homeTeam,
            awayTeam: notification.awayTeam,
            matchId: notification.matchId
        };
        patternsArray = notification.pattern ? [notification.pattern] : [];
    } else if (notification.match && typeof notification.match === 'object') {
        // Veche structură
        matchObj = notification.match;
        patternsArray = notification.patterns || [];
    } else {
        console.error('❌ Notificare invalidă: format necunoscut');
        return {
            success: false,
            error: 'Invalid notification data',
            reason: 'Unknown notification format'
        };
    }

    if (!matchObj || !patternsArray || patternsArray.length === 0) {
        console.error('❌ Notificare invalidă: lipsesc date esențiale');
        return {
            success: false,
            error: 'Invalid notification data',
            reason: 'Missing match or patterns'
        };
    }

    console.log(`⚽ Meci: ${matchObj.homeTeam} vs ${matchObj.awayTeam}`);
    console.log(`📋 Pattern-uri de validat: ${patternsArray.length}`);

    try {
        // 1. EXTRAGE DATE FINALE
        console.log(`\n📊 Extragere date finale...`);

        let matchData = null;

        // Încearcă să folosească datele deja salvate dacă sunt disponibile
        if (notification.result && notification.result.fulltime && notification.result.halftime) {
            console.log(`   ✅ Folosim date salvate anterior`);
            matchData = notification.result;

            // Combină statisticile HT din notification.statistics (format camelCase) cu result.halftime
            if (notification.statistics) {
                if (!matchData.halftime.statistics) {
                    matchData.halftime.statistics = { home: {}, away: {} };
                }
                // Merge statistics (notification.statistics folosește format camelCase)
                matchData.halftime.statistics.home = {
                    ...matchData.halftime.statistics.home,
                    ...notification.statistics.home
                };
                matchData.halftime.statistics.away = {
                    ...matchData.halftime.statistics.away,
                    ...notification.statistics.away
                };
            }

            // Verifică dacă lipsesc date critice (cornere/cartonașe HT sau FT)
            const hasCornersHT = matchData.halftime.statistics?.home?.['Corner Kicks'] !== undefined ||
                                 matchData.halftime.statistics?.home?.corners !== undefined;
            const hasCornersFT = matchData.fulltime.statistics?.home?.['Corner Kicks'] !== undefined ||
                                 matchData.fulltime.statistics?.home?.corners !== undefined;
            const hasCardsFT = matchData.fulltime.statistics?.home?.['Yellow Cards'] !== undefined ||
                               matchData.fulltime.statistics?.home?.yellowCards !== undefined;

            if (!hasCornersFT || !hasCardsFT || !hasCornersHT) {
                // PRIORITATE 1: Cauta in datele colectate zilnic (au stats complete)
                console.log(`   ⚠️  Lipsesc statistici (corners HT: ${hasCornersHT}, corners FT: ${hasCornersFT}, cards FT: ${hasCardsFT})`);
                console.log(`   📂 Căutare date complete în daily_collected...`);
                const collectedMatch = findMatchInCollectedData(matchObj.matchId, matchObj.homeTeam, matchObj.awayTeam);

                if (collectedMatch) {
                    // Merge statisticile lipsa din daily_collected
                    if (collectedMatch.halftime?.statistics?.home && !hasCornersHT) {
                        if (!matchData.halftime.statistics) matchData.halftime.statistics = { home: {}, away: {} };
                        matchData.halftime.statistics.home = { ...matchData.halftime.statistics.home, ...collectedMatch.halftime.statistics.home };
                        matchData.halftime.statistics.away = { ...matchData.halftime.statistics.away, ...collectedMatch.halftime.statistics.away };
                        console.log(`   ✅ Statistici HT completate din daily_collected`);
                    }
                    if (collectedMatch.fulltime?.statistics?.home && (!hasCornersFT || !hasCardsFT)) {
                        matchData.fulltime.statistics = { ...matchData.fulltime.statistics, ...collectedMatch.fulltime.statistics };
                        console.log(`   ✅ Statistici FT completate din daily_collected`);
                    }
                    if (collectedMatch.secondhalf) {
                        matchData.secondhalf = collectedMatch.secondhalf;
                        console.log(`   ✅ Statistici R2 completate din daily_collected`);
                    }
                } else {
                    // FALLBACK: re-extrage de la API
                    console.log(`   🔍 Nu sunt în daily_collected, re-extragere de la API...`);
                    try {
                        const freshData = await extractFinalStats(matchObj.matchId, {
                            homeTeam: matchObj.homeTeam,
                            awayTeam: matchObj.awayTeam,
                            league: matchObj.league,
                            matchStartTime: Math.floor(new Date(notification.timestamp).getTime() / 1000)
                        });

                        if (freshData) {
                            if (freshData.fulltime?.statistics) {
                                matchData.fulltime.statistics = { ...matchData.fulltime.statistics, ...freshData.fulltime.statistics };
                            }
                            if (freshData.halftime?.statistics) {
                                if (!matchData.halftime.statistics) matchData.halftime.statistics = { home: {}, away: {} };
                                matchData.halftime.statistics.home = { ...matchData.halftime.statistics.home, ...freshData.halftime.statistics.home };
                                matchData.halftime.statistics.away = { ...matchData.halftime.statistics.away, ...freshData.halftime.statistics.away };
                            }
                            if (freshData.secondhalf) {
                                matchData.secondhalf = freshData.secondhalf;
                            }
                            console.log(`   ✅ Statistici actualizate de la API`);
                        }
                    } catch (error) {
                        console.log(`   ⚠️  Nu s-au putut re-extrage statistici: ${error.message}`);
                    }
                }
            }
        } else {
            // Încearcă mai întâi datele colectate (fără request nou la API)
            console.log(`   📂 Căutare în datele colectate zilnic...`);
            const collectedMatch = findMatchInCollectedData(matchObj.matchId, matchObj.homeTeam, matchObj.awayTeam);

            if (collectedMatch) {
                console.log(`   ✅ Folosim datele colectate (fără request API)`);
                matchData = collectedMatch;
            } else {
                // Fallback: extrage de la API
                console.log(`   🔍 Nu există date colectate, extragere de la API...`);
                matchData = await extractFinalStats(matchObj.matchId, {
                    homeTeam: matchObj.homeTeam,
                    awayTeam: matchObj.awayTeam,
                    league: matchObj.league,
                    matchStartTime: Math.floor(new Date(notification.timestamp).getTime() / 1000)
                });
            }
        }

        if (!matchData) {
            console.log(`   ⚠️  Meciul nu este încă terminat`);
            return {
                success: false,
                reason: 'Match not finished'
            };
        }

        console.log(`   ✅ Scor HT: ${matchData.halftime.score.home}-${matchData.halftime.score.away}`);
        console.log(`   ✅ Scor FT: ${matchData.fulltime.score.home}-${matchData.fulltime.score.away}`);

        // 2. VALIDEAZĂ FIECARE PATTERN
        console.log(`\n📋 Validare pattern-uri:\n`);
        console.log('─'.repeat(60));

        const validationResults = [];
        let successCount = 0;
        let failCount = 0;

        for (const pattern of patternsArray) {
            const result = validatePattern(pattern, matchData);

            // Adaugă cotele relevante la rezultat
            let relevantOdds = { superbet: null, netbet: null, type: null };

            if (pattern.odds) {
                // Determină cota relevantă în funcție de pattern
                const pName = pattern.patternName || pattern.name || '';
                if (pName.match(/PATTERN_[1248]\./) || pName.match(/PATTERN_7\./) ||
                    pName.match(/PATTERN_0\./) || pName.match(/PATTERN_1[0-48]/) ||
                    pName === 'PATTERN_16' || pName === 'PATTERN_17' || pName === 'PATTERN_18') {
                    // Pattern-uri pentru GOL în R2 → cota team_to_score_2h
                    relevantOdds = {
                        superbet: pattern.odds.superbet?.team_to_score_2h || null,
                        netbet: pattern.odds.netbet?.team_to_score_2h || null,
                        type: 'team_to_score_2h'
                    };
                } else if (pName.match(/PATTERN_3\./) || pName === 'PATTERN_19') {
                    // Pattern pentru GOLURI MECI în R2 → cota match_over_2_5
                    relevantOdds = {
                        superbet: pattern.odds.superbet?.match_over_2_5 || null,
                        netbet: pattern.odds.netbet?.match_over_2_5 || null,
                        type: 'match_over_2_5'
                    };
                } else if (pName.match(/PATTERN_[56]\./)) {
                    // Pattern-uri pentru CORNERE în R2 → cota team_corners_2h_over_2
                    relevantOdds = {
                        superbet: pattern.odds.superbet?.team_corners_2h_over_2 || null,
                        netbet: pattern.odds.netbet?.team_corners_2h_over_2 || null,
                        type: 'team_corners_2h_over_2'
                    };
                }
            }

            // Adaugă cotele la rezultat
            result.odds = relevantOdds;

            validationResults.push(result);

            // Afișare detaliată a rezultatului
            const icon = result.success === true ? '✅ CÂȘTIGAT' :
                        result.success === false ? '❌ PIERDUT' :
                        '⚠️  NECUNOSCUT';

            console.log(`\n${icon}`);
            console.log(`   Pattern: ${pattern.patternName || pattern.name}`);
            console.log(`   Echipa: ${pattern.teamName}`);
            console.log(`   Pronostic: ${pattern.prediction?.description || pattern.prediction?.bet || 'N/A'}`);
            if (pattern.probability) {
                console.log(`   Probabilitate: ${pattern.probability}%`);
            }

            // Afișează cota relevantă pentru pattern
            // Afișează cotele (care au fost deja salvate în result.odds)
            if (result.odds && (result.odds.superbet || result.odds.netbet)) {
                console.log(`   💰 Cote:`);
                if (result.odds.superbet) {
                    const oddsTypeDisplay = result.odds.type === 'team_to_score_2h' ? 'Echipa marchează în R2' :
                                           result.odds.type === 'match_over_2_5' ? 'Goluri meci Over 2.5' :
                                           result.odds.type === 'team_corners_2h_over_2' ? 'Cornere echipă R2 Over 2.5' :
                                           result.odds.type;
                    console.log(`      Superbet: ${result.odds.superbet} (${oddsTypeDisplay})`);
                }
                if (result.odds.netbet) {
                    const oddsTypeDisplay = result.odds.type === 'team_to_score_2h' ? 'Echipa marchează în R2' :
                                           result.odds.type === 'match_over_2_5' ? 'Goluri meci Over 2.5' :
                                           result.odds.type === 'team_corners_2h_over_2' ? 'Cornere echipă R2 Over 2.5' :
                                           result.odds.type;
                    console.log(`      Netbet: ${result.odds.netbet} (${oddsTypeDisplay})`);
                }
            }

            console.log(`   → ${result.reason}`);
            if (result.actualValue !== null && result.actualValue !== undefined) {
                console.log(`   → Valoare reală: ${result.actualValue}`);
            }

            if (result.success === true) successCount++;
            if (result.success === false) failCount++;
        }

        console.log('\n' + '─'.repeat(60));

        // 3. ACTUALIZEAZĂ TRACKING
        const validationDetails = {
            finalScore: `${matchData.fulltime.score.home}-${matchData.fulltime.score.away}`,
            htScore: `${matchData.halftime.score.home}-${matchData.halftime.score.away}`,
            totalPatterns: patternsArray.length,
            successCount: successCount,
            failCount: failCount,
            unknownCount: patternsArray.length - successCount - failCount,
            successRate: Math.round((successCount / patternsArray.length) * 100),
            patterns: validationResults,
            validatedAt: new Date().toISOString(),
            validatedTimestamp: Date.now()
        };

        const updated = NotificationTracker.updateNotificationResult(
            notification.id,
            matchData,
            validationDetails
        );

        if (updated) {
            console.log(`\n✅ Tracking actualizat`);
        }

        console.log(`\n📊 REZULTAT VALIDARE:`);
        console.log(`   ✅ Succes: ${successCount}/${patternsArray.length}`);
        console.log(`   ❌ Eșuat: ${failCount}/${patternsArray.length}`);
        console.log(`   📈 Success rate: ${validationDetails.successRate}%`);
        console.log('='.repeat(60));

        return {
            success: true,
            validationDetails: validationDetails
        };

    } catch (error) {
        console.error(`❌ Eroare la validare: ${error.message}`);
        console.log('='.repeat(60));

        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Validează toate notificările pending
 */
async function validateAllPending(delayMs = 3000) {
    console.log(`\n📦 VALIDARE BATCH - TOATE NOTIFICĂRILE PENDING\n`);
    console.log('='.repeat(60));

    const trackingData = NotificationTracker.readStorage();
    const pending = trackingData.notifications.filter(n => !n.validated);

    console.log(`📊 Total notificări: ${trackingData.notifications.length}`);
    console.log(`⏳ Nevalidate: ${pending.length}`);
    console.log(`✅ Validate: ${trackingData.notifications.length - pending.length}\n`);

    if (pending.length === 0) {
        console.log(`✅ Nu există notificări nevalidate`);
        console.log('='.repeat(60));
        return;
    }

    const results = {
        total: pending.length,
        validated: 0,
        notFinished: 0,
        errors: 0
    };

    for (let i = 0; i < pending.length; i++) {
        const notification = pending[i];

        console.log(`\n[${i + 1}/${pending.length}] ${notification.match.homeTeam} vs ${notification.match.awayTeam}`);

        try {
            const result = await validateNotification(notification);

            if (result.success) {
                results.validated++;
            } else if (result.reason === 'Match not finished') {
                results.notFinished++;
            } else {
                results.errors++;
            }

        } catch (error) {
            console.error(`   ❌ Eroare: ${error.message}`);
            results.errors++;
        }

        // Delay între validări
        if (i < pending.length - 1) {
            console.log(`   ⏳ Așteptare ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 REZULTATE BATCH:\n`);
    console.log(`   Total procesate: ${results.total}`);
    console.log(`   ✅ Validate: ${results.validated}`);
    console.log(`   ⏳ Neterminate: ${results.notFinished}`);
    console.log(`   ❌ Erori: ${results.errors}`);
    console.log('='.repeat(60));
}

/**
 * Afișează raport performanță pentru toate notificările validate
 */
function displayPerformanceReport() {
    console.log(`\n📊 RAPORT PERFORMANȚĂ PATTERN-URI\n`);
    console.log('='.repeat(60));

    const trackingData = NotificationTracker.readStorage();
    const validated = trackingData.notifications.filter(n => n.validated);

    if (validated.length === 0) {
        console.log(`⚠️  Nu există notificări validate încă`);
        console.log('='.repeat(60));
        return;
    }

    // Calculează statistici globale
    let totalPatterns = 0;
    let successPatterns = 0;
    let failPatterns = 0;

    const patternStats = {};

    validated.forEach(notification => {
        if (notification.validationDetails && notification.validationDetails.patterns) {
            notification.validationDetails.patterns.forEach(pattern => {
                totalPatterns++;

                if (pattern.success === true) successPatterns++;
                if (pattern.success === false) failPatterns++;

                // Statistici pe pattern
                if (!patternStats[pattern.pattern]) {
                    patternStats[pattern.pattern] = {
                        total: 0,
                        success: 0,
                        fail: 0
                    };
                }

                patternStats[pattern.pattern].total++;
                if (pattern.success === true) patternStats[pattern.pattern].success++;
                if (pattern.success === false) patternStats[pattern.pattern].fail++;
            });
        }
    });

    const globalSuccessRate = Math.round((successPatterns / totalPatterns) * 100);

    console.log(`📋 Total notificări validate: ${validated.length}`);
    console.log(`📊 Total pattern-uri: ${totalPatterns}`);
    console.log(`✅ Succes: ${successPatterns} (${globalSuccessRate}%)`);
    console.log(`❌ Eșuat: ${failPatterns}`);

    console.log(`\n📈 PERFORMANȚĂ PE PATTERN:\n`);

    Object.entries(patternStats)
        .sort((a, b) => b[1].total - a[1].total)
        .forEach(([patternName, stats]) => {
            const rate = Math.round((stats.success / stats.total) * 100);
            console.log(`   ${patternName}:`);
            console.log(`      Total: ${stats.total} | ✅ ${stats.success} | ❌ ${stats.fail} | Rate: ${rate}%`);
        });

    console.log('='.repeat(60));
}

// Export
module.exports = {
    validateNotification,
    validateAllPending,
    displayPerformanceReport,
    validatePattern
};

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);

    (async () => {
        try {
            if (args[0] === 'validate') {
                await validateAllPending();

            } else if (args[0] === 'report') {
                displayPerformanceReport();

            } else if (args[0] === 'match' && args[1]) {
                const matchId = args[1];

                // Find notification for this match
                const trackingData = NotificationTracker.readStorage();
                const notification = trackingData.notifications.find(n =>
                    n.match.matchId === matchId && !n.validated
                );

                if (notification) {
                    await validateNotification(notification);
                } else {
                    console.log(`❌ Nu s-a găsit notificare nevalidată pentru meciul: ${matchId}`);
                }

            } else {
                console.log(`
📖 USAGE:

   node RESULTS_VALIDATOR.js validate         # Validează toate notificările pending
   node RESULTS_VALIDATOR.js report           # Raport performanță
   node RESULTS_VALIDATOR.js match <matchId>  # Validează un meci specific

📝 EXEMPLU:

   node RESULTS_VALIDATOR.js validate
   node RESULTS_VALIDATOR.js report
   node RESULTS_VALIDATOR.js match abc123xyz

⚙️  WORKFLOW:

   1. Sistemul trimite notificări cu pattern-uri (salvate în tracking)
   2. După ce meciurile se termină, rulezi: node RESULTS_VALIDATOR.js validate
   3. Sistemul extrage scorurile finale și validează fiecare pattern
   4. Vezi raportul de performanță: node RESULTS_VALIDATOR.js report
`);
            }

        } catch (error) {
            console.error(`\n❌ EROARE: ${error.message}\n`);
            process.exit(1);
        }
    })();
}
