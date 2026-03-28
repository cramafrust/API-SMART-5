/**
 * MEMORY THROTTLE - Pauză automată componente extra la consum mare de memorie
 *
 * Singleton care gestionează starea de throttle:
 * - Activare la 7 GB memorie folosită (THROTTLE_THRESHOLD_MB)
 * - Dezactivare la 6 GB memorie folosită (RESUME_THRESHOLD_MB) - histerezis ~1 GB
 * - Scrie/citește .memory-throttle.json pentru vizibilitate pe disk
 * - Componentele extra (NOTIFICATION_MONITOR, ODDS_MONITOR, MATCH_VERIFICATION_ALERTER, UNIVERSAL_BACKFILL)
 *   verifică isThrottled și skip/pauză procesarea când e activ
 */

const fs = require('fs');
const path = require('path');
const logger = require('./LOG_MANAGER');

const STATE_FILE = path.join(__dirname, '.memory-throttle.json');

class MemoryThrottle {
    constructor() {
        this.THROTTLE_THRESHOLD_MB = 7 * 1024;  // 7 GB = activare throttle
        this.RESUME_THRESHOLD_MB = 6 * 1024;    // 6 GB = dezactivare throttle (histerezis)
        this.isThrottled = false;
        this.lastActivatedAt = null;
        this.lastDeactivatedAt = null;

        // Restaurează starea de pe disk (în caz de restart rapid)
        this._loadState();
    }

    /**
     * Citește memoria folosită din /proc/meminfo
     * @returns {{ usedMB: number, totalMB: number, availableMB: number }} sau null
     */
    _getMemoryMB() {
        try {
            const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
            const getValue = (key) => {
                const match = meminfo.match(new RegExp(`${key}:\\s+(\\d+)`));
                return match ? parseInt(match[1]) : 0;
            };

            const totalKB = getValue('MemTotal');
            const availableKB = getValue('MemAvailable');
            const usedKB = totalKB - availableKB;

            return {
                usedMB: Math.round(usedKB / 1024),
                totalMB: Math.round(totalKB / 1024),
                availableMB: Math.round(availableKB / 1024)
            };
        } catch (err) {
            return null;
        }
    }

    /**
     * Verifică memoria și activează/dezactivează throttle
     * Apelat din WATCHDOG.js la fiecare health check
     */
    check() {
        const mem = this._getMemoryMB();
        if (!mem) return;

        if (!this.isThrottled && mem.usedMB >= this.THROTTLE_THRESHOLD_MB) {
            this.activate(mem);
        } else if (this.isThrottled && mem.usedMB <= this.RESUME_THRESHOLD_MB) {
            this.deactivate(mem);
        }
    }

    /**
     * Activează throttle - componentele extra se pun pe pauză
     */
    activate(mem) {
        this.isThrottled = true;
        this.lastActivatedAt = new Date().toISOString();

        logger.info(`🛑 MEMORY THROTTLE ACTIVAT — ${mem.usedMB} MB folosiți / ${mem.totalMB} MB total (prag: ${this.THROTTLE_THRESHOLD_MB} MB)`);
        logger.info(`   ⏸️  Componente puse pe pauză: NOTIFICATION_MONITOR, ODDS_MONITOR, MATCH_VERIFICATION_ALERTER`);

        this._saveState();
    }

    /**
     * Dezactivează throttle - componentele extra reiau procesarea
     */
    deactivate(mem) {
        const wasPausedSince = this.lastActivatedAt;
        this.isThrottled = false;
        this.lastDeactivatedAt = new Date().toISOString();

        logger.info(`✅ MEMORY THROTTLE DEZACTIVAT — ${mem.usedMB} MB folosiți / ${mem.totalMB} MB total (prag resume: ${this.RESUME_THRESHOLD_MB} MB)`);
        logger.info(`   ▶️  Componente reluate (pauză din ${wasPausedSince || 'N/A'})`);

        this._saveState();
    }

    /**
     * Returnează status complet pentru logging/debugging
     */
    getStatus() {
        const mem = this._getMemoryMB();
        return {
            isThrottled: this.isThrottled,
            thresholdMB: this.THROTTLE_THRESHOLD_MB,
            resumeMB: this.RESUME_THRESHOLD_MB,
            currentUsedMB: mem ? mem.usedMB : null,
            currentTotalMB: mem ? mem.totalMB : null,
            lastActivatedAt: this.lastActivatedAt,
            lastDeactivatedAt: this.lastDeactivatedAt
        };
    }

    /**
     * Salvează starea pe disk (.memory-throttle.json)
     */
    _saveState() {
        try {
            fs.writeFileSync(STATE_FILE, JSON.stringify({
                isThrottled: this.isThrottled,
                lastActivatedAt: this.lastActivatedAt,
                lastDeactivatedAt: this.lastDeactivatedAt,
                timestamp: new Date().toISOString()
            }, null, 2));
        } catch (err) {
            // Best effort
        }
    }

    /**
     * Încarcă starea de pe disk (pentru restart rapid)
     */
    _loadState() {
        try {
            if (fs.existsSync(STATE_FILE)) {
                const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
                this.isThrottled = data.isThrottled || false;
                this.lastActivatedAt = data.lastActivatedAt || null;
                this.lastDeactivatedAt = data.lastDeactivatedAt || null;

                if (this.isThrottled) {
                    logger.info(`⚠️  MEMORY THROTTLE: restaurat stare THROTTLED de pe disk (din ${this.lastActivatedAt})`);
                }
            }
        } catch (err) {
            // Ignoră, pornește fresh
        }
    }
}

// Export singleton
module.exports = new MemoryThrottle();
