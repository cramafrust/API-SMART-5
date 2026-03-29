/**
 * core/notifications.js — Sistem unificat de tracking notificări
 *
 * Înlocuiește: NOTIFICATION_TRACKER.js
 * Citit de: email-notifier.js, AUTO_VALIDATOR.js, ODDS_MONITOR_SIMPLE.js,
 *           RESULTS_VALIDATOR.js, STATS_MONITOR.js, dashboard
 *
 * ÎMBUNĂTĂȚIRI față de NOTIFICATION_TRACKER:
 * - Folosește config centralizat (core/config.js) pentru path-uri
 * - SafeFileWriter pentru scrieri atomice (previne corupție)
 * - Metode mai clare și consistente
 * - Compatibil 100% cu vechiul API (drop-in replacement)
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

class NotificationTracker {
    constructor() {
        // Folosește noul path din config, cu fallback pe legacy
        this.storageFile = fs.existsSync(config.paths.notifications)
            ? config.paths.notifications
            : config.paths.notificationsLegacy;

        this.ensureStorageExists();
    }

    // ═══════════════════════════════════════
    // STORAGE — citire/scriere
    // ═══════════════════════════════════════

    ensureStorageExists() {
        // Asigură directorul
        const dir = path.dirname(this.storageFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (!fs.existsSync(this.storageFile)) {
            this.writeStorage({
                version: '2.0',
                created: new Date().toISOString(),
                notifications: []
            });
        }
    }

    readStorage() {
        try {
            return JSON.parse(fs.readFileSync(this.storageFile, 'utf8'));
        } catch (error) {
            console.error(`❌ Error reading storage: ${error.message}`);
            return { notifications: [] };
        }
    }

    writeStorage(data) {
        try {
            // Scriere atomică — scrie în .tmp apoi rename
            const tmpFile = this.storageFile + '.tmp';
            fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
            fs.renameSync(tmpFile, this.storageFile);
            return true;
        } catch (error) {
            console.error(`❌ Error writing storage: ${error.message}`);
            // Fallback pe scriere directă
            try {
                fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2), 'utf8');
                return true;
            } catch {
                return false;
            }
        }
    }

    // ═══════════════════════════════════════
    // CRUD NOTIFICĂRI
    // ═══════════════════════════════════════

    addNotification(params) {
        const storage = this.readStorage();

        // Deduplicare
        const patternName = params.pattern?.name;
        const existing = storage.notifications.find(n =>
            n.matchId === params.matchId &&
            n.pattern?.name === patternName &&
            n.status === 'MONITORING'
        );

        if (existing) {
            console.log(`⚠️  Notificare DUPLICAT detectată - SKIP (${params.homeTeam} vs ${params.awayTeam} | ${patternName})`);
            return existing;
        }

        const notification = {
            id: `${params.matchId}_${Date.now()}`,
            date: new Date().toLocaleDateString('ro-RO'),
            timestamp: Date.now(),
            match: `${params.homeTeam} vs ${params.awayTeam}`,
            matchId: params.matchId,
            homeTeam: params.homeTeam,
            awayTeam: params.awayTeam,
            league: params.league || null,
            event: params.event,
            initial_odd: params.initialOdd,
            probability: params.probability,
            minute_odd_1_50: null,
            minute_odd_2_00: null,
            minute_fulfilled: null,
            status: 'MONITORING',
            pattern: params.pattern,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        storage.notifications.push(notification);

        if (this.writeStorage(storage)) {
            console.log(`✅ Tracked: ${notification.match} | ${patternName} | ${notification.probability}%`);
            return notification;
        }

        return null;
    }

    updateNotification(id, updates) {
        const storage = this.readStorage();
        if (!storage?.notifications?.length) return false;

        const index = storage.notifications.findIndex(n => n.id === id);
        if (index === -1) return false;

        storage.notifications[index] = {
            ...storage.notifications[index],
            ...updates,
            updated_at: new Date().toISOString()
        };

        return this.writeStorage(storage) ? storage.notifications[index] : false;
    }

    // ═══════════════════════════════════════
    // STATUS UPDATES
    // ═══════════════════════════════════════

    markOdd150(id, minute) {
        return this.updateNotification(id, { minute_odd_1_50: minute });
    }

    markOdd200(id, minute) {
        return this.updateNotification(id, { minute_odd_2_00: minute });
    }

    markFulfilled(id, minute) {
        return this.updateNotification(id, { minute_fulfilled: minute, status: 'COMPLETED' });
    }

    markFailed(id) {
        return this.updateNotification(id, { minute_fulfilled: 'NU', status: 'FAILED' });
    }

    // ═══════════════════════════════════════
    // QUERY-URI
    // ═══════════════════════════════════════

    getActiveNotifications() {
        const storage = this.readStorage();
        return (storage?.notifications || []).filter(n => n.status === 'MONITORING');
    }

    getActiveMonitoring() {
        return this.getActiveNotifications();
    }

    getAllNotifications() {
        return this.readStorage()?.notifications || [];
    }

    getNotificationsByMatch(matchId) {
        return this.getAllNotifications().filter(n => n.matchId === matchId);
    }

    findPendingNotifications(matchId) {
        return this.getAllNotifications().filter(n =>
            n.matchId === matchId && (!n.validated || n.validated === false)
        );
    }

    getStats() {
        return this.generateStats();
    }

    generateStats() {
        const notifications = this.getAllNotifications();
        const stats = {
            total: notifications.length,
            monitoring: notifications.filter(n => n.status === 'MONITORING').length,
            completed: notifications.filter(n => n.status === 'COMPLETED').length,
            failed: notifications.filter(n => n.status === 'FAILED').length,
            successRate: 0
        };
        const finished = stats.completed + stats.failed;
        if (finished > 0) stats.successRate = Math.round((stats.completed / finished) * 100);
        return stats;
    }

    // ═══════════════════════════════════════
    // VALIDARE
    // ═══════════════════════════════════════

    updateNotificationResult(notificationId, result, validationDetails) {
        const storage = this.readStorage();
        const notification = storage?.notifications?.find(n => n.id === notificationId);
        if (!notification) return false;

        notification.result = result;
        notification.validated = true;
        notification.validatedAt = new Date().toISOString();
        notification.validationDetails = validationDetails;
        notification.updated_at = new Date().toISOString();

        if (validationDetails?.successCount !== undefined) {
            if (validationDetails.successCount > 0 && validationDetails.failCount === 0) {
                notification.validation_result = 'won';
            } else if (validationDetails.failCount > 0 && validationDetails.successCount === 0) {
                notification.validation_result = 'lost';
            } else if (validationDetails.successCount > 0 && validationDetails.failCount > 0) {
                notification.validation_result = 'partial';
            } else {
                notification.validation_result = 'unknown';
            }
        }

        return this.writeStorage(storage);
    }

    // ═══════════════════════════════════════
    // ECHIPĂ — Istoric și success rate
    // ═══════════════════════════════════════

    getTeamRecentHistory(teamName, limit = 10) {
        return this.getAllNotifications()
            .filter(n => n.homeTeam === teamName || n.awayTeam === teamName)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit)
            .map(n => ({
                date: n.date,
                match: n.match,
                pattern: n.pattern?.name || 'N/A',
                probability: n.probability,
                result: n.result || null,
                status: n.status
            }));
    }

    getTeamSuccessRate(teamName, limit = 10) {
        const history = this.getTeamRecentHistory(teamName, limit);
        const validated = history.filter(n => n.result === 'WON' || n.result === 'LOST');
        const won = validated.filter(n => n.result === 'WON').length;
        return {
            total: history.length,
            validated: validated.length,
            won,
            lost: validated.length - won,
            pending: history.length - validated.length,
            successRate: validated.length > 0 ? Math.round((won / validated.length) * 100) : null
        };
    }

    // ═══════════════════════════════════════
    // COMPATIBILITATE — wrapper saveNotification
    // ═══════════════════════════════════════

    async saveNotification(matchData, patterns, odds = null) {
        const results = [];
        for (const pattern of patterns) {
            const teamName = pattern.team === 'gazda' ? matchData.homeTeam :
                            pattern.team === 'oaspete' ? matchData.awayTeam : 'Meci';

            const notification = this.addNotification({
                matchId: matchData.matchId,
                homeTeam: matchData.homeTeam,
                awayTeam: matchData.awayTeam,
                league: matchData.leagueName || null,
                event: `${teamName} va marca în repriza 2`,
                initialOdd: odds?.peste_1_5 || 1.25,
                probability: pattern.probability,
                pattern: {
                    name: pattern.name,
                    team: pattern.team,
                    tier: pattern.tier,
                    position: pattern.position,
                    isEstimate: pattern.isEstimate || false
                }
            });
            if (notification) results.push(notification);
        }

        return {
            success: results.length > 0,
            notificationId: results[0]?.id,
            patternsCount: results.length
        };
    }

    // ═══════════════════════════════════════
    // UTILITĂȚI
    // ═══════════════════════════════════════

    displayTrackingStats() {
        const stats = this.generateStats();
        console.log(`\n📊 TRACKING: ${stats.total} total | ${stats.monitoring} monitoring | ${stats.completed} completed | ${stats.failed} failed | ${stats.successRate}% success`);
    }

    exportToCSV(outputPath) {
        const notifications = this.getAllNotifications();
        let csv = 'ID,Timestamp,Match,MatchId,Event,Probability,Status,Validated,Result\n';
        notifications.forEach(n => {
            csv += [n.id, n.created_at, `"${n.match}"`, n.matchId, `"${n.event || ''}"`,
                    n.probability, n.status, n.validated ? 'Yes' : 'No', n.validation_result || ''].join(',') + '\n';
        });
        fs.writeFileSync(outputPath, csv, 'utf8');
        console.log(`✅ Export: ${notifications.length} notificări → ${outputPath}`);
    }
}

// Singleton — compatibil cu `require('./NOTIFICATION_TRACKER')`
module.exports = new NotificationTracker();
