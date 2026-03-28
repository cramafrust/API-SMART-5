/**
 * MATCH VERIFICATION ALERTER
 *
 * Trimite ALERTĂ când meciuri programate NU sunt verificate
 */

const fs = require('fs');
const path = require('path');
const emailService = require('./EMAIL_SERVICE');
const logger = console;
const memoryThrottle = require('./MEMORY_THROTTLE');

class MatchVerificationAlerter {
    constructor() {
        this.verificationsPath = '/home/florian/API SMART 5';
        this.checkIntervalMs = 5 * 60 * 1000; // 5 minute
        this.intervalId = null;
        this.lastAlertDate = null;
    }

    start() {
        logger.log('\n🚨 MATCH VERIFICATION ALERTER - START');
        logger.log(`⏱️  Verificare la fiecare 5 minute\n`);

        // Prima verificare după 5 minute
        setTimeout(() => {
            this.checkMissedMatches().catch(err => {
                logger.error(`❌ Eroare verificare meciuri pierdute: ${err.message}`);
            });
        }, this.checkIntervalMs);

        // Apoi la fiecare 5 minute
        this.intervalId = setInterval(() => {
            this.checkMissedMatches().catch(err => {
                logger.error(`❌ Eroare verificare meciuri pierdute: ${err.message}`);
            });
        }, this.checkIntervalMs);

        logger.log('✅ ALERTER pornit!\n');
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger.log('🛑 ALERTER oprit');
        }
    }

    async checkMissedMatches() {
        // Memory throttle: skip procesare când memoria e critică
        if (memoryThrottle.isThrottled) {
            logger.log('⏸️  [MATCH_VERIFICATION_ALERTER] Paused - memory throttle active');
            return;
        }

        const today = new Date().toLocaleDateString('ro-RO');
        const todayFilename = today.split('.').reverse().join('-'); // 2026-02-01
        const verificationsFile = path.join(this.verificationsPath, `verificari-${todayFilename}.json`);

        // Nu trimite alertă de 2 ori pe zi
        if (this.lastAlertDate === today) {
            return;
        }

        try {
            if (!fs.existsSync(verificationsFile)) {
                logger.log(`⚠️  Fișier verificări ${todayFilename} nu există încă`);
                return;
            }

            const data = JSON.parse(fs.readFileSync(verificationsFile, 'utf-8'));
            const nowTimestamp = Math.floor(Date.now() / 1000);
            const completate = (data.verificari || []).filter(v => v.status === 'completat').length;
            const erori = (data.verificari || []).filter(v => v.status === 'eroare').length;
            // Numără doar meciurile a căror oră de verificare a trecut deja (+ 10 min toleranță)
            const depasiteNeverificate = (data.verificari || []).filter(v =>
                v.status === 'programat' && v.timestampVerificare && (nowTimestamp > v.timestampVerificare + 600)
            );
            const neverificat = depasiteNeverificate.length;
            const inViitor = (data.verificari || []).filter(v =>
                v.status === 'programat' && v.timestampVerificare && (nowTimestamp <= v.timestampVerificare + 600)
            ).length;

            logger.log(`\n📊 VERIFICĂRI ${today}:`);
            logger.log(`   Total programate: ${data.totalVerificari || 0}`);
            logger.log(`   Completate: ${completate}`);
            logger.log(`   Erori: ${erori}`);
            logger.log(`   Neverificate (ora trecută): ${neverificat}`);
            logger.log(`   În așteptare (viitoare): ${inViitor}`);

            // Trimite alertă doar dacă > 5 meciuri cu ora TRECUTĂ și neverificate
            if (neverificat > 5) {
                const meciuriLista = depasiteNeverificate.map(v =>
                    `${v.homeTeam} vs ${v.awayTeam} (${v.liga}, ora ${v.oraVerificare})`
                ).join('\n');

                logger.log(`\n🚨 ALERTĂ! ${neverificat} meciuri neverificate (ora trecută)!`);

                await emailService.send({
                    subject: `🚨 ALERTĂ: ${neverificat} meciuri neverificate (${today})`,
                    text: `ALERTĂ SISTEM API SMART 5\n\n` +
                          `Data: ${today}\n` +
                          `Total programate: ${data.totalVerificari || 0}\n` +
                          `Completate: ${completate}\n` +
                          `Erori: ${erori}\n` +
                          `NEVERIFICATE (ora trecută): ${neverificat}\n\n` +
                          `Meciuri neverificate:\n${meciuriLista}\n\n` +
                          `Verifică sistemul STATS_MONITOR!`,
                    html: `<h2>🚨 ALERTĂ SISTEM</h2>` +
                          `<p><strong>Data:</strong> ${today}</p>` +
                          `<p><strong>Total programate:</strong> ${data.totalVerificari || 0}</p>` +
                          `<p><strong>Completate:</strong> ${completate}</p>` +
                          `<p><strong>Erori:</strong> ${erori}</p>` +
                          `<p style="color: red; font-size: 18px;"><strong>NEVERIFICATE (ora trecută): ${neverificat}</strong></p>` +
                          `<ul>${depasiteNeverificate.map(v => `<li>${v.homeTeam} vs ${v.awayTeam} (${v.liga}, ora ${v.oraVerificare})</li>`).join('')}</ul>` +
                          `<p>Verifică sistemul STATS_MONITOR!</p>`
                });

                logger.log(`   ✅ EMAIL ALERTĂ TRIMIS!`);
                this.lastAlertDate = today;
            }

        } catch (error) {
            logger.error(`❌ Eroare verificare meciuri: ${error.message}`);
        }
    }
}

// Export singleton
module.exports = new MatchVerificationAlerter();
