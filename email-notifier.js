/**
 * API SMART 5 - Email Notifier
 *
 * Trimite notificări email când găsim pattern-uri cu probabilitate >70%
 */

const emailService = require('./EMAIL_SERVICE');
const PatternDescriptor = require('./PATTERN_DESCRIPTOR');
const NotificationTracker = require('./NOTIFICATION_TRACKER'); // Tracker unificat
const BettingOdds = require('./SUPERBET_ODDS_INTEGRATION'); // Modul NOU - Superbet LIVE Odds
const logger = require('./LOG_MANAGER');

// Încarcă configurația din fișierul SMART 3
let CONFIG;
try {
    CONFIG = require('./NOTIFICATION_CONFIG');
    logger.info('✅ Configurație email încărcată\n');
} catch (error) {
    logger.error('❌ Nu am putut încărca NOTIFICATION_CONFIG.js');
    logger.info('📝 Folosește configurația din SMART 3 folder\n');
    CONFIG = null;
}

class EmailNotifier {
    constructor() {
        this.descriptor = PatternDescriptor; // Use imported singleton (not new instance)
        // Email service este deja inițializat centralizat
    }

    /**
     * Generează HTML pentru istoric echipă
     */
    generateTeamHistoryHTML(teamName) {
        const history = NotificationTracker.getTeamRecentHistory(teamName, 10);

        if (history.length === 0) {
            return ''; // Nu afișăm nimic dacă nu există istoric
        }

        const stats = NotificationTracker.getTeamSuccessRate(teamName, 10);

        let historyHTML = '<div class="team-history">';
        historyHTML += `<h4>📊 ISTORIC ECHIPĂ: ${teamName}</h4>`;
        historyHTML += '<p style="margin: 5px 0; color: #999;">Ultimele notificări:</p>';

        history.forEach(item => {
            const resultIcon = item.result === 'WON' ? '🟢' : (item.result === 'LOST' ? '🔴' : '⚪');
            const resultClass = item.result === 'WON' ? 'history-won' : (item.result === 'LOST' ? 'history-lost' : '');
            const resultText = item.result || 'PENDING';

            historyHTML += `<div class="history-item">`;
            historyHTML += `${resultIcon} <span class="${resultClass}">${resultText}</span> | `;
            historyHTML += `${item.date} | ${item.pattern} | ${item.probability}%`;
            historyHTML += `</div>`;
        });

        if (stats.validated > 0) {
            const successRate = stats.successRate || 0;
            const rateColor = successRate >= 60 ? '#28a745' : (successRate >= 40 ? '#ffc107' : '#dc3545');
            historyHTML += `<p style="margin: 10px 0 0 0; font-weight: bold; color: ${rateColor};">`;
            historyHTML += `Rata succes: ${stats.won}/${stats.validated} (${successRate}%)`;
            historyHTML += `</p>`;
        }

        historyHTML += '</div>';

        return historyHTML;
    }

