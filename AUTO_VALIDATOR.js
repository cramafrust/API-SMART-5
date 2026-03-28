/**
 * 🤖 AUTO_VALIDATOR.js
 *
 * Sistem automat de validare pentru notificări
 *
 * FUNCȚIONALITATE:
 * - Verifică periodic notificările nevalidate
 * - Validează automat meciurile terminate
 * - Poate rula ca proces independent sau integrat în API SMART 5
 * - Evită validarea meciurilor în curs
 *
 * USAGE:
 *   node AUTO_VALIDATOR.js                    # Rulează o dată și se oprește
 *   node AUTO_VALIDATOR.js --continuous       # Rulează continuu (la fiecare 6h)
 *   node AUTO_VALIDATOR.js --continuous 3600  # Rulează continuu (custom interval în secunde)
 *
 * INTEGRARE:
 *   const autoValidator = require('./AUTO_VALIDATOR');
 *   autoValidator.startAutoValidation(intervalSeconds);
 */

const NotificationTracker = require('./NOTIFICATION_TRACKER');
const ResultsValidator = require('./RESULTS_VALIDATOR');
const PrematchTracker = require('./PREMATCH_TRACKER');
const { sendTop30ValidationReport } = require('./PRE_MATCH_STREAKS');
const lifecycle = require('./LIFECYCLE_MANAGER');
const logger = require('./LOG_MANAGER');
const fs = require('fs');
const path = require('path');

// Configurare
const DEFAULT_INTERVAL_SECONDS = 6 * 60 * 60; // 6 ore
const MIN_MATCH_AGE_HOURS = 3; // Așteptăm minim 3 ore după notificare (meci HT + R2 + timp final)
const MAX_RETRIES = 3; // Număr maxim de încercări pentru un meci

/**
 * Verifică dacă un meci este suficient de vechi pentru a fi validat
 */
function isMatchReadyForValidation(notification) {
    const now = new Date();
    const notificationDate = new Date(notification.timestamp);
    const hoursSinceNotification = (now - notificationDate) / (1000 * 60 * 60);

    // Meciul trebuie să fie cel puțin MIN_MATCH_AGE_HOURS ore în urmă
    return hoursSinceNotification >= MIN_MATCH_AGE_HOURS;
}

/**
 * Validează notificările pending care sunt gata
 */
