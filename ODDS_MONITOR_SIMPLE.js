/**
 * ODDS MONITOR SIMPLU - FUNCȚIONEAZĂ GARANTAT
 *
 * - setInterval SIMPLU (fără LIFECYCLE_MANAGER)
 * - Verifică cote la fiecare 2 minute
 * - Trimite email automat la 1.5 și 2.0
 */

const tracker = require('./NOTIFICATION_TRACKER');
const SuperbetLiveOdds = require('../superbet-analyzer/SUPERBET_LIVE_ODDS');
const emailService = require('./EMAIL_SERVICE');
const fs = require('fs');
const path = require('path');
const winston = require('winston');
const memoryThrottle = require('./MEMORY_THROTTLE');

// Logger pentru combined.log (nu console)
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.File({
            filename: path.join(__dirname, 'logs', 'combined.log'),
            level: 'info'
        }),
        new winston.transports.Console()
    ]
});

class SimpleOddsMonitor {
    constructor() {
        this.oddsExtractor = new SuperbetLiveOdds();
        this.checkIntervalMs = 2 * 60 * 1000; // 2 minute
        this.intervalId = null;
        this.validationFile = path.join(__dirname, 'odds_validation_1.5.json');
        this.stateFile = path.join(__dirname, 'data', 'odds_monitor_state.json');
        // In-memory cache pentru a preveni trimiterea dublă (race condition cu fișierul)
        this.sentThresholds = new Set(); // Format: "notificationId_1.5" sau "notificationId_2.0"
        // Contor erori consecutive per meci — oprește monitorizarea după MAX_CONSECUTIVE_FAILURES
        this.consecutiveFailures = {}; // { notificationId: count }
        this.MAX_CONSECUTIVE_FAILURES = 5;

        // Restaurează starea de la ultimul run (previne emailuri duplicate la restart)
        this._restoreState();
    }

