/**
 * PREMATCH_TRACKER
 *
 * Tracking pentru predicțiile pre-meci (serii S01-S22)
 * Salvează predicțiile trimise la ora 12:00
 * Validarea se face a doua zi de AUTO_VALIDATOR când datele sunt complete
 */

const fs = require('fs');
const path = require('path');
const logger = require('./LOG_MANAGER');

const TRACKING_FILE = path.join(__dirname, 'prematch_tracking.json');

class PrematchTracker {
    constructor() {
        this.ensureStorageExists();
    }

    ensureStorageExists() {
        if (!fs.existsSync(TRACKING_FILE)) {
            const initialData = {
                version: '1.0',
                created: new Date().toISOString(),
                predictions: []
            };
            fs.writeFileSync(TRACKING_FILE, JSON.stringify(initialData, null, 2), 'utf8');
            logger.info(`✅ Created prematch tracking file: ${TRACKING_FILE}`);
        }
    }

    readStorage() {
        try {
            return JSON.parse(fs.readFileSync(TRACKING_FILE, 'utf8'));
        } catch (e) {
            logger.error(`❌ Error reading prematch tracking: ${e.message}`);
            return { predictions: [] };
        }
    }

    writeStorage(data) {
        try {
            fs.writeFileSync(TRACKING_FILE, JSON.stringify(data, null, 2), 'utf8');
            return true;
        } catch (e) {
            logger.error(`❌ Error writing prematch tracking: ${e.message}`);
            return false;
        }
    }

    /**
     * Salvează predicțiile dintr-un email zilnic pre-meci
     * @param {Array} allMatchesData - [{matchId, matchData, alerts}]
     */
    saveDailyPredictions(allMatchesData) {
        const storage = this.readStorage();
        const today = new Date().toISOString().split('T')[0];
        let added = 0;

        for (const { matchId, matchData, alerts } of allMatchesData) {
            for (const alert of alerts) {
                // Deduplicare: verifică dacă există deja
                const exists = storage.predictions.find(p =>
                    p.matchId === matchId &&
                    p.patternId === alert.patternId &&
                    p.team === alert.team &&
                    p.date === today
                );
                if (exists) continue;

                const prediction = {
                    id: `PM_${matchId}_${alert.patternId}_${alert.side}_${Date.now()}`,
                    date: today,
                    timestamp: Date.now(),
                    matchId: matchId,
                    homeTeam: matchData.homeTeam,
                    awayTeam: matchData.awayTeam,
                    liga: matchData.liga,
                    ora: matchData.ora,
                    matchTimestamp: matchData.timestamp,
                    // Detalii predicție
                    patternId: alert.patternId,
                    category: alert.category,
                    team: alert.team,
                    side: alert.side,
                    streak: alert.streak,
                    rate: alert.rate,
                    success: alert.success,
                    total: alert.total,
                    label: alert.label,
                    source: alert.source || 'daily',
                    // Validare
                    validated: false,
                    validation_result: null, // won/lost/unknown
                    validatedAt: null,
                    result: null // Se completează la validare cu datele FT
                };

                storage.predictions.push(prediction);
                added++;
            }
        }

        if (added > 0) {
            this.writeStorage(storage);
            logger.info(`   📊 Prematch tracker: ${added} predicții salvate pentru ${today}`);
        }

        return added;
    }

    /**
     * Returnează predicțiile nevalidate care sunt gata (meci terminat)
     */
    getPendingValidation() {
        const storage = this.readStorage();
        const now = Date.now();
        const MIN_AGE_MS = 4 * 60 * 60 * 1000; // 4 ore după ora meciului

        return storage.predictions.filter(p => {
            if (p.validated) return false;
            const matchTime = p.matchTimestamp ? p.matchTimestamp * 1000 : p.timestamp;
            return (now - matchTime) >= MIN_AGE_MS;
        });
    }

    /**
     * Actualizează rezultatul unei predicții
     */
    updatePrediction(predictionId, updates) {
        const storage = this.readStorage();
        const idx = storage.predictions.findIndex(p => p.id === predictionId);
        if (idx === -1) return false;

        storage.predictions[idx] = {
            ...storage.predictions[idx],
            ...updates,
            validatedAt: new Date().toISOString()
        };

        return this.writeStorage(storage);
    }

    /**
     * Returnează TOATE predicțiile de ieri (validate sau nu), sortate după rată
     */
    getYesterdayAll() {
        const storage = this.readStorage();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        return storage.predictions.filter(p =>
            p.date === yesterdayStr
        ).sort((a, b) => b.rate - a.rate);
    }

    /**
     * Generează statistici
     */
    getStats() {
        const storage = this.readStorage();
        const predictions = storage.predictions;
        const validated = predictions.filter(p => p.validated);
        const won = validated.filter(p => p.validation_result === 'won').length;
        const lost = validated.filter(p => p.validation_result === 'lost').length;
        const pending = predictions.filter(p => !p.validated).length;

        return {
            total: predictions.length,
            validated: validated.length,
            won,
            lost,
            pending,
            winRate: (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : null
        };
    }
}

module.exports = new PrematchTracker();