async function validatePendingNotifications() {
    logger.info('\n🤖 AUTO-VALIDATOR - START\n');
    logger.info('='.repeat(60));
    logger.info(`⏰ ${new Date().toLocaleString('ro-RO')}`);
    logger.info('='.repeat(60));

    try {
        // Încarcă notificări
        const trackingData = NotificationTracker.readStorage();
        if (!trackingData || !trackingData.notifications || !Array.isArray(trackingData.notifications)) {
            logger.warn('⚠️  Storage invalid în AUTO_VALIDATOR, nicio notificare de validat');
            return {
                total: 0,
                validated: 0,
                skipped: 0,
                errors: 0
            };
        }

        const allNotifications = trackingData.notifications;
        // Include și notificările marcate "unknown" — trebuie re-validate
        const pending = allNotifications.filter(n => !n.validated || n.validation_result === 'unknown');

        logger.info(`\n📊 STATISTICI:`);
        logger.info(`   Total notificări: ${allNotifications.length}`);
        logger.info(`   Nevalidate: ${pending.length}`);
        logger.info(`   Validate: ${allNotifications.length - pending.length}`);

        if (pending.length === 0) {
            logger.info(`\n✅ Nu există notificări de validat`);
            logger.info('='.repeat(60));
            return {
                total: 0,
                validated: 0,
                skipped: 0,
                errors: 0
            };
        }

        // Filtrează notificările gata de validat
        const readyForValidation = pending.filter(n => isMatchReadyForValidation(n));
        const tooRecent = pending.length - readyForValidation.length;

        logger.info(`\n🔍 FILTRARE:`);
        logger.info(`   Gata de validat: ${readyForValidation.length}`);
        logger.info(`   Prea recente (< ${MIN_MATCH_AGE_HOURS}h): ${tooRecent}`);

        if (readyForValidation.length === 0) {
            logger.info(`\n⏳ Toate notificările pending sunt prea recente`);
            logger.info(`   Așteptăm ca meciurile să se termine...`);
            logger.info('='.repeat(60));
            return {
                total: pending.length,
                validated: 0,
                skipped: tooRecent,
                errors: 0
            };
        }

        // Sortează după dată (cele mai vechi primele)
        readyForValidation.sort((a, b) =>
            new Date(a.timestamp) - new Date(b.timestamp)
        );

        logger.info(`\n🚀 ÎNCEP VALIDAREA...\n`);

        const results = {
            total: readyForValidation.length,
            validated: 0,
            skipped: tooRecent,
            notFinished: 0,
            errors: 0
        };

        // Validează fiecare notificare
        for (let i = 0; i < readyForValidation.length; i++) {
            const notification = readyForValidation[i];

            // SAFE: notification.match e STRING, folosim homeTeam/awayTeam direct din notification
            logger.info(`\n[${i + 1}/${readyForValidation.length}] ${notification.homeTeam || 'Unknown'} vs ${notification.awayTeam || 'Unknown'}`);
            logger.info(`   Meci: ${notification.match || 'N/A'}`);
            logger.info(`   Data notificare: ${notification.timestamp}`);

            const notificationDate = new Date(notification.timestamp);
            const hoursSince = Math.floor((new Date() - notificationDate) / (1000 * 60 * 60));
            logger.info(`   Timp trecut: ${hoursSince}h`);

            try {
                // Resetează status dacă era "unknown" — forțează re-validare
                if (notification.validation_result === 'unknown') {
                    notification.validated = false;
                    notification.validation_result = undefined;
                    logger.info(`   🔄 Re-validare (era "unknown")`);
                }

                const result = await ResultsValidator.validateNotification(notification);

                if (result.success) {
                    results.validated++;

                    // Afișează rezumat validare
                    const details = result.validationDetails;
                    logger.info(`\n   ✅ VALIDAT CU SUCCES`);
                    logger.info(`   📊 Scor final: ${details.finalScore}`);
                    logger.info(`   🎯 Pronosticuri: ${details.successCount} CÂȘTIGATE / ${details.failCount} PIERDUTE / ${details.unknownCount} necunoscute`);
                    if (details.successCount > 0 || details.failCount > 0) {
                        logger.info(`   📈 Success rate: ${details.successRate}%`);
                    }
                } else if (result.reason === 'Match not finished') {
                    results.notFinished++;
                    logger.info(`   ⏳ Meciul nu este încă terminat - se va încerca mai târziu`);
                } else {
                    results.errors++;
                    logger.info(`   ❌ Eroare: ${result.error || result.reason}`);
                }

            } catch (error) {
                logger.error(`   ❌ EXCEPȚIE: ${error.message}`);
                logger.error(`   📍 Stack: ${error.stack}`);
                results.errors++;
            }

            // Delay între validări pentru a nu suprasolicita API-ul
            if (i < readyForValidation.length - 1) {
                const delayMs = 3000;
                logger.info(`   ⏳ Așteptare ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        logger.info('\n' + '='.repeat(60));
        logger.info(`\n📊 REZULTATE AUTO-VALIDARE:\n`);
        logger.info(`   Total procesate: ${results.total}`);
        logger.info(`   ✅ Validate cu succes: ${results.validated}`);
        logger.info(`   ⏳ Meciuri neterminate: ${results.notFinished}`);
        logger.info(`   ⏭️  Notificări prea recente: ${results.skipped}`);
        logger.info(`   ❌ Erori: ${results.errors}`);
        logger.info('='.repeat(60));
        logger.info(`\n🤖 AUTO-VALIDATOR - FINAL\n`);

        return results;

    } catch (error) {
        logger.error(`\n❌ EROARE CRITICĂ: ${error.message}`);
        logger.error(error.stack);
        logger.info('='.repeat(60));
        throw error;
    }
}

/**
 * Rulează auto-validarea continuu la interval specificat
 */
async function startAutoValidation(intervalSeconds = DEFAULT_INTERVAL_SECONDS) {
    logger.info('\n🤖 AUTO-VALIDATOR - MOD CONTINUU\n');
    logger.info('='.repeat(60));
    logger.info(`⚙️  Interval: ${intervalSeconds} secunde (${Math.floor(intervalSeconds / 3600)}h ${Math.floor((intervalSeconds % 3600) / 60)}m)`);
    logger.info(`⏰ Start: ${new Date().toLocaleString('ro-RO')}`);
    logger.info('='.repeat(60));

    // Rulează prima validare imediat
    logger.info('\n🚀 Rulare inițială...');
    try {
        await validatePendingNotifications();
        await validatePrematchPredictions();
        await sendTop30ValidationReport();
    } catch (error) {
        logger.error(`❌ Eroare la validare inițială: ${error.message}`);
    }

    // Setează interval pentru validări periodice
    logger.info(`\n⏲️  Următoarea validare va rula peste ${Math.floor(intervalSeconds / 60)} minute...`);

    lifecycle.setInterval('auto-validator-periodic', async () => {
        logger.info('\n\n' + '█'.repeat(60));
        logger.info(`🔄 RULARE AUTOMATĂ PERIODICĂ`);
        logger.info('█'.repeat(60));

        try {
            await validatePendingNotifications();
            await validatePrematchPredictions();
            await sendTop30ValidationReport();
        } catch (error) {
            logger.error(`❌ Eroare la validare periodică: ${error.message}`);
        }

        logger.info(`\n⏲️  Următoarea validare: ${new Date(Date.now() + intervalSeconds * 1000).toLocaleString('ro-RO')}`);
    }, intervalSeconds * 1000);

    // Menține procesul activ
    logger.info('\n✅ Auto-validator pornit cu succes!');
    logger.info(`💡 Apasă CTRL+C pentru a opri`);
}

/**
 * Validează predicțiile pre-meci din prematch_tracking.json
 * Caută datele complete ale meciului în season files
 */
async function validatePrematchPredictions() {
    const pending = PrematchTracker.getPendingValidation();
    if (pending.length === 0) return { total: 0, validated: 0, errors: 0 };

    logger.info(`\n📊 VALIDARE PRE-MATCH: ${pending.length} predicții pending`);

    // Pattern-uri S01-S22 — definim nextThreshold și ce verificăm
    const PATTERN_VALIDATORS = {
        'S01': { stat: 'goluri', side: 'team', nextThreshold: 1 },
        'S02': { stat: 'goluri', side: 'team', nextThreshold: 1 },
        'S03': { stat: 'goluri_primite', side: 'team', nextThreshold: 1 },
        'S04': { stat: 'goluri_primite', side: 'team', nextThreshold: 1 },
        'S05': { stat: 'goluri_r1', side: 'team', nextThreshold: 1 },
        'S06': { stat: 'goluri_total', side: 'match', nextThreshold: 2 },
        'S07': { stat: 'cornere', side: 'team', nextThreshold: 4 },
        'S08': { stat: 'cornere', side: 'team', nextThreshold: 3 },
        'S09': { stat: 'cornere', side: 'team', nextThreshold: 3 },
        'S10': { stat: 'cornere', side: 'team', nextThreshold: 5 },
        'S11': { stat: 'suturi_poarta', side: 'team', nextThreshold: 4 },
        'S12': { stat: 'suturi_poarta', side: 'team', nextThreshold: 3 },
        'S13': { stat: 'suturi_poarta', side: 'team', nextThreshold: 3 },
        'S14': { stat: 'suturi_poarta', side: 'team', nextThreshold: 4 },
        'S15': { stat: 'total_suturi', side: 'team', nextThreshold: 10 },
        'S16': { stat: 'total_suturi', side: 'team', nextThreshold: 10 },
        'S17': { stat: 'total_suturi', side: 'team', nextThreshold: 10 },
        'S18': { stat: 'faulturi', side: 'team', nextThreshold: 11 },
        'S19': { stat: 'faulturi', side: 'team', nextThreshold: 11 },
        'S20': { stat: 'faulturi', side: 'team', nextThreshold: 11 },
        'S21': { stat: 'cartonase', side: 'team', nextThreshold: 2 },
        'S22': { stat: 'cartonase', side: 'team', nextThreshold: 1 },
    };

    // Caută meciul în season files
    // matchDate = data predicției (YYYY-MM-DD) — pentru a evita potrivirea cu meciuri din alte etape
    function findMatchInSeasons(matchId, homeTeam, awayTeam, matchDate) {
        const seasonsDir = path.join(__dirname, 'data', 'seasons');
        try {
            const files = fs.readdirSync(seasonsDir).filter(f => f.endsWith('.json') && !f.includes('CORRUPT') && !f.includes('OLD_FORMAT'));

            // Pass 1: căutare exactă pe matchId (cel mai fiabil)
            for (const file of files) {
                try {
                    const d = JSON.parse(fs.readFileSync(path.join(seasonsDir, file), 'utf8'));
                    for (const m of (d.meciuri || [])) {
                        if (m.id_meci === matchId) return m;
                    }
                } catch (e) {}
            }

            // Pass 2: fallback pe nume echipe + data meciului
            for (const file of files) {
                try {
                    const d = JSON.parse(fs.readFileSync(path.join(seasonsDir, file), 'utf8'));
                    for (const m of (d.meciuri || [])) {
                        const mHome = m.echipa_gazda && (m.echipa_gazda.nume || m.echipa_gazda.nume_complet);
                        const mAway = m.echipa_oaspete && (m.echipa_oaspete.nume || m.echipa_oaspete.nume_complet);
                        if (mHome === homeTeam && mAway === awayTeam) {
                            // Verifică data meciului dacă e disponibilă
                            if (matchDate && m.data_ora && m.data_ora.data) {
                                const mDate = m.data_ora.data; // format: DD.MM.YYYY sau YYYY-MM-DD
                                // Normalizează ambele date la YYYY-MM-DD
                                let mDateNorm = mDate;
                                if (mDate.includes('.')) {
                                    const parts = mDate.split('.');
                                    mDateNorm = `${parts[2]}-${parts[1]}-${parts[0]}`;
                                }
                                if (mDateNorm === matchDate) return m;
                            } else {
                                // Fără dată disponibilă, returnează (backward compat)
                                return m;
                            }
                        }
                    }
                } catch (e) {}
            }

            // Pass 3: fallback fără verificare dată (ultima șansă)
            for (const file of files) {
                try {
                    const d = JSON.parse(fs.readFileSync(path.join(seasonsDir, file), 'utf8'));
                    for (const m of (d.meciuri || [])) {
                        const mHome = m.echipa_gazda && (m.echipa_gazda.nume || m.echipa_gazda.nume_complet);
                        const mAway = m.echipa_oaspete && (m.echipa_oaspete.nume || m.echipa_oaspete.nume_complet);
                        if (mHome === homeTeam && mAway === awayTeam) return m;
                    }
                } catch (e) {}
            }
        } catch (e) {}
        return null;
    }

    // Extrage valoarea statisticii din meciul din season file
    function getStatValue(match, statType, side) {
        const isHome = side === 'gazda';
        const scor = match.scor;
        const stats = match.statistici;

        switch (statType) {
            case 'goluri':
                if (!scor) return null;
                return isHome ? scor.final_gazda : scor.final_oaspete;
            case 'goluri_primite':
                if (!scor) return null;
                return isHome ? scor.final_oaspete : scor.final_gazda;
            case 'goluri_r1':
                if (!scor) return null;
                return isHome ? scor.pauza_gazda : scor.pauza_oaspete;
            case 'goluri_total':
                if (!scor) return null;
                return scor.final_gazda + scor.final_oaspete;
            case 'cornere':
                if (!stats || !stats.cornere) return null;
                return isHome ? stats.cornere.total_gazda : stats.cornere.total_oaspete;
            case 'suturi_poarta':
                if (!stats || !stats.suturi_pe_poarta) return null;
                return isHome ? stats.suturi_pe_poarta.total_gazda : stats.suturi_pe_poarta.total_oaspete;
            case 'total_suturi':
                if (!stats || !stats.total_suturi) return null;
                return isHome ? stats.total_suturi.total_gazda : stats.total_suturi.total_oaspete;
            case 'faulturi':
                if (!stats || !stats.faulturi) return null;
                return isHome ? stats.faulturi.total_gazda : stats.faulturi.total_oaspete;
            case 'cartonase':
                if (!stats || !stats.cartonase_galbene) return null;
                return isHome ? stats.cartonase_galbene.total_gazda : stats.cartonase_galbene.total_oaspete;
            default:
                return null;
        }
    }

    const results = { total: pending.length, validated: 0, won: 0, lost: 0, notFound: 0, errors: 0 };

    for (const pred of pending) {
        const validator = PATTERN_VALIDATORS[pred.patternId];
        if (!validator) {
            logger.warn(`   ⚠️ Pattern necunoscut: ${pred.patternId}`);
            results.errors++;
            continue;
        }

        // Caută meciul (cu data predicției pentru a evita potriviri greșite)
        const match = findMatchInSeasons(pred.matchId, pred.homeTeam, pred.awayTeam, pred.date);
        if (!match) {
            results.notFound++;
            continue; // Va fi reîncercat la următoarea rulare
        }

        // Verifică dacă meciul are scor final
        if (!match.scor || match.scor.final_gazda === null || match.scor.final_gazda === undefined) {
            results.notFound++;
            continue;
        }

        const actualValue = getStatValue(match, validator.stat, pred.side);
        if (actualValue === null) {
            // Statistică lipsă — marcăm unknown
            PrematchTracker.updatePrediction(pred.id, {
                validated: true,
                validation_result: 'unknown',
                result: { reason: 'Statistică indisponibilă', matchScore: `${match.scor.final_gazda}-${match.scor.final_oaspete}` }
            });
            results.errors++;
            continue;
        }

        const won = actualValue >= validator.nextThreshold;
        PrematchTracker.updatePrediction(pred.id, {
            validated: true,
            validation_result: won ? 'won' : 'lost',
            result: {
                matchScore: `${match.scor.final_gazda}-${match.scor.final_oaspete}`,
                statType: validator.stat,
                actualValue: actualValue,
                requiredValue: validator.nextThreshold,
                success: won
            }
        });

        if (won) results.won++; else results.lost++;
        results.validated++;

        logger.info(`   ${won ? '✅' : '❌'} ${pred.homeTeam} vs ${pred.awayTeam} | ${pred.patternId} (${pred.team} ${pred.side}) | ${validator.stat}: ${actualValue} ${won ? '>=' : '<'} ${validator.nextThreshold}`);
    }

    logger.info(`\n   📊 Pre-match validare: ${results.validated} validate (${results.won}W/${results.lost}L), ${results.notFound} meciuri negăsite, ${results.errors} erori`);

    // Afișează statisticile totale
    const stats = PrematchTracker.getStats();
    if (stats.winRate !== null) {
        logger.info(`   📈 Total pre-match: ${stats.won}W/${stats.lost}L din ${stats.validated} validate → ${stats.winRate}%`);
    }

    return results;
}

/**
 * Oprește auto-validarea (dacă rulează)
 */
function stopAutoValidation() {
    logger.info('\n🛑 AUTO-VALIDATOR - OPRIRE\n');
    process.exit(0);
}

// Export funcții
module.exports = {
    validatePendingNotifications,
    validatePrematchPredictions,
    startAutoValidation,
    stopAutoValidation,
    isMatchReadyForValidation
};

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);

    // Handle CTRL+C gracefully
    process.on('SIGINT', () => {
        stopAutoValidation();
    });

    (async () => {
        try {
            if (args[0] === '--continuous') {
                // Mod continuu cu interval custom sau default
                const intervalSeconds = args[1] ? parseInt(args[1]) : DEFAULT_INTERVAL_SECONDS;
                await startAutoValidation(intervalSeconds);

            } else if (args[0] === '--help' || args[0] === '-h') {
                logger.info(`
📖 USAGE:

   node AUTO_VALIDATOR.js                    # Rulează o dată și se oprește
   node AUTO_VALIDATOR.js --continuous       # Rulează continuu (la fiecare 6h)
   node AUTO_VALIDATOR.js --continuous 3600  # Rulează continuu (custom interval în secunde)

📝 EXEMPLE:

   # Validare single-run
   node AUTO_VALIDATOR.js

   # Validare continuă la fiecare 6 ore (default)
   node AUTO_VALIDATOR.js --continuous

   # Validare continuă la fiecare oră (3600 secunde)
   node AUTO_VALIDATOR.js --continuous 3600

   # Validare continuă la fiecare 30 minute
   node AUTO_VALIDATOR.js --continuous 1800

⚙️  CONFIGURARE:

   MIN_MATCH_AGE_HOURS = ${MIN_MATCH_AGE_HOURS}h
   - Așteaptă minim 3 ore după notificare înainte de validare
   - Acest timp permite meciului să se termine (HT + R2 + timp final)

   DEFAULT_INTERVAL = ${Math.floor(DEFAULT_INTERVAL_SECONDS / 3600)}h
   - Intervalul implicit pentru validări periodice

💡 INTEGRARE ÎN API SMART 5:

   const autoValidator = require('./AUTO_VALIDATOR');

   // Pornește auto-validarea la fiecare 6 ore
   autoValidator.startAutoValidation(6 * 60 * 60);

🔄 WORKFLOW:

   1. Sistemul verifică toate notificările nevalidate
   2. Filtrează notificările care sunt > ${MIN_MATCH_AGE_HOURS}h vechi
   3. Încearcă să extragă statistici finale pentru fiecare meci
   4. Validează pattern-urile și actualizează tracking-ul
   5. Repetă la intervalul configurat (în mod continuu)
`);

            } else {
                // Rulare single (fără --continuous)
                await validatePendingNotifications();
                process.exit(0);
            }

        } catch (error) {
            logger.error(`\n❌ EROARE: ${error.message}\n`);
            process.exit(1);
        }
    })();
}