    /**
     * Salvează starea pe disc (sentThresholds + consecutiveFailures)
     */
    _saveState() {
        try {
            const state = {
                date: new Date().toISOString().split('T')[0],
                sentThresholds: [...this.sentThresholds],
                consecutiveFailures: this.consecutiveFailures,
                savedAt: new Date().toISOString()
            };
            fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2), 'utf8');
        } catch (e) {
            // Silent fail — nu blocăm monitorizarea pentru salvare state
        }
    }

    /**
     * Restaurează starea de la ultimul run (doar dacă e din aceeași zi)
     */
    _restoreState() {
        try {
            if (!fs.existsSync(this.stateFile)) return;
            const state = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
            const today = new Date().toISOString().split('T')[0];

            if (state.date === today) {
                this.sentThresholds = new Set(state.sentThresholds || []);
                this.consecutiveFailures = state.consecutiveFailures || {};
                logger.info(`   🔄 State restaurat: ${this.sentThresholds.size} thresholds, ${Object.keys(this.consecutiveFailures).length} failure counters`);
            } else {
                logger.info(`   🔄 State file din ${state.date} — ignorat (zi nouă)`);
            }
        } catch (e) {
            // State corupt — pornim fresh
        }
    }

    /**
     * Salvează notificarea de cota 1.5 pentru validare ulterioară
     */
    saveForValidation(notification, cotaMonitorizata, tipCota) {
        try {
            let validations = [];

            // Citește fișierul existent
            if (fs.existsSync(this.validationFile)) {
                const data = fs.readFileSync(this.validationFile, 'utf8');
                validations = JSON.parse(data);
            }

            // Adaugă noua notificare
            validations.push({
                id: notification.id,
                match: notification.match,
                homeTeam: notification.homeTeam,
                awayTeam: notification.awayTeam,
                league: notification.league,
                event: notification.event,
                pattern: notification.pattern,
                probability: notification.probability,

                // Detalii cota 1.5
                odd_1_5_reached: true,
                odd_1_5_value: cotaMonitorizata,
                odd_1_5_type: tipCota,
                odd_1_5_timestamp: new Date().toISOString(),
                odd_1_5_minute: new Date().toLocaleTimeString('ro-RO'),

                // Status validare
                validated: false,
                validation_result: null,
                validation_timestamp: null,

                // Date suplimentare
                date: notification.date,
                notifiedAt: notification.notifiedAt
            });

            // Salvează fișierul
            fs.writeFileSync(this.validationFile, JSON.stringify(validations, null, 2), 'utf8');

            logger.info(`   💾 Salvat pentru validare: ${this.validationFile}`);

        } catch (error) {
            logger.error(`   ⚠️  Eroare salvare validare: ${error.message}`);
        }
    }

    start() {
        logger.info('\n' + '='.repeat(80));
        logger.info('🚀 SIMPLE ODDS MONITOR - START');
        logger.info('='.repeat(80));
        logger.info(`⏱️  Interval: 2 minute`);
        logger.info(`🕐 Start: ${new Date().toLocaleString('ro-RO')}`);
        logger.info('='.repeat(80) + '\n');

        // Prima verificare IMEDIAT
        this.checkCycle().catch(err => {
            logger.error(`❌ Eroare checkCycle inițial: ${err.message}`);
        });

        // Apoi la fiecare 2 minute - setInterval SIMPLU
        this.intervalId = setInterval(() => {
            this.checkCycle().catch(err => {
                logger.error(`❌ Eroare checkCycle: ${err.message}`);
            });
        }, this.checkIntervalMs);

        logger.info('✅ SIMPLE ODDS MONITOR pornit!\n');
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger.info('🛑 SIMPLE ODDS MONITOR oprit');
        }
    }

    async checkCycle() {
        // Memory throttle: skip procesare când memoria e critică
        if (memoryThrottle.isThrottled) {
            logger.info('⏸️  [ODDS_MONITOR] Paused - memory throttle active');
            return;
        }

        logger.info('\n' + '='.repeat(80));
        logger.info(`🔄 SIMPLE ODDS MONITOR - Check Cycle - ${new Date().toLocaleTimeString('ro-RO')}`);
        logger.info('='.repeat(80));

        // Ia meciuri în MONITORING
        let activeMatches = tracker.getActiveMonitoring();

        // Filtrare: doar din astăzi, fără oddsMonitoringFailed
        const today = new Date().toLocaleDateString('ro-RO');
        activeMatches = activeMatches.filter(m => {
            if (m.oddsMonitoringFailed) return false;
            if (!m.date || m.date !== today) return false;
            return true;
        });

        logger.info(`📊 Meciuri active: ${activeMatches.length}`);

        if (activeMatches.length === 0) {
            logger.info('⚪ Niciun meci în monitorizare\n');
            return;
        }

        // Procesează fiecare meci
        for (const notification of activeMatches) {
            await this.processMatch(notification);
        }

        // Salvează starea pe disc după fiecare ciclu (previne pierdere la restart)
        this._saveState();

        logger.info('='.repeat(80) + '\n');
    }

    async processMatch(notification) {
        const { match, homeTeam, awayTeam, id } = notification;

        logger.info(`\n⏰ ${new Date().toLocaleTimeString('ro-RO')} - Verificare: ${match}`);

        try {
            // Găsește eventId pe Superbet
            logger.info(`   🔍 Căutare pe Superbet: ${homeTeam} vs ${awayTeam}`);
            const eventId = await this.oddsExtractor.findEventId(homeTeam, awayTeam);

            if (!eventId) {
                this.consecutiveFailures[id] = (this.consecutiveFailures[id] || 0) + 1;
                logger.info(`   ❌ Nu am găsit meciul pe Superbet (eșec ${this.consecutiveFailures[id]}/${this.MAX_CONSECUTIVE_FAILURES})`);
                if (this.consecutiveFailures[id] >= this.MAX_CONSECUTIVE_FAILURES) {
                    logger.info(`   🛑 Opresc monitorizarea cotelor — ${this.MAX_CONSECUTIVE_FAILURES} eșecuri consecutive`);
                    tracker.updateNotification(id, { oddsMonitoringFailed: true });
                }
                return;
            }

            logger.info(`   ✅ Event ID: ${eventId}`);

            // Extrage cote
            logger.info(`   💰 Extragere cote...`);
            const oddsData = await this.oddsExtractor.getLiveOdds(eventId);

            if (!oddsData || !oddsData.odds) {
                this.consecutiveFailures[id] = (this.consecutiveFailures[id] || 0) + 1;
                logger.info(`   ❌ Nu am putut extrage cotele (eșec ${this.consecutiveFailures[id]}/${this.MAX_CONSECUTIVE_FAILURES})`);
                if (this.consecutiveFailures[id] >= this.MAX_CONSECUTIVE_FAILURES) {
                    logger.info(`   🛑 Opresc monitorizarea cotelor — ${this.MAX_CONSECUTIVE_FAILURES} eșecuri consecutive`);
                    tracker.updateNotification(id, { oddsMonitoringFailed: true });
                }
                return;
            }

            // Reset contor la succes
            this.consecutiveFailures[id] = 0;

            // DETECTARE SUPER INTELIGENTĂ - ce cotă să monitorizăm?
            const event = (notification.event || '').toLowerCase();
            const pattern = (notification.pattern?.name || '').toLowerCase();

            // Detectare prag (0.5, 1.5, 2.5, etc.) din event/pattern
            let threshold = '0_5';  // Default
            if (event.includes('1.5') || pattern.includes('1.5')) {
                threshold = '1_5';
            } else if (event.includes('2.5') || pattern.includes('2.5')) {
                threshold = '2_5';
            } else if (event.includes('0.5') || pattern.includes('0.5')) {
                threshold = '0_5';
            }

            logger.info(`   🔍 Detectat prag din pattern/event: peste ${threshold.replace('_', '.')}`);

            // LOGICA INTELIGENTĂ: Alege echipa și pragul
            let cotaMonitorizata, tipCota;

            // Pattern specifică echipa AWAY (oaspete)?
            if (pattern.includes('away') || pattern.includes('oaspete') ||
                event.includes('away') || event.includes('oaspete') || event.toLowerCase().includes(awayTeam.toLowerCase())) {

                const cotaKey = `echipa_2_peste_${threshold}`;
                cotaMonitorizata = oddsData.odds[cotaKey] || oddsData.odds.echipa_2_peste_0_5 || oddsData.odds.peste_0_5;
                tipCota = `${awayTeam} > ${threshold.replace('_', '.')}`;
                logger.info(`   📊 AWAY team (${awayTeam}): caut "${cotaKey}" = ${oddsData.odds[cotaKey] || 'N/A'}`);
            }
            // Pattern specifică echipa HOME (gazdă)?
            else if (pattern.includes('home') || pattern.includes('gazdă') || pattern.includes('gazda') ||
                     event.includes('home') || event.includes('gazdă') || event.includes('gazda') || event.toLowerCase().includes(homeTeam.toLowerCase())) {

                const cotaKey = `echipa_1_peste_${threshold}`;
                cotaMonitorizata = oddsData.odds[cotaKey] || oddsData.odds.echipa_1_peste_0_5 || oddsData.odds.peste_0_5;
                tipCota = `${homeTeam} > ${threshold.replace('_', '.')}`;
                logger.info(`   📊 HOME team (${homeTeam}): caut "${cotaKey}" = ${oddsData.odds[cotaKey] || 'N/A'}`);
            }
            // Default: Total goluri
            else {
                const cotaKey = `peste_${threshold}`;
                cotaMonitorizata = oddsData.odds[cotaKey] || oddsData.odds.peste_0_5;
                tipCota = `Total goluri > ${threshold.replace('_', '.')}`;
                logger.info(`   📊 Total goluri: caut "${cotaKey}" = ${oddsData.odds[cotaKey] || 'N/A'}`);
            }

            if (!cotaMonitorizata) {
                logger.info(`   ⚠️  Cotă nu este disponibilă`);
                return;
            }

            logger.info(`   🎯 Monitorizez: ${tipCota} = ${cotaMonitorizata}`);

            // Verifică praguri 1.5 și 2.0
            const alreadySent_1_50 = notification.minute_odd_1_50 || this.sentThresholds.has(`${id}_1.5`);
            const alreadySent_2_00 = notification.minute_odd_2_00 || this.sentThresholds.has(`${id}_2.0`);

            // Pragul 1.5
            if (cotaMonitorizata >= 1.5 && !alreadySent_1_50) {
                logger.info(`   🎯 PRAG 1.5 ATINS! (${tipCota}: ${cotaMonitorizata})`);

                // Marchează IMEDIAT în cache (previne race condition)
                this.sentThresholds.add(`${id}_1.5`);

                await emailService.sendOddsNotification({
                    match,
                    homeTeam,
                    awayTeam,
                    event: notification.event || 'UN GOL în repriza 2',
                    threshold: '1.5',
                    currentOdd: cotaMonitorizata,
                    minute: new Date().toLocaleTimeString('ro-RO'),
                    pattern: notification.pattern?.name || 'MONITORIZARE',
                    probability: notification.probability || 'N/A'
                });

                tracker.updateNotification(id, {
                    minute_odd_1_50: new Date().toLocaleTimeString('ro-RO')
                });

                // SALVARE PENTRU VALIDARE ULTERIOARĂ
                this.saveForValidation(notification, cotaMonitorizata, tipCota);

                logger.info(`   ✅ EMAIL TRIMIS pentru cota 1.5!`);
            }

            // Pragul 2.0
            if (cotaMonitorizata >= 2.0 && !alreadySent_2_00) {
                logger.info(`   🎯 PRAG 2.0 ATINS! (${tipCota}: ${cotaMonitorizata})`);

                // Marchează IMEDIAT în cache (previne race condition)
                this.sentThresholds.add(`${id}_2.0`);

                await emailService.sendOddsNotification({
                    match,
                    homeTeam,
                    awayTeam,
                    event: notification.event || 'UN GOL în repriza 2',
                    threshold: '2.0',
                    currentOdd: cotaMonitorizata,
                    minute: new Date().toLocaleTimeString('ro-RO'),
                    pattern: notification.pattern?.name || 'MONITORIZARE',
                    probability: notification.probability || 'N/A'
                });

                tracker.updateNotification(id, {
                    minute_odd_2_00: new Date().toLocaleTimeString('ro-RO')
                });

                logger.info(`   ✅ EMAIL TRIMIS pentru cota 2.0!`);
            }

            if (cotaMonitorizata < 1.5) {
                logger.info(`   ⏳ Cotă sub 1.5 - așteptăm... (${tipCota}: ${cotaMonitorizata})`);
            }

        } catch (error) {
            logger.error(`   ❌ Eroare procesare ${match}: ${error.message}`);
        }
    }
}

// Export singleton
module.exports = new SimpleOddsMonitor();