    /**
     * Formatează HTML pentru email
     */
    formatEmailHTML(matchData, patternData, probability) {
        const { matchId, homeTeam, awayTeam, leagueName, country, scor, statistici } = matchData;
        const { patternId, team, tier, position } = patternData;

        const teamName = team === 'gazda' ? homeTeam : (team === 'oaspete' ? awayTeam : 'Ambele echipe');

        // Pregătește statistici pentru descriptor
        const stats = {
            suturiPePtPauza: team === 'gazda' ? statistici.suturi_pe_poarta?.pauza_gazda : statistici.suturi_pe_poarta?.pauza_oaspete,
            cornerePauza: team === 'gazda' ? statistici.cornere?.repriza_1_gazda : statistici.cornere?.repriza_1_oaspete,
            suturiPeLanga: team === 'gazda' ?
                (statistici.total_suturi?.pauza_gazda || 0) - (statistici.suturi_pe_poarta?.pauza_gazda || 0) :
                (statistici.total_suturi?.pauza_oaspete || 0) - (statistici.suturi_pe_poarta?.pauza_oaspete || 0),
            adversarSalvariPauza: team === 'gazda' ? statistici.suturi_salvate?.pauza_oaspete : statistici.suturi_salvate?.pauza_gazda
        };

        // Generează mesaj explicit
        const explicitMessage = this.descriptor.formatExplicitMessage(patternId, teamName, probability, stats);

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
        .container { background-color: white; border-radius: 10px; padding: 30px; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; margin: -30px -30px 20px -30px; }
        .header h1 { margin: 0; font-size: 24px; }
        .match-info { background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .match-info h2 { margin: 0 0 10px 0; color: #333; font-size: 20px; }
        .score { font-size: 32px; font-weight: bold; color: #667eea; text-align: center; margin: 15px 0; }
        .pattern-box { background-color: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 15px 0; }
        .pattern-name { font-size: 18px; font-weight: bold; color: #1976d2; margin-bottom: 10px; }
        .probability { background-color: #4caf50; color: white; padding: 15px; border-radius: 8px; text-align: center; margin: 15px 0; }
        .probability-value { font-size: 36px; font-weight: bold; }
        .stats-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        .stats-table td { padding: 10px; border-bottom: 1px solid #e0e0e0; }
        .stats-table td:first-child { font-weight: bold; color: #555; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
        .team-history { background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 11px; }
        .team-history h4 { margin: 0 0 10px 0; color: #666; font-size: 13px; }
        .history-item { padding: 5px 0; border-bottom: 1px solid #e0e0e0; }
        .history-item:last-child { border-bottom: none; }
        .history-won { color: #28a745; font-weight: bold; }
        .history-lost { color: #dc3545; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 PATTERN IDENTIFICAT LA PAUZĂ!</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">${homeTeam} vs ${awayTeam}</p>
        </div>

        <div class="match-info">
            <h2>⚽ ${homeTeam} vs ${awayTeam}</h2>
            <p style="margin: 5px 0; color: #666;">🏆 ${leagueName || 'N/A'}</p>
            <p style="margin: 5px 0; color: #666;">🌍 ${country || 'N/A'}</p>
            <div class="score">${scor.pauza_gazda} - ${scor.pauza_oaspete}</div>
            <p style="text-align: center; color: #999; margin: 0;">Scor la pauză (HT)</p>
        </div>

        <div class="pattern-box">
            <div class="pattern-name">🎯 PATTERN IDENTIFICAT</div>
            <p style="margin: 15px 0; font-size: 16px; line-height: 1.6; color: #1565c0; font-weight: 600;">
                ${explicitMessage}
            </p>
            <p style="margin: 10px 0 5px 0; color: #999; font-size: 13px;">📊 Poziție clasament: ${position || 'N/A'} | 🏅 Tier: ${tier || 'N/A'}</p>
        </div>

        <h3 style="color: #333; margin: 20px 0 10px 0;">📊 Statistici Halftime</h3>
        <table class="stats-table">
            <tr><td>🎯 Șuturi pe poartă</td><td>${statistici.suturi_pe_poarta.pauza_gazda} vs ${statistici.suturi_pe_poarta.pauza_oaspete}</td></tr>
            <tr><td>⚽ Total șuturi</td><td>${statistici.total_suturi.pauza_gazda} vs ${statistici.total_suturi.pauza_oaspete}</td></tr>
            <tr><td>🚩 Cornere</td><td>${statistici.cornere.repriza_1_gazda} vs ${statistici.cornere.repriza_1_oaspete}</td></tr>
            <tr><td>🟨 Cartonașe galbene</td><td>${statistici.cartonase_galbene.pauza_gazda} vs ${statistici.cartonase_galbene.pauza_oaspete}</td></tr>
            <tr><td>🟥 Cartonașe roșii</td><td>${statistici.cartonase_rosii.pauza_gazda} vs ${statistici.cartonase_rosii.pauza_oaspete}</td></tr>
            <tr><td>🧤 Șuturi salvate</td><td>${statistici.suturi_salvate.pauza_gazda} vs ${statistici.suturi_salvate.pauza_oaspete}</td></tr>
        </table>

        ${this.generateTeamHistoryHTML(teamName)}

        <div class="footer">
            <p>⚡ API SMART 5 - Halftime Pattern Detection</p>
            <p>🤖 Generated with Claude Code</p>
            <p>⏰ ${new Date().toLocaleString('ro-RO')}</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Deduplică pattern-urile - păstrează doar cel mai bun pentru fiecare echipă
     *
     * Logică: Pattern-urile 1.x, 2.x, 4.x, 5.x, 7.x, 8.x pentru aceeași echipă
     * au ACELAȘI pronostic: "echipa va marca în repriza 2"
     *
     * Păstrăm DOAR pattern-ul cu probabilitatea cea mai mare pentru:
     * - Echipa gazdă (toate pattern-urile team='gazda')
     * - Echipa oaspeților (toate pattern-urile team='oaspete')
     * - Pattern-uri de meci (pattern-uri 3.x și 9.x - team='meci')
     */
    deduplicatePatterns(validPatterns, homeTeam, awayTeam) {
        const result = [];

        // Grupează pattern-urile pe echipă
        const gazdaPatterns = validPatterns.filter(p => p.team === 'gazda');
        const oaspetePatterns = validPatterns.filter(p => p.team === 'oaspete');
        const meciPatterns = validPatterns.filter(p => !p.team || p.team === 'meci');

        // Pentru GAZDA: păstrează doar pattern-ul cu probabilitatea cea mai mare
        if (gazdaPatterns.length > 0) {
            const bestGazda = gazdaPatterns.reduce((best, current) =>
                current.probability > best.probability ? current : best
            );
            result.push(bestGazda);

            if (gazdaPatterns.length > 1) {
                logger.info(`      🔄 ${homeTeam}: ${gazdaPatterns.length} pattern-uri → păstrat ${bestGazda.name} (${Math.round(bestGazda.probability)}%)`);
            }
        }

        // Pentru OASPETE: păstrează doar pattern-ul cu probabilitatea cea mai mare
        if (oaspetePatterns.length > 0) {
            const bestOaspete = oaspetePatterns.reduce((best, current) =>
                current.probability > best.probability ? current : best
            );
            result.push(bestOaspete);

            if (oaspetePatterns.length > 1) {
                logger.info(`      🔄 ${awayTeam}: ${oaspetePatterns.length} pattern-uri → păstrat ${bestOaspete.name} (${Math.round(bestOaspete.probability)}%)`);
            }
        }

        // Pentru MECI: pattern-urile 3.x, 9.x, 19.x pot coexista (sunt diferite)
        // 3.x = total goluri, 9.x = cartonașe galbene, 19 = meci deschis (egal >=1-1)
        if (meciPatterns.length > 0) {
            // Grupează pattern-urile pe tip
            const pattern3 = meciPatterns.filter(p => p.name.startsWith('PATTERN_3'));
            const pattern9 = meciPatterns.filter(p => p.name.startsWith('PATTERN_9'));
            const patternOther = meciPatterns.filter(p => !p.name.startsWith('PATTERN_3') && !p.name.startsWith('PATTERN_9'));

            // Păstrează cel mai bun din fiecare grup
            if (pattern3.length > 0) {
                const best3 = pattern3.reduce((best, current) =>
                    current.probability > best.probability ? current : best
                );
                result.push(best3);

                if (pattern3.length > 1) {
                    logger.info(`      🔄 Total goluri: ${pattern3.length} pattern-uri → păstrat ${best3.name} (${Math.round(best3.probability)}%)`);
                }
            }

            if (pattern9.length > 0) {
                const best9 = pattern9.reduce((best, current) =>
                    current.probability > best.probability ? current : best
                );
                result.push(best9);

                if (pattern9.length > 1) {
                    logger.info(`      🔄 Cartonașe: ${pattern9.length} pattern-uri → păstrat ${best9.name} (${Math.round(best9.probability)}%)`);
                }
            }

            // Alte pattern-uri de meci (ex: PATTERN_19 - meci deschis) — le păstrăm pe toate
            if (patternOther.length > 0) {
                result.push(...patternOther);
            }
        }

        return result;
    }

    /**
     * Trimite notificare email cu MULTIPLE PATTERN-URI
     */
    async sendNotificationWithMultiplePatterns(matchData, validPatterns) {
        if (!emailService.isAvailable()) {
            logger.info('   ⚠️  Email service nu este disponibil, skip notificare');
            return false;
        }

        try {
            const { homeTeam, awayTeam, leagueName, scor } = matchData;

            // 1. EXTRAGE COTE DE LA CASE DE PARIURI
            logger.info(`\n   💰 Extragere cote pariuri...`);
            let odds = null;

            // O SINGURĂ ÎNCERCARE - retry-ul este gestionat în SUPERBET_LIVE_ODDS
            // (findEventId: 6 × 30s = 3 min, getLiveOdds: 15 × 40s = 10 min)
            // TOTAL MAX: 13 minute
            try {
                const oddsData = await BettingOdds.getOddsForMatch(homeTeam, awayTeam, validPatterns);

                // Logging detaliat pentru debug
                if (!oddsData) {
                    logger.info(`   ⚠️  oddsData este null/undefined`);
                } else if (!oddsData.available) {
                    logger.info(`   ⚠️  Meciul nu este disponibil pe Superbet`);
                } else if (!oddsData.superbet) {
                    logger.info(`   ⚠️  oddsData.superbet este null/undefined`);
                } else if (!oddsData.superbet.relevantOdds) {
                    logger.info(`   ⚠️  oddsData.superbet.relevantOdds este null/undefined`);
                } else {
                    const numOdds = Object.keys(oddsData.superbet.relevantOdds).length;
                    logger.info(`   📊 Găsite ${numOdds} cote relevante`);
                }

                if (oddsData && oddsData.available && oddsData.superbet && oddsData.superbet.relevantOdds) {
                    // Verifică dacă avem cote valide (nu doar un obiect gol)
                    const hasValidOdds = Object.keys(oddsData.superbet.relevantOdds).length > 0;

                    if (hasValidOdds) {
                        odds = {
                            superbet: oddsData.superbet,
                            netbet: oddsData.netbet
                        };
                        logger.info(`   ✅ Cote extrase cu succes`);
                        logger.info(`   📊 ${Object.keys(oddsData.superbet.relevantOdds).length} cote relevante găsite`);
                    } else {
                        logger.info(`   ⚠️  Cote indisponibile/invalide - trimit email FĂRĂ cote`);
                    }
                } else {
                    logger.info(`   ⚠️  Nu am putut extrage cote - trimit email FĂRĂ cote`);
                }

            } catch (oddsError) {
                logger.error(`   ⚠️  Eroare extragere cote: ${oddsError.message}`);
                logger.info(`   📧 Trimit email FĂRĂ cote`);
            }

            // 2. SALVEAZĂ ÎN TRACKING VECHI (păstrat pentru compatibilitate)
            logger.info(`\n   📊 Salvare tracking vechi...`);

            try {
                const trackingResult = await NotificationTracker.saveNotification(matchData, validPatterns, odds);

                if (trackingResult.success) {
                    logger.info(`   ✅ Tracking vechi salvat: ${trackingResult.notificationId}`);
                } else {
                    logger.info(`   ⚠️  Tracking vechi nu a fost salvat`);
                }
            } catch (trackingError) {
                logger.error(`   ⚠️  Eroare tracking vechi: ${trackingError.message}`);
            }

            // 3. DEDUPLICARE PATTERN-URI (păstrăm doar cel mai bun pentru fiecare echipă)
            logger.info(`\n   🔍 Deduplicare pattern-uri...`);
            logger.info(`   Pattern-uri înainte: ${validPatterns.length}`);

            const dedupedPatterns = this.deduplicatePatterns(validPatterns, homeTeam, awayTeam);

            logger.info(`   Pattern-uri după deduplicare: ${dedupedPatterns.length}`);
            dedupedPatterns.forEach(p => {
                logger.info(`      - ${p.name} (${p.team}): ${Math.round(p.probability)}%`);
            });

            // Guard: nu trimite email dacă deduplicarea a eliminat toate pattern-urile
            if (dedupedPatterns.length === 0) {
                logger.warn(`   ⚠️  Toate pattern-urile au fost eliminate la deduplicare — NU trimit email`);
                return { success: false, reason: 'no_patterns_after_dedup' };
            }

            // 4. TRIMITE EMAIL
            const maxProb = Math.max(...dedupedPatterns.map(p => p.probability));
            const avgProb = Math.round(dedupedPatterns.reduce((sum, p) => sum + p.probability, 0) / dedupedPatterns.length);

            const subject = `🚨 ${dedupedPatterns.length} ${dedupedPatterns.length > 1 ? 'PREDICȚII' : 'PREDICȚIE'} @ ${homeTeam} vs ${awayTeam} | Max: ${Math.round(maxProb)}%`;
            const html = this.formatEmailHTMLMultiple(matchData, dedupedPatterns, odds);

            const result = await emailService.send({
                subject: subject,
                html: html
            });

            if (!result.success) {
                throw new Error(result.error || 'Email service unavailable');
            }

            logger.info(`   ✅ Email trimis cu ${dedupedPatterns.length} pattern-uri: ${result.messageId}`);

            // 4.5. TRIMITE LA ABONAȚI
            try {
                const { notifyAll } = require('./SUBSCRIBER_MANAGER');
                for (const pattern of dedupedPatterns) {
                    await notifyAll('ht', {
                        matchId: matchData.matchId,
                        homeTeam,
                        awayTeam,
                        league: matchData.leagueName || '',
                        pattern: pattern.name,
                        probability: pattern.probability,
                    });
                }
            } catch (subErr) {
                // Nu blocăm fluxul principal
                logger.debug(`   ⚠️  Subscriber notify: ${subErr.message}`);
            }

            // 5. ACTUALIZEAZĂ COTELE pe notificările existente din tracking
            logger.info(`\n   📊 Actualizare cote în tracking...`);

            try {
                if (odds && odds.superbet && odds.superbet.relevantOdds) {
                    const trackingData = NotificationTracker.readStorage();
                    let updated = 0;

                    for (const pattern of dedupedPatterns) {
                        // Extrage cota pentru acest pattern
                        const patternKey = Object.keys(odds.superbet.relevantOdds).find(key =>
                            key.startsWith(pattern.name) || key.includes(pattern.name)
                        );

                        if (patternKey) {
                            const oddValue = odds.superbet.relevantOdds[patternKey].odd;
                            const oddDesc = odds.superbet.relevantOdds[patternKey].description || '';

                            // Găsește notificarea existentă și actualizează cota
                            const matchId = matchData.matchId || 'UNKNOWN';
                            const existing = trackingData.notifications.find(n =>
                                n.matchId === matchId && n.pattern && n.pattern.name === pattern.name
                            );

                            if (existing) {
                                existing.initialOdd = oddValue;
                                existing.odds = { superbet: oddValue, description: oddDesc };
                                updated++;
                                logger.info(`      ✅ ${pattern.name}: cota ${oddValue} (${oddDesc})`);
                            }
                        }
                    }

                    if (updated > 0) {
                        NotificationTracker.writeStorage(trackingData);
                        logger.info(`   ✅ ${updated} cote actualizate în tracking`);
                    } else {
                        logger.info(`   ⚠️  Nicio cotă de actualizat`);
                    }
                } else {
                    logger.info(`   ⚠️  Nu sunt cote disponibile de salvat`);
                }
            } catch (trackingError) {
                logger.error(`   ⚠️  Eroare actualizare cote: ${trackingError.message}`);
            }

            return true;

        } catch (error) {
            logger.error(`   ❌ Eroare la trimitere email: ${error.message}`);
            return false;
        }
    }

    /**
     * Generează HTML pentru un singur pattern (reusable pentru gazdă/oaspete/meci)
     */
    _formatPatternHTML(p, teamLabel, odds) {
        const probColor = p.probability >= 85 ? '#4caf50' : p.probability >= 75 ? '#ff9800' : '#2196f3';
        const dataTypeColor = p.isEstimate ? '#ff9800' : '#4caf50';
        const dataTypeText = p.isEstimate ? 'Date estimate' : 'Date exacte';

        const explicitMessage = this.descriptor.formatExplicitMessage(p.name, teamLabel, p.probability, p.stats || {});

        // Statistică câștiguri/total - text explicit
        const cazuri = p.cazuri || 0;
        const succes = p.succes || 0;
        const statsText = cazuri > 0 ? `Din ${cazuri} cazuri similare analizate, predicția s-a confirmat în ${succes} (${Math.round(succes/cazuri*100)}% reușită)` : '';

        // Cote LIVE
        let oddsHTML = '';
        if (odds && odds.superbet && odds.superbet.relevantOdds) {
            const patternOdds = Object.entries(odds.superbet.relevantOdds).filter(([key]) => key.startsWith(p.name));
            if (patternOdds.length > 0) {
                oddsHTML = `<div style="margin-top: 10px; padding: 10px; background-color: #fff3e0; border-radius: 6px; border-left: 3px solid #ff9800;">
                    <div style="font-size: 13px; font-weight: bold; color: #e65100; margin-bottom: 8px;">💰 COTE LIVE SUPERBET:</div>`;
                patternOdds.forEach(([key, value]) => {
                    const oddValue = value.odd ? value.odd.toFixed(2) : 'N/A';
                    const currentValue = value.currentValue !== 'N/A' ? `(Acum: ${value.currentValue})` : '';
                    oddsHTML += `<div style="margin: 6px 0; padding: 6px; background-color: white; border-radius: 4px;">
                        <div style="font-size: 12px; color: #666; margin-bottom: 3px;">${value.description} ${currentValue}</div>
                        <span style="display: inline-block; background-color: #ff6f00; color: white; padding: 4px 12px; border-radius: 4px; font-size: 14px; font-weight: bold;">Cota: ${oddValue}</span>
                    </div>`;
                });
                oddsHTML += `</div>`;
            }
        }

        return `
        <div style="background-color: #f8f9fa; padding: 14px; margin: 8px 0; border-radius: 6px; border-left: 4px solid ${probColor};">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex: 1;">
                    <div style="font-size: 15px; color: #1565c0; line-height: 1.5; font-weight: 600;">
                        ${explicitMessage}
                    </div>
                    ${statsText ? `<div style="font-size: 13px; color: #555; margin-top: 6px;">📈 Istoric: <strong>${statsText}</strong></div>` : ''}
                    ${p.tier && p.team !== 'meci' ? `<div style="font-size: 12px; color: #888; margin-top: 4px;">Clasament: ${p.tier}${p.position ? ` (loc ${p.position})` : ''}</div>` : ''}
                    ${p.streakProb ? (
                        p.streakProb.rate >= 90 && p.streakProb.total >= 10
                        ? `<div style="font-size: 13px; margin-top: 6px; padding: 6px 10px; background-color: #fff8e1; border: 1px solid #ffb300; border-radius: 4px;">
                            <span style="font-weight: 700; color: #e65100;">🔥 SERIE PUTERNICĂ: Echipa are ${p.winStreak} victorii la rând — în ${p.streakProb.total} cazuri similare istorice, ${p.streakProb.won} au câștigat și următorul meci (${p.streakProb.rate}% reușită)</span>
                          </div>`
                        : `<div style="font-size: 13px; color: #d84315; margin-top: 6px; font-weight: 600;">🔥 PLUS: Echipa are ${p.winStreak} victorii la rând — în ${p.streakProb.total} cazuri similare, ${p.streakProb.won} au câștigat și următorul (${p.streakProb.rate}%)</div>`
                    ) : ''}
                    ${p.scoringStreakProb ? (
                        p.scoringStreakProb.rate >= 90 && p.scoringStreakProb.total >= 10
                        ? `<div style="font-size: 13px; margin-top: 4px; padding: 6px 10px; background-color: #fff8e1; border: 1px solid #ffb300; border-radius: 4px;">
                            <span style="font-weight: 700; color: #e65100;">⚽ SERIE PUTERNICĂ: Echipa a marcat 2+ goluri în ${p.scoringStreak} meciuri la rând — în ${p.scoringStreakProb.total} cazuri similare, ${p.scoringStreakProb.scored} au marcat și în următorul (${p.scoringStreakProb.rate}%)</span>
                          </div>`
                        : `<div style="font-size: 13px; color: #d84315; margin-top: 4px; font-weight: 600;">⚽ PLUS: ${p.scoringStreak} meciuri consecutive cu 2+ goluri — în ${p.scoringStreakProb.total} cazuri similare, ${p.scoringStreakProb.scored} au marcat și data viitoare (${p.scoringStreakProb.rate}%)</div>`
                    ) : ''}
                    ${p.goalStreakProb ? (
                        p.goalStreakProb.rate >= 90 && p.goalStreakProb.total >= 10
                        ? `<div style="font-size: 13px; margin-top: 4px; padding: 6px 10px; background-color: #fff8e1; border: 1px solid #ffb300; border-radius: 4px;">
                            <span style="font-weight: 700; color: #e65100;">🎯 SERIE PUTERNICĂ: Echipa a marcat în ${p.goalStreak} meciuri la rând — în ${p.goalStreakProb.total} cazuri similare, ${p.goalStreakProb.scored} au marcat și în următorul (${p.goalStreakProb.rate}%)</span>
                          </div>`
                        : `<div style="font-size: 13px; color: #d84315; margin-top: 4px; font-weight: 600;">🎯 PLUS: Gol în ${p.goalStreak} meciuri la rând — în ${p.goalStreakProb.total} cazuri similare, ${p.goalStreakProb.scored} au marcat și data viitoare (${p.goalStreakProb.rate}%)</div>`
                    ) : ''}
                    <div style="margin-top: 6px;">
                        <span style="display: inline-block; background-color: ${dataTypeColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${dataTypeText}</span>
                    </div>
                    ${oddsHTML}
                </div>
                <div style="background-color: ${probColor}; color: white; padding: 10px 18px; border-radius: 20px; font-weight: bold; font-size: 18px; margin-left: 12px; white-space: nowrap;">
                    ${Math.round(p.probability)}%
                </div>
            </div>
        </div>`;
    }

    /**
     * Formatează HTML pentru email cu MULTIPLE PATTERN-URI
     */
    formatEmailHTMLMultiple(matchData, validPatterns, odds = null) {
        const { matchId, homeTeam, awayTeam, leagueName, country, scor, statistici } = matchData;

        const { isTopLeague } = require('./TOP_LEAGUES');
        const isTop30 = isTopLeague(leagueName);

        const maxProb = Math.max(...validPatterns.map(p => p.probability));

        // Grupează pattern-uri pe echipă
        const gazdaPatterns = validPatterns.filter(p => p.team === 'gazda');
        const oaspetePatterns = validPatterns.filter(p => p.team === 'oaspete');
        const meciPatterns = validPatterns.filter(p => !p.team || p.team === 'meci');

        // Generează HTML pattern-uri
        let patternsHTML = '';

        const sections = [
            { patterns: gazdaPatterns, icon: '🏠', label: homeTeam },
            { patterns: oaspetePatterns, icon: '✈️', label: awayTeam },
            { patterns: meciPatterns, icon: '⚽', label: 'Meci' }
        ];

        for (const section of sections) {
            if (section.patterns.length === 0) continue;
            const count = section.patterns.length;
            patternsHTML += `<div style="margin: 15px 0;">
                <h3 style="color: #1976d2; margin: 0 0 8px 0;">${section.icon} ${section.label} (${count} ${count === 1 ? 'predicție' : 'predicții'}):</h3>`;
            section.patterns.forEach(p => {
                patternsHTML += this._formatPatternHTML(p, section.label, odds);
            });
            patternsHTML += `</div>`;
        }

        // Liga badge
        const leagueBadge = isTop30
            ? `<span style="display: inline-block; background-color: #4caf50; color: white; padding: 2px 10px; border-radius: 12px; font-size: 11px; margin-left: 8px;">TOP 30</span>`
            : `<span style="display: inline-block; background-color: #ff9800; color: white; padding: 2px 10px; border-radius: 12px; font-size: 11px; margin-left: 8px;">Liga secundara</span>`;

        // Statistici adiționale dacă sunt disponibile
        let extraStatsHTML = '';
        if (statistici.faulturi && (statistici.faulturi.pauza_gazda > 0 || statistici.faulturi.pauza_oaspete > 0)) {
            extraStatsHTML += `<tr><td>⚠️ Faulturi</td><td>${statistici.faulturi.pauza_gazda} vs ${statistici.faulturi.pauza_oaspete}</td></tr>`;
        }
        if (statistici.ofsaiduri && (statistici.ofsaiduri.pauza_gazda > 0 || statistici.ofsaiduri.pauza_oaspete > 0)) {
            extraStatsHTML += `<tr><td>🚫 Ofsaiduri</td><td>${statistici.ofsaiduri.pauza_gazda} vs ${statistici.ofsaiduri.pauza_oaspete}</td></tr>`;
        }
        if (statistici.posesie && statistici.posesie.pauza_gazda) {
            extraStatsHTML += `<tr><td>⚽ Posesie</td><td>${statistici.posesie.pauza_gazda}% vs ${statistici.posesie.pauza_oaspete}%</td></tr>`;
        }
        if (statistici.xG && statistici.xG.pauza_gazda) {
            extraStatsHTML += `<tr><td>📊 xG</td><td>${statistici.xG.pauza_gazda} vs ${statistici.xG.pauza_oaspete}</td></tr>`;
        }

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
        .container { background-color: white; border-radius: 10px; padding: 30px; max-width: 700px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; margin: -30px -30px 20px -30px; }
        .header h1 { margin: 0; font-size: 22px; }
        .match-info { background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .match-info h2 { margin: 0 0 8px 0; color: #333; font-size: 20px; }
        .score { font-size: 36px; font-weight: bold; color: #667eea; text-align: center; margin: 12px 0; }
        .stats-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        .stats-table td { padding: 8px 10px; border-bottom: 1px solid #e0e0e0; font-size: 13px; }
        .stats-table td:first-child { font-weight: bold; color: #555; width: 50%; }
        .footer { text-align: center; color: #999; font-size: 11px; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e0e0e0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 ${validPatterns.length === 1 ? '1 PREDICȚIE' : validPatterns.length + ' PREDICȚII'} LA PAUZĂ</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">${homeTeam} vs ${awayTeam}</p>
        </div>

        <div class="match-info">
            <h2>⚽ ${homeTeam} vs ${awayTeam}</h2>
            <p style="margin: 5px 0; color: #666;">🏆 ${leagueName || 'N/A'} ${leagueBadge}</p>
            <div class="score">${scor.pauza_gazda} - ${scor.pauza_oaspete}</div>
            <p style="text-align: center; color: #999; margin: 0; font-size: 13px;">Scor la pauza</p>
        </div>

        ${patternsHTML}

        <h3 style="color: #333; margin: 20px 0 8px 0; font-size: 15px;">📊 Statistici la pauza</h3>
        <table class="stats-table">
            <tr><td>🎯 Suturi pe poarta</td><td>${statistici.suturi_pe_poarta.pauza_gazda} vs ${statistici.suturi_pe_poarta.pauza_oaspete}</td></tr>
            <tr><td>⚽ Total suturi</td><td>${statistici.total_suturi.pauza_gazda} vs ${statistici.total_suturi.pauza_oaspete}</td></tr>
            <tr><td>🚩 Cornere</td><td>${statistici.cornere.repriza_1_gazda} vs ${statistici.cornere.repriza_1_oaspete}</td></tr>
            <tr><td>🟨 Cartonase galbene</td><td>${statistici.cartonase_galbene.pauza_gazda} vs ${statistici.cartonase_galbene.pauza_oaspete}</td></tr>
            <tr><td>🧤 Suturi salvate</td><td>${statistici.suturi_salvate.pauza_gazda} vs ${statistici.suturi_salvate.pauza_oaspete}</td></tr>
            ${extraStatsHTML}
        </table>

        ${gazdaPatterns.length > 0 ? this.generateTeamHistoryHTML(homeTeam) : ''}
        ${oaspetePatterns.length > 0 ? this.generateTeamHistoryHTML(awayTeam) : ''}

        <div class="footer">
            <p>API SMART 5 - Halftime Pattern Detection</p>
            <p>${new Date().toLocaleString('ro-RO')}</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Trimite notificare email (legacy - pentru backwards compatibility)
     */
    async sendNotification(matchData, patternData, probability) {
        if (!emailService.isAvailable()) {
            logger.info('   ⚠️  Email service nu este disponibil, skip notificare');
            return false;
        }

        try {
            const { homeTeam, awayTeam, leagueName } = matchData;
            const { patternId, team } = patternData;

            const teamName = team === 'gazda' ? homeTeam : (team === 'oaspete' ? awayTeam : 'Meci');
            const prob = Math.round(probability);

            const subject = `🚨 ${prob}% ȘANSE | ${teamName} vs ${team === 'gazda' ? awayTeam : homeTeam} | ${leagueName}`;
            const html = this.formatEmailHTML(matchData, patternData, probability);

            const result = await emailService.send({
                subject: subject,
                html: html
            });

            if (!result.success) {
                throw new Error(result.error || 'Email service unavailable');
            }

            logger.info(`   ✅ Email trimis: ${result.messageId}`);
            return true;

        } catch (error) {
            logger.error(`   ❌ Eroare la trimitere email: ${error.message}`);
            return false;
        }
    }
}

module.exports = EmailNotifier;
