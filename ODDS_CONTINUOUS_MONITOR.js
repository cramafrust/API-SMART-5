/**
 * ODDS CONTINUOUS MONITOR
 *
 * Monitorizează CONTINUU cotele live pentru meciurile cu pattern-uri detectate
 *
 * LOGICĂ:
 * 1. La fiecare 2 MINUTE verifică meciurile în MONITORING
 * 2. Pentru fiecare meci:
 *    - PRIORITATE 1: Verifică dacă pronosticul S-A ÎNDEPLINIT (gol marcat)
 *    - PRIORITATE 2: Verifică COTELE (dacă nu s-a îndeplinit)
 *    - Trimite EMAIL când cota CREȘTE la >= 1.5
 *    - Trimite EMAIL când cota CREȘTE la >= 2.0
 *    - Marchează CÂȘTIGAT/PIERDUT la final
 */

const tracker = require('./NOTIFICATION_TRACKER');
const SuperbetLiveOdds = require('../superbet-analyzer/SUPERBET_LIVE_ODDS');
const { fetchMatchDetails } = require('./flashscore-api');
const emailService = require('./EMAIL_SERVICE');
const lifecycle = require('./LIFECYCLE_MANAGER');

class OddsContinuousMonitor {
    constructor() {
        this.tracker = tracker;
        this.oddsExtractor = new SuperbetLiveOdds();
        this.isRunning = false;
        this.checkInterval = 2 * 60 * 1000; // 2 minute
        this.timerName = 'odds-continuous-monitor';
    }

    /**
     * Verifică dacă pronosticul s-a îndeplinit
     * Extrage scorul LIVE și verifică dacă echipa a marcat în R2
     */
    async checkPronosticFulfilled(notification) {
        try {
            // Extrage scorul live de la FlashScore
            const matchDetails = await fetchMatchDetails(notification.matchId);

            if (!matchDetails || !matchDetails.summary) {
                return { fulfilled: false, reason: 'Nu pot verifica scor' };
            }

            // Parsare scor
            const scor = this.parseScore(matchDetails.summary);

            if (!scor) {
                return { fulfilled: false, reason: 'Scor invalid' };
            }

            // Verifică în funcție de pattern
            const pattern = notification.pattern;

            // PATTERN_1.x, PATTERN_2.x, PATTERN_5.x → echipa trebuie să marcheze în R2
            if (pattern.team === 'gazda') {
                const goluriR2 = scor.final.gazda - scor.pauza.gazda;
                if (goluriR2 > 0) {
                    return {
                        fulfilled: true,
                        reason: `${notification.homeTeam} a marcat ${goluriR2} gol(uri) în R2`,
                        currentScore: `${scor.final.gazda}-${scor.final.oaspete}`
                    };
                }
            } else if (pattern.team === 'oaspete') {
                const goluriR2 = scor.final.oaspete - scor.pauza.oaspete;
                if (goluriR2 > 0) {
                    return {
                        fulfilled: true,
                        reason: `${notification.awayTeam} a marcat ${goluriR2} gol(uri) în R2`,
                        currentScore: `${scor.final.gazda}-${scor.final.oaspete}`
                    };
                }
            }

            // Nu s-a îndeplinit încă
            return {
                fulfilled: false,
                reason: 'Nu s-a marcat încă',
                currentScore: `${scor.final.gazda}-${scor.final.oaspete}`,
                isFinished: matchDetails.status === 'finished'
            };

        } catch (error) {
            console.error(`   ⚠️  Eroare verificare pronostic: ${error.message}`);
            return { fulfilled: false, reason: 'Eroare verificare' };
        }
    }

