/**
 * SUBSCRIBER_NOTIFIER.js — Trimite notificări la abonații din smart.frust.ro
 *
 * Apelează webhook-ul de pe Vercel care distribuie la toți abonații activi
 * în funcție de preferințele fiecăruia (ligi, praguri, pattern-uri).
 *
 * USAGE:
 *   const { notifySubscribers } = require('./SUBSCRIBER_NOTIFIER');
 *   await notifySubscribers('ht', { homeTeam, awayTeam, pattern, probability, league });
 */

const https = require('https');
const logger = require('./LOG_MANAGER');

const WEBHOOK_URL = process.env.SMART_WEBHOOK_URL || 'https://smart.frust.ro/api/webhook';
const WEBHOOK_SECRET = process.env.SMART_WEBHOOK_SECRET || 'smart5-webhook-secret';

/**
 * Trimite notificare la toți abonații
 * @param {string} type - 'ht' | 'prematch' | 'result'
 * @param {Object} notification - datele notificării
 */
async function notifySubscribers(type, notification) {
    try {
        const payload = JSON.stringify({ type, notification });

        const url = new URL(WEBHOOK_URL);
        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${WEBHOOK_SECRET}`,
                'Content-Length': Buffer.byteLength(payload),
            },
            timeout: 10000,
        };

        return new Promise((resolve) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        if (result.sent > 0) {
                            logger.info(`   📤 Webhook: ${result.sent} abonați notificați (${result.skipped} skip)`);
                        }
                        resolve(result);
                    } catch {
                        resolve({ sent: 0, error: 'Invalid response' });
                    }
                });
            });

            req.on('error', (e) => {
                // Silent fail — nu blocăm procesul principal
                logger.debug(`   ⚠️  Webhook: ${e.message}`);
                resolve({ sent: 0, error: e.message });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({ sent: 0, error: 'Timeout' });
            });

            req.write(payload);
            req.end();
        });
    } catch (e) {
        return { sent: 0, error: e.message };
    }
}

module.exports = { notifySubscribers };
