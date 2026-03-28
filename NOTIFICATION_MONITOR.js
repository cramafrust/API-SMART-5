/**
 * NOTIFICATION MONITOR
 *
 * Monitorizează notificările active la fiecare 60 secunde
 * Verifică:
 * - Cota actuală
 * - Dacă cota ≥ 1.50 → salvează minutul
 * - Dacă cota ≥ 2.00 → salvează minutul
 * - Dacă pronosticul s-a îndeplinit → salvează minutul
 * - Dacă meciul s-a terminat → marchează ca eșuat dacă nu s-a îndeplinit
 */

const NotificationTracker = require('./NOTIFICATION_TRACKER');
// NOTA: Puppeteer scraper eliminat - cotele sunt monitorizate de ODDS_MONITOR_SIMPLE
const Odd150Notifier = require('./ODD_150_NOTIFIER');
const { fetchMatchDetails } = require('./flashscore-api');
const lifecycle = require('./LIFECYCLE_MANAGER');
const logger = require('./LOG_MANAGER');
const memoryThrottle = require('./MEMORY_THROTTLE');

class NotificationMonitor {
    constructor() {
        this.checkInterval = 60 * 1000; // 60 secunde
        this.intervalId = null;
        this.running = false;
        this.startTime = null;
        this.maxRuntime = null; // ← ELIMINAT: Monitorul rulează nelimitat (restart zilnic via cron)
    }

    /**
     * Obține minutul curent al meciului de pe Flashscore
     * Extrage din ultimul incident înregistrat (gol, cartonaș, schimbare)
     */
    async getCurrentMinute(matchId) {
        try {
            const details = await fetchMatchDetails(matchId);

            // Verificare de siguranță: details.summary trebuie să existe
            if (!details || !details.summary || !Array.isArray(details.summary)) {
                logger.warn(`   ⚠️  Summary invalid pentru ${matchId}, returnez null`);
                return null;
            }

            // Extrage toate incidentele cu minute din summary
            const incidents = details.summary.filter(r => r.IB && r.IB.match(/\d+/));

            if (incidents.length === 0) {
                // Dacă nu sunt incidente, meciul poate fi la început (minutul 0-5)
                return 0;
            }

            // Ultimul incident
            const lastIncident = incidents[incidents.length - 1];
            const minuteMatch = lastIncident.IB.match(/(\d+)/);

            if (minuteMatch) {
                const minute = parseInt(minuteMatch[1]);
                // Adaugă ~2 minute pentru timpul curent (estimare)
                return minute + 2;
            }

            return null;
        } catch (error) {
            logger.error(`   ⚠️  Eroare obținere minut pentru ${matchId}: ${error.message}`);
            return null;
        }
    }

    /**
     * Verifică dacă meciul s-a terminat
     * Verifică câmpul AZ din core data (AZ = 1 înseamnă finalizat)
     */
    async isMatchFinished(matchId) {
        try {
            const details = await fetchMatchDetails(matchId);

            // AZ = 1 înseamnă meci finalizat
            if (details.core && details.core.AZ === '1') {
                return true;
            }

            return false;
        } catch (error) {
            logger.error(`   ⚠️  Eroare verificare status meci ${matchId}: ${error.message}`);
            return false;
        }
    }

    /**
     * Verifică dacă un gol a fost validat VAR
     */
    async isGoalConfirmed(matchId, goalCount) {
        // TODO: Implementare verificare VAR
        // Momentan returnăm true (presupunem că golul e valid)
        // În viitor, putem verifica exact cu API-ul Flashscore dacă golul e confirmat
        return true;
    }