    /**
     * Parsează scorul din summary FlashScore
     */
    parseScore(summary) {
        try {
            // Summary format: [{period: 'HT', home: '0', away: '0'}, {period: 'FT', home: '1', away: '0'}]
            const ht = summary.find(s => s.period === 'HT');
            const ft = summary.find(s => s.period === 'FT' || s.period === 'Current');

            if (!ht || !ft) return null;

            return {
                pauza: {
                    gazda: parseInt(ht.home) || 0,
                    oaspete: parseInt(ht.away) || 0
                },
                final: {
                    gazda: parseInt(ft.home) || 0,
                    oaspete: parseInt(ft.away) || 0
                }
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Extrage cote LIVE pentru un meci
     * IMPORTANT: MAX 15 încercări pentru găsire meci, apoi 5 retry-uri pentru cote
     */
    async getLiveOdds(homeTeam, awayTeam, expectedScore = null) {
        const MAX_MATCH_RETRIES = 15;  // Încercări de găsire meci pe Superbet
        const MAX_ODDS_RETRIES = 5;    // Retry-uri pentru obținere cote după ce meciul e găsit
        const RETRY_DELAY = 40000;     // 40 secunde între retry-uri (conform documentației)

        let eventId = null;

        // ETAPA 1: Găsește meciul pe Superbet (MAX 15 încercări)
        console.log(`   🔍 ETAPA 1: Căutare meci pe Superbet...`);
        for (let attempt = 1; attempt <= MAX_MATCH_RETRIES; attempt++) {
            try {
                console.log(`   🔄 Încercare ${attempt}/${MAX_MATCH_RETRIES} - Căutare: ${homeTeam} vs ${awayTeam}`);

                eventId = await this.oddsExtractor.findEventId(homeTeam, awayTeam);

                if (eventId) {
                    console.log(`   ✅ Event ID găsit: ${eventId} (la încercarea ${attempt})`);
                    break; // GĂSIT - trecem la etapa 2
                }

                if (attempt < MAX_MATCH_RETRIES) {
                    console.log(`   ⏳ Meci nu găsit, retry în ${RETRY_DELAY/1000}s (${Math.floor(RETRY_DELAY/1000/60)}m ${(RETRY_DELAY/1000)%60}s)...`);
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                } else {
                    return { available: false, reason: `Meci nu găsit pe Superbet după ${MAX_MATCH_RETRIES} încercări` };
                }

            } catch (error) {
                console.error(`   ⚠️  Eroare căutare meci (încercarea ${attempt}): ${error.message}`);
                if (attempt < MAX_MATCH_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                } else {
                    return { available: false, reason: `Eroare căutare meci: ${error.message}` };
                }
            }
        }

        if (!eventId) {
            return { available: false, reason: `Meci nu găsit după ${MAX_MATCH_RETRIES} încercări` };
        }

        // ETAPA 2: Verifică scorul (dacă e furnizat)
        if (expectedScore) {
            try {
                const matchData = await this.oddsExtractor.getMatchScore(eventId);
                if (matchData && matchData.score !== expectedScore) {
                    console.log(`   ⚠️  Scor necorespunzător: așteptat ${expectedScore}, găsit ${matchData.score}`);
                    return { available: false, reason: `Scor necorespunzător (așteptat: ${expectedScore})` };
                }
                console.log(`   ✅ Scor confirmat: ${expectedScore}`);
            } catch (error) {
                console.log(`   ⚠️  Nu s-a putut verifica scorul: ${error.message}`);
                // Continuăm oricum, verificarea scorului e opțională
            }
        }

        // ETAPA 3: Extrage cotele (MAX 5 retry-uri)
        console.log(`   💰 ETAPA 2: Extragere cote live...`);
        for (let attempt = 1; attempt <= MAX_ODDS_RETRIES; attempt++) {
            try {
                console.log(`   🔄 Încercare cote ${attempt}/${MAX_ODDS_RETRIES}`);

                const odds = await this.oddsExtractor.getLiveOdds(eventId);

                if (!odds || !odds.markets) {
                    if (attempt < MAX_ODDS_RETRIES) {
                        console.log(`   ⏳ Cote indisponibile, retry în ${RETRY_DELAY/1000}s...`);
                        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                        continue;
                    }
                    return { available: false, reason: `Cote indisponibile după ${MAX_ODDS_RETRIES} încercări` };
                }

                // Extrage "Total Goluri" - peste 1.5 și peste 2.5
                const totalGoals = this.extractTotalGoalsOdds(odds.markets);

                if (!totalGoals) {
                    if (attempt < MAX_ODDS_RETRIES) {
                        console.log(`   ⏳ Cote Total Goluri indisponibile, retry în ${RETRY_DELAY/1000}s...`);
                        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                        continue;
                    }
                    return { available: false, reason: `Cote Total Goluri indisponibile după ${MAX_ODDS_RETRIES} încercări` };
                }

                // SUCCESS!
                console.log(`   ✅ Cote extrase cu succes!`);
                console.log(`   📊 Peste 1.5: ${totalGoals.peste_1_5} | Peste 2.5: ${totalGoals.peste_2_5}`);
                return {
                    available: true,
                    peste_1_5: totalGoals.peste_1_5,
                    peste_2_5: totalGoals.peste_2_5,
                    status: odds.status,
                    matchAttempts: 1, // Găsit la prima căutare în acest ciclu
                    oddsAttempts: attempt
                };

            } catch (error) {
                console.error(`   ⚠️  Eroare extragere cote (încercarea ${attempt}): ${error.message}`);
                if (attempt < MAX_ODDS_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                } else {
                    return { available: false, reason: `Eroare cote: ${error.message}` };
                }
            }
        }

        return { available: false, reason: `Nu s-au putut obține cote după ${MAX_ODDS_RETRIES} încercări` };
    }

    /**
     * Extrage cotele pentru "Total Goluri" din markets
     */
    extractTotalGoalsOdds(markets) {
        try {
            // Caută market "Total goluri"
            const totalGoalsMarket = markets.find(m => {
                const name = (m.name || '').toLowerCase();
                return name.includes('total') && name.includes('goluri');
            });

            if (!totalGoalsMarket || !totalGoalsMarket.odds) {
                return null;
            }

            const result = {};

            // Extrage peste 1.5 și peste 2.5
            totalGoalsMarket.odds.forEach(odd => {
                if (!odd.metadata || !odd.price) return;

                const name = (odd.metadata.name || '').toLowerCase();
                const info = (odd.metadata.info || '').toLowerCase();

                if (name.includes('peste 1.5') || info.includes('peste 1.5')) {
                    result.peste_1_5 = odd.price;
                }
                if (name.includes('peste 2.5') || info.includes('peste 2.5')) {
                    result.peste_2_5 = odd.price;
                }
            });

            return result.peste_1_5 && result.peste_2_5 ? result : null;

        } catch (error) {
            return null;
        }
    }

    /**
     * Trimite EMAIL când cota atinge pragul
     */
    async sendOddsThresholdEmail(notification, threshold, currentOdd) {
        try {
            const subject = `🎯 Cotă ${threshold} atinsă - ${notification.match}`;

            const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
        .container { background-color: white; border-radius: 10px; padding: 30px; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 24px; }
        .odds-box { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; }
        .odds-value { font-size: 48px; font-weight: bold; color: #ff6b6b; text-align: center; margin: 20px 0; }
        .match-info { background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Alertă Cotă ${threshold}</h1>
        </div>

        <div class="match-info">
            <h2 style="margin: 0 0 10px 0;">${notification.match}</h2>
            <p style="margin: 5px 0;"><strong>Pronostic:</strong> ${notification.event}</p>
        </div>

        <div class="odds-box">
            <h3 style="margin-top: 0;">Cota PESTE ${threshold === '1.50' ? '1.5' : '2.5'} GOLURI</h3>
            <div class="odds-value">${currentOdd.toFixed(2)}</div>
            <p style="text-align: center; color: #666;">
                Cota a ajuns la <strong>${currentOdd.toFixed(2)}</strong> (prag: ${threshold})
            </p>
        </div>

        <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>📊 Probabilitate pattern:</strong> ${notification.probability}%</p>
            <p style="margin: 5px 0 0 0;"><strong>💰 Cotă inițială (la HT):</strong> ${notification.initial_odd}</p>
        </div>

        <div class="footer">
            <p>⚽ API SMART 5 - Monitorizare Cote Live</p>
            <p>${new Date().toLocaleString('ro-RO')}</p>
        </div>
    </div>
</body>
</html>
            `;

            const result = await emailService.send({
                subject: subject,
                html: html
            });

            if (result.success) {
                console.log(`   ✅ Email trimis: Cotă ${threshold} atinsă (${currentOdd.toFixed(2)})`);
                return true;
            } else {
                console.log(`   ⚠️  Email nu a fost trimis: ${result.error || 'Email service unavailable'}`);
                return false;
            }

        } catch (error) {
            console.error(`   ❌ Eroare trimitere email: ${error.message}`);
            return false;
        }
    }

    /**
     * Procesează UN meci - LOGICA PRINCIPALĂ
     */
    async processMatch(notification) {
        const now = new Date().toLocaleTimeString('ro-RO');
        console.log(`\n⏰ ${now} - Verificare: ${notification.match}`);

        // PRIORITATE 1: Verifică dacă pronosticul s-a ÎNDEPLINIT
        console.log('   🔍 Verificare pronostic...');
        const pronosticCheck = await this.checkPronosticFulfilled(notification);

        if (pronosticCheck.fulfilled) {
            // ✅ PRONOSTIC ÎNDEPLINIT - CÂȘTIGAT!
            console.log(`   ✅ PRONOSTIC ÎNDEPLINIT: ${pronosticCheck.reason}`);
            console.log(`   📊 Scor: ${pronosticCheck.currentScore}`);

            this.tracker.updateNotification(notification.id, {
                status: 'CÂȘTIGAT',
                minute_fulfilled: this.extractCurrentMinute(),
                final_score: pronosticCheck.currentScore
            });

            console.log('   🏆 Salvat ca CÂȘTIGAT - STOP monitorizare');
            return; // STOP pentru acest meci
        }

        // Verifică dacă meciul s-a terminat fără să se îndeplinească
        if (pronosticCheck.isFinished) {
            console.log(`   ❌ MECI TERMINAT fără să se îndeplinească pronosticul`);
            console.log(`   📊 Scor final: ${pronosticCheck.currentScore}`);

            this.tracker.updateNotification(notification.id, {
                status: 'PIERDUT',
                final_score: pronosticCheck.currentScore
            });

            console.log('   💔 Salvat ca PIERDUT - STOP monitorizare');
            return; // STOP pentru acest meci
        }

        // PRIORITATE 2: Pronosticul NU s-a îndeplinit încă - Verifică COTELE
        console.log(`   ⚪ Nu s-a îndeplinit încă (${pronosticCheck.reason})`);
        console.log('   💰 Verificare cote live...');

        // Verifică câte încercări de obținere cote au fost făcute
        const attemptsCount = notification.oddsAttempts || 0;

        if (attemptsCount >= 15) {
            console.log(`   ⛔ STOP: S-au făcut deja 15 încercări de obținere cote`);
            console.log(`   ⚠️  Meciul nu a fost găsit pe Superbet - renunț la monitorizare cote`);

            this.tracker.updateNotification(notification.id, {
                oddsMonitoringFailed: true,
                oddsFailureReason: 'Meci nu găsit pe Superbet după 15 încercări'
            });

            return; // STOP monitorizare cote pentru acest meci
        }

        const odds = await this.getLiveOdds(notification.homeTeam, notification.awayTeam, pronosticCheck.currentScore);

        // Incrementăm numărul de încercări
        this.tracker.updateNotification(notification.id, {
            oddsAttempts: (attemptsCount + 1)
        });

        if (!odds.available) {
            console.log(`   ⚠️  Cote indisponibile: ${odds.reason}`);
            console.log(`   📊 Încercări făcute: ${attemptsCount + 1}/15`);

            if (attemptsCount + 1 >= 15) {
                console.log(`   ⛔ ATINGUT LIMITA de 15 încercări - STOP monitorizare cote`);
                this.tracker.updateNotification(notification.id, {
                    oddsMonitoringFailed: true,
                    oddsFailureReason: odds.reason
                });
            }

            return; // Reîncearcă în next cycle (dacă < 15)
        }

        console.log(`   📊 Cote: peste 1.5 = ${odds.peste_1_5.toFixed(2)}, peste 2.5 = ${odds.peste_2_5.toFixed(2)}`);

        // Verifică PRAG 1.5
        if (notification.minute_odd_1_50 === null) {
            // Nu s-a trimis email pentru 1.5 încă
            if (odds.peste_1_5 >= 1.50) {
                console.log(`   🎯 Cota peste 1.5 a ajuns la ${odds.peste_1_5.toFixed(2)} (>= 1.50)!`);

                // Trimite EMAIL
                await this.sendOddsThresholdEmail(notification, '1.50', odds.peste_1_5);

                // Marchează în tracker
                this.tracker.markOdd150(notification.id, this.extractCurrentMinute());

                console.log('   ✅ Email 1.50 trimis și marcat');
            } else {
                console.log(`   ⏳ Cota peste 1.5 = ${odds.peste_1_5.toFixed(2)} (< 1.50) - așteaptă...`);
            }
        }

        // Verifică PRAG 2.0
        if (notification.minute_odd_2_00 === null) {
            // Nu s-a trimis email pentru 2.0 încă
            if (odds.peste_2_5 >= 2.00) {
                console.log(`   🎯 Cota peste 2.5 a ajuns la ${odds.peste_2_5.toFixed(2)} (>= 2.00)!`);

                // Trimite EMAIL
                await this.sendOddsThresholdEmail(notification, '2.00', odds.peste_2_5);

                // Marchează în tracker
                this.tracker.markOdd200(notification.id, this.extractCurrentMinute());

                console.log('   ✅ Email 2.00 trimis și marcat');
            } else {
                console.log(`   ⏳ Cota peste 2.5 = ${odds.peste_2_5.toFixed(2)} (< 2.00) - așteaptă...`);
            }
        }

        if (notification.minute_odd_1_50 && notification.minute_odd_2_00) {
            console.log('   ✅ Ambele praguri atinse - continuă doar verificare îndeplinire');
        }
    }

    /**
     * Extrage minutul curent estimat (aproximativ)
     */
    extractCurrentMinute() {
        // Simplificat - poate fi îmbunătățit cu date exacte de la FlashScore
        return new Date().getMinutes();
    }

    /**
     * Check cycle - rulează la fiecare 2 minute
     */
    async checkCycle() {
        console.log('\n' + '='.repeat(80));
        console.log('🔄 ODDS MONITOR - Check Cycle');
        console.log('='.repeat(80));

        // Obține meciurile în MONITORING
        let activeMatches = this.tracker.getActiveMonitoring();

        // Filtrează meciurile care au eșuat la monitorizarea cotelor
        activeMatches = activeMatches.filter(m => !m.oddsMonitoringFailed);

        // FILTRARE DUPĂ DATĂ: Elimină meciurile care nu sunt din astăzi
        const today = new Date().toLocaleDateString('ro-RO'); // Format: DD.MM.YYYY
        const beforeDateFilter = activeMatches.length;

        activeMatches = activeMatches.filter(m => {
            if (!m.date) {
                console.log(`⚠️  Meci fără dată: ${m.match} - SKIP`);
                return false;
            }

            // Verifică dacă data meciului = data de astăzi
            if (m.date !== today) {
                console.log(`📅 Meci vechi (${m.date}): ${m.match} - SKIP`);

                // Marchează meci vechi ca FAILED pentru a nu mai fi verificat
                this.tracker.updateNotification(m.id, {
                    status: 'FAILED',
                    oddsMonitoringFailed: true,
                    oddsFailureReason: `Meci din ${m.date} - oprit automat (data curentă: ${today})`
                });

                return false;
            }

            return true;
        });

        if (beforeDateFilter > activeMatches.length) {
            console.log(`🗑️  Eliminate ${beforeDateFilter - activeMatches.length} meciuri vechi`);
        }

        if (activeMatches.length === 0) {
            console.log('⚪ Niciun meci în monitorizare (după filtrare dată)');
            console.log('='.repeat(80));
            return;
        }

        console.log(`📊 Meciuri active (din ${today}): ${activeMatches.length}`);

        // Procesează fiecare meci
        for (const notification of activeMatches) {
            try {
                await this.processMatch(notification);
            } catch (error) {
                console.error(`❌ Eroare procesare ${notification.match}: ${error.message}`);
            }
        }

        console.log('='.repeat(80));
    }

    /**
     * Start monitoring
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️  Odds Monitor rulează deja');
            return;
        }

        console.log('\n' + '='.repeat(80));
        console.log('🚀 START ODDS CONTINUOUS MONITOR');
        console.log('='.repeat(80));
        console.log(`⏱️  Interval: ${this.checkInterval / 1000} secunde (2 minute)`);
        console.log(`🕐 Start: ${new Date().toLocaleString('ro-RO')}`);
        console.log('='.repeat(80));

        this.isRunning = true;

        // Prima verificare imediat - cu try-catch pentru erori
        this.checkCycle().catch(err => {
            console.error('❌ Eroare checkCycle() inițial:', err.message);
        });

        // Apoi la fiecare 2 minute - folosește LIFECYCLE_MANAGER
        lifecycle.setInterval(this.timerName, () => {
            this.checkCycle().catch(err => {
                console.error('❌ Eroare checkCycle():', err.message);
            });
        }, this.checkInterval);

        console.log('✅ Monitor pornit cu succes (tracked by LIFECYCLE_MANAGER)\n');
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (!this.isRunning) {
            console.log('⚠️  Odds Monitor nu rulează');
            return;
        }

        lifecycle.clearInterval(this.timerName);
        this.isRunning = false;

        console.log('\n' + '='.repeat(80));
        console.log('🛑 STOP ODDS CONTINUOUS MONITOR');
        console.log('='.repeat(80));
        console.log(`🕐 Stop: ${new Date().toLocaleString('ro-RO')}`);
        console.log('='.repeat(80) + '\n');
    }
}

// Export singleton (nu clasa)
module.exports = new OddsContinuousMonitor();