    /**
     * Verifică dacă pronosticul s-a îndeplinit
     * Extrage scorul din repriza 2 și verifică dacă a fost gol
     */
    async checkIfFulfilled(notification) {
        const pattern = notification.pattern;
        const matchId = notification.matchId;

        try {
            const details = await fetchMatchDetails(matchId);

            // Verificare de siguranță: details.summary trebuie să existe
            if (!details || !details.summary || !Array.isArray(details.summary)) {
                logger.warn(`   ⚠️  Summary invalid pentru verificare ${matchId}`);
                return false;
            }

            // Extrage scorul din repriza 2
            let homeGoals = 0;
            let awayGoals = 0;

            // Caută în summary record-ul pentru repriza 2
            const secondHalf = details.summary.find(r => r.AC === '2nd Half');
            if (secondHalf) {
                homeGoals = parseInt(secondHalf.IG) || 0;
                awayGoals = parseInt(secondHalf.IH) || 0;
            }

            // Verifică tipul de eveniment
            // notification.event poate fi obiect {description: string} sau string
            const eventText = typeof notification.event === 'object' && notification.event.description
                ? notification.event.description
                : (typeof notification.event === 'string' ? notification.event : '');
            const eventLower = eventText.toLowerCase();

            // GOL ECHIPA 1/GAZDA
            if (eventLower.includes('echipa 1') || eventLower.includes('echip gazda') || pattern.team === 'gazda') {
                if (homeGoals > 0) {
                    // Verifică VAR
                    const confirmed = await this.isGoalConfirmed(matchId, homeGoals);
                    return confirmed;
                }
            }

            // GOL ECHIPA 2/OASPETE
            if (eventLower.includes('echipa 2') || eventLower.includes('echip oaspete') || pattern.team === 'oaspete') {
                if (awayGoals > 0) {
                    // Verifică VAR
                    const confirmed = await this.isGoalConfirmed(matchId, awayGoals);
                    return confirmed;
                }
            }

            // ORICE GOL
            if (eventLower.includes('gol') && pattern.team !== 'gazda' && pattern.team !== 'oaspete') {
                if ((homeGoals + awayGoals) > 0) {
                    return true;
                }
            }

            // CORNERE (verifică dacă au fost 2+ cornere)
            if (eventLower.includes('corner')) {
                // TODO: Implementare verificare cornere din statsData
                return false;
            }

            // CARTONAȘE
            if (eventLower.includes('cartonaș') || eventLower.includes('card')) {
                // TODO: Implementare verificare cartonașe din statsData
                return false;
            }

            return false;
        } catch (error) {
            logger.error(`   ⚠️  Eroare verificare îndeplinire pentru ${matchId}: ${error.message}`);
            return false;
        }
    }

    /**
     * Verifică o notificare
     */
    async checkNotification(notification) {
        logger.info(`\n🔍 Checking: ${notification.match}`);
        logger.info(`   Event: ${typeof notification.event === 'object' ? JSON.stringify(notification.event) : notification.event}`);
        logger.info(`   Status: ${notification.status}`);

        try {
            // 1. Verifică dacă meciul s-a terminat
            const finished = await this.isMatchFinished(notification.matchId);
            if (finished) {
                logger.info(`   ⏹️  Match finished`);

                // Verifică dacă s-a îndeplinit înainte să marcăm ca eșuat
                const fulfilled = await this.checkIfFulfilled(notification);
                if (!fulfilled && notification.minute_fulfilled === null) {
                    NotificationTracker.markFailed(notification.id);
                    logger.info(`   ❌ Marked as FAILED`);
                }
                return;
            }

            // 2. Obține minutul curent
            const currentMinute = await this.getCurrentMinute(notification.matchId);
            if (currentMinute === null) {
                logger.info(`   ⚠️  Could not get current minute`);
                return;
            }

            logger.info(`   ⏱️  Current minute: ${currentMinute}`);

            // 3. Verifică dacă s-a îndeplinit pronosticul
            const fulfilled = await this.checkIfFulfilled(notification);
            if (fulfilled && notification.minute_fulfilled === null) {
                NotificationTracker.markFulfilled(notification.id, currentMinute);
                logger.info(`   ✅ FULFILLED at minute ${currentMinute}!`);
                return;
            }

            // 4. Cotele sunt monitorizate de ODDS_MONITOR_SIMPLE (nu mai folosim Puppeteer aici)
            //    Acest monitor verifică doar: meci terminat, pronostic îndeplinit, minut curent
            logger.info(`   ⏳ Meci în desfășurare (min ${currentMinute}). Cote monitorizate de ODDS_MONITOR_SIMPLE.`);

        } catch (error) {
            logger.error(`   ❌ Error checking notification: ${error.message}`);
        }
    }

    /**
     * Verifică toate notificările active
     */
    async checkAll() {
        // Memory throttle: skip procesare când memoria e critică
        if (memoryThrottle.isThrottled) {
            logger.info('⏸️  [NOTIFICATION_MONITOR] Paused - memory throttle active');
            return;
        }

        logger.info('\n' + '='.repeat(80));
        logger.info(`🔔 NOTIFICATION MONITOR - ${new Date().toLocaleTimeString('ro-RO')}`);
        logger.info('='.repeat(80));

        // ✅ ELIMINAT: Nu mai verificăm maxRuntime
        // Monitorul rulează nelimitat, va fi restartat zilnic de cron job

        let activeNotifications = NotificationTracker.getActiveNotifications();

        // FILTRARE DUPĂ DATĂ: Elimină meciurile care nu sunt din astăzi
        const today = new Date().toLocaleDateString('ro-RO'); // Format: DD.MM.YYYY
        const beforeDateFilter = activeNotifications.length;

        activeNotifications = activeNotifications.filter(n => {
            if (!n.date) {
                logger.warn(`⚠️  Notificare fără dată: ${n.match} - SKIP`);
                return false;
            }

            // Verifică dacă data notificării = data de astăzi
            if (n.date !== today) {
                logger.info(`📅 Meci vechi (${n.date}): ${n.match} - SKIP`);

                // Marchează notificare veche ca FAILED pentru a nu mai fi verificată
                NotificationTracker.updateNotification(n.id, {
                    status: 'FAILED',
                    result: 'SKIPPED',
                    failureReason: `Notificare din ${n.date} - oprită automat (data curentă: ${today})`
                });

                return false;
            }

            return true;
        });

        if (beforeDateFilter > activeNotifications.length) {
            logger.info(`🗑️  Eliminate ${beforeDateFilter - activeNotifications.length} notificări vechi`);
        }

        logger.info(`\n📊 Active notifications (din ${today}): ${activeNotifications.length}`);

        if (activeNotifications.length === 0) {
            logger.info('   ⏳ Aștept pattern-uri detectate... (monitorul continuă să ruleze)');
            logger.info('='.repeat(80) + '\n');
            return; // ← NU oprește monitorul, doar skip verificarea
        }

        // FILTRARE DUPĂ STATUS MECI: Elimină rapid meciurile deja terminate sau prea avansate
        // Verificare batch pentru eficiență - eliminăm meciurile terminate înainte să le procesăm individual
        const beforeFinishedFilter = activeNotifications.length;
        const stillActiveNotifications = [];

        for (const notification of activeNotifications) {
            try {
                const finished = await this.isMatchFinished(notification.matchId);
                if (finished) {
                    logger.info(`⏹️  Meci terminat: ${notification.match} - Verificare finală...`);

                    // Verifică o ultimă dată dacă s-a îndeplinit
                    const fulfilled = await this.checkIfFulfilled(notification);
                    if (fulfilled) {
                        NotificationTracker.markFulfilled(notification.id, 90);
                        logger.info(`   ✅ Marcat FULFILLED`);
                    } else {
                        NotificationTracker.markFailed(notification.id);
                        logger.info(`   ❌ Marcat FAILED`);
                    }
                    continue; // SKIP - meci terminat
                }

                // Verifică minutul curent - dacă > 80, nu mai are sens să urmărim cotele
                // EXCEPTIE: dacă are flag skipMinuteFilter, nu verificăm minutul
                if (!notification.skipMinuteFilter) {
                    const currentMinute = await this.getCurrentMinute(notification.matchId);
                    if (currentMinute !== null && currentMinute > 80) {
                        logger.info(`⏱️  Meci prea avansat (min ${currentMinute}): ${notification.match} - Verificare finală...`);

                        // Verifică dacă s-a îndeplinit
                        const fulfilled = await this.checkIfFulfilled(notification);
                        if (fulfilled) {
                            NotificationTracker.markFulfilled(notification.id, currentMinute);
                            logger.info(`   ✅ Marcat FULFILLED la min ${currentMinute}`);
                        } else {
                            // Marcăm ca COMPLETED (nu FAILED) - meciul nu s-a terminat oficial, dar e prea târziu
                            NotificationTracker.updateNotification(notification.id, {
                                status: 'COMPLETED',
                                result: 'EXPIRED',
                                failureReason: `Meci prea avansat (min ${currentMinute} > 80) - STOP monitorizare cote`
                            });
                            logger.info(`   ⏭️  Marcat COMPLETED (prea târziu pentru cote)`);
                        }
                        continue; // SKIP - meci prea avansat
                    }
                } else {
                    logger.info(`   🔓 Skip filtrare minut pentru: ${notification.match}`);
                }

                // Meci valid - încă în curs și mai puțin de 80 de minute
                stillActiveNotifications.push(notification);

            } catch (error) {
                // În caz de eroare, păstrăm notificarea pentru verificare individuală
                logger.warn(`   ⚠️  Eroare verificare status ${notification.match}: ${error.message}`);
                stillActiveNotifications.push(notification);
            }
        }

        activeNotifications = stillActiveNotifications;

        if (beforeFinishedFilter > activeNotifications.length) {
            logger.info(`⏹️  Eliminate ${beforeFinishedFilter - activeNotifications.length} meciuri terminate\n`);
        }

        if (activeNotifications.length === 0) {
            logger.info('   ✅ Toate meciurile s-au terminat');
            logger.info('='.repeat(80) + '\n');
            return;
        }

        logger.info(`📊 Meciuri active (în curs): ${activeNotifications.length}\n`);

        // Verifică fiecare notificare (doar meciurile în curs)
        for (const notification of activeNotifications) {
            await this.checkNotification(notification);
        }

        // Afișează statistici
        const stats = NotificationTracker.generateStats();
        logger.info('\n📈 STATISTICS:');
        logger.info(`   Total: ${stats.total}`);
        logger.info(`   Monitoring: ${stats.monitoring}`);
        logger.info(`   Completed: ${stats.completed}`);
        logger.info(`   Failed: ${stats.failed}`);
        logger.info(`   Success rate: ${stats.successRate}%`);

        logger.info('\n' + '='.repeat(80) + '\n');
    }

    /**
     * Pornește monitorizarea automată
     */
    start() {
        if (this.running) {
            logger.info('⚠️  Monitor already running!');
            return;
        }

        logger.info('\n' + '='.repeat(80));
        logger.info('🚀 STARTING NOTIFICATION MONITOR');
        logger.info('='.repeat(80));
        logger.info(`   Check interval: ${this.checkInterval / 1000} seconds`);
        logger.info(`   Runtime: ♾️  NELIMITAT (restart zilnic via cron)`);
        logger.info('='.repeat(80) + '\n');

        this.running = true;
        this.startTime = Date.now(); // Track start time

        // Run first check immediately
        this.checkAll();

        // Schedule periodic checks
        lifecycle.setInterval('notification-monitor', () => {
            this.checkAll();
        }, this.checkInterval);
    }

    /**
     * Oprește monitorizarea
     */
    stop() {
        if (!this.running) {
            logger.info('⚠️  Monitor not running!');
            return;
        }

        logger.info('\n🛑 Stopping notification monitor...\n');

        lifecycle.clearInterval('notification-monitor');

        this.running = false;
        this.startTime = null; // Reset start time
    }
}

// Export singleton
module.exports = new NotificationMonitor();

// Allow running as standalone script
if (require.main === module) {
    const monitor = module.exports;
    monitor.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        logger.info('\n\nReceived SIGINT. Shutting down gracefully...');
        monitor.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        logger.info('\n\nReceived SIGTERM. Shutting down gracefully...');
        monitor.stop();
        process.exit(0);
    });
}
