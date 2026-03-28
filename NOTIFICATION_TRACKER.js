/**
 * NOTIFICATION TRACKER
 *
 * Sistem de tracking pentru notificările trimise
 * Salvează și monitorizează pattern-urile confirmate
 */

const fs = require('fs');
const path = require('path');

class NotificationTracker {
    constructor() {
        this.storageFile = path.join(__dirname, 'notifications_tracking.json');
        this.ensureStorageExists();
    }

    /**
     * Asigură că fișierul de storage există
     */
    ensureStorageExists() {
        if (!fs.existsSync(this.storageFile)) {
            const initialData = {
                version: '1.0',
                created: new Date().toISOString(),
                notifications: []
            };
            fs.writeFileSync(this.storageFile, JSON.stringify(initialData, null, 2), 'utf8');
            console.log(`✅ Created tracking file: ${this.storageFile}`);
        }
    }

    /**
     * Citește datele din storage
     */
    readStorage() {
        try {
            const data = fs.readFileSync(this.storageFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`❌ Error reading storage: ${error.message}`);
            return { notifications: [] };
        }
    }

    /**
     * Salvează datele în storage
     */
    writeStorage(data) {
        try {
            fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error(`❌ Error writing storage: ${error.message}`);
            return false;
        }
    }

    /**
     * Adaugă o notificare nouă pentru tracking
     *
     * @param {Object} params - Parametrii notificării
     * @param {string} params.matchId - ID-ul meciului
     * @param {string} params.homeTeam - Echipa gazdă
     * @param {string} params.awayTeam - Echipa oaspete
     * @param {string} params.event - Evenimentul pronosticat (ex: "Echipa 1 va marca în repriza 2")
     * @param {number} params.initialOdd - Cota inițială
     * @param {number} params.probability - Probabilitatea pattern-ului
     * @param {Object} params.pattern - Obiectul pattern complet
     */
    addNotification(params) {
        const storage = this.readStorage();

        // 🚨 DEDUPLICARE: Verifică dacă există deja notificare pentru acest meci + pattern
        const patternName = params.pattern?.name;
        const existingNotification = storage.notifications.find(n =>
            n.matchId === params.matchId &&
            n.pattern?.name === patternName &&
            n.status === 'MONITORING'
        );

        if (existingNotification) {
            console.log(`⚠️  Notificare DUPLICAT detectată - SKIP`);
            console.log(`   Match: ${params.homeTeam} vs ${params.awayTeam}`);
            console.log(`   Pattern: ${patternName}`);
            console.log(`   Existing ID: ${existingNotification.id}`);
            return existingNotification; // Returnează notificarea existentă
        }

        const notification = {
            id: `${params.matchId}_${Date.now()}`,
            date: new Date().toLocaleDateString('ro-RO'),
            timestamp: Date.now(),
            match: `${params.homeTeam} vs ${params.awayTeam}`,
            matchId: params.matchId,
            homeTeam: params.homeTeam,
            awayTeam: params.awayTeam,
            event: params.event,
            initial_odd: params.initialOdd,
            probability: params.probability,
            minute_odd_1_50: null,
            minute_odd_2_00: null,
            minute_fulfilled: null,
            status: 'MONITORING', // MONITORING, COMPLETED, FAILED
            pattern: params.pattern, // Salvăm pattern-ul complet pentru monitorizare
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        storage.notifications.push(notification);

        if (this.writeStorage(storage)) {
            console.log(`✅ Notification tracked: ${notification.id}`);
            console.log(`   Match: ${notification.match}`);
            console.log(`   Event: ${notification.event}`);
            console.log(`   Probability: ${notification.probability}%`);
            return notification;
        }

        return null;
    }

    /**
     * Actualizează o notificare existentă
     */
    updateNotification(id, updates) {
        const storage = this.readStorage();
        if (!storage || !storage.notifications || !Array.isArray(storage.notifications)) {
            console.warn('⚠️  Storage invalid în updateNotification');
            return false;
        }

        const index = storage.notifications.findIndex(n => n.id === id);

        if (index === -1) {
            console.error(`❌ Notification not found: ${id}`);
            return false;
        }

        storage.notifications[index] = {
            ...storage.notifications[index],
            ...updates,
            updated_at: new Date().toISOString()
        };

        if (this.writeStorage(storage)) {
            console.log(`✅ Notification updated: ${id}`);
            return storage.notifications[index];
        }

        return false;
    }

    /**
     * Marchează minutul când cota a atins 1.50
     */
    markOdd150(id, minute) {
        return this.updateNotification(id, {
            minute_odd_1_50: minute
        });
    }

    /**
     * Marchează minutul când cota a atins 2.00
     */
    markOdd200(id, minute) {
        return this.updateNotification(id, {
            minute_odd_2_00: minute
        });
    }

    /**
     * Marchează pronosticul ca îndeplinit
     */
    markFulfilled(id, minute) {
        return this.updateNotification(id, {
            minute_fulfilled: minute,
            status: 'COMPLETED'
        });
    }

    /**
     * Marchează pronosticul ca eșuat
     */
    markFailed(id) {
        return this.updateNotification(id, {
            minute_fulfilled: 'NU',
            status: 'FAILED'
        });
    }

    /**
     * Obține notificările în curs de monitorizare
     */
    getActiveNotifications() {
        const storage = this.readStorage();
        if (!storage || !storage.notifications || !Array.isArray(storage.notifications)) {
            console.warn('⚠️  Storage invalid în getActiveNotifications, returnez array gol');
            return [];
        }
        return storage.notifications.filter(n => n.status === 'MONITORING');
    }

    /**
     * Obține toate notificările
     */
    getAllNotifications() {
        const storage = this.readStorage();
        if (!storage || !storage.notifications || !Array.isArray(storage.notifications)) {
            console.warn('⚠️  Storage invalid în getAllNotifications, returnez array gol');
            return [];
        }
        return storage.notifications;
    }

    /**
     * Obține notificările pentru un meci specific
     */
    getNotificationsByMatch(matchId) {
        const storage = this.readStorage();
        if (!storage || !storage.notifications || !Array.isArray(storage.notifications)) {
            console.warn('⚠️  Storage invalid în getNotificationsByMatch, returnez array gol');
            return [];
        }
        return storage.notifications.filter(n => n.matchId === matchId);
    }

    /**
     * Generează raport statistici
     */
    generateStats() {
        const storage = this.readStorage();
        if (!storage || !storage.notifications || !Array.isArray(storage.notifications)) {
            console.warn('⚠️  Storage invalid în generateStats, returnez stats goale');
            return {
                total: 0,
                monitoring: 0,
                completed: 0,
                failed: 0,
                successRate: 0
            };
        }

        const notifications = storage.notifications;

        const stats = {
            total: notifications.length,
            monitoring: notifications.filter(n => n.status === 'MONITORING').length,
            completed: notifications.filter(n => n.status === 'COMPLETED').length,
            failed: notifications.filter(n => n.status === 'FAILED').length,
            successRate: 0
        };

        const finished = stats.completed + stats.failed;
        if (finished > 0) {
            stats.successRate = Math.round((stats.completed / finished) * 100);
        }

        return stats;
    }

    /**
     * ALIAS pentru compatibilitate cu ODDS_CONTINUOUS_MONITOR
     * Returnează notificările în status MONITORING
     */
    getActiveMonitoring() {
        return this.getActiveNotifications();
    }

    /**
     * Găsește notificări nevalidate pentru un meci
     * Compatibilitate cu AUTO_VALIDATOR
     */
    findPendingNotifications(matchId) {
        const storage = this.readStorage();
        if (!storage || !storage.notifications || !Array.isArray(storage.notifications)) {
            console.warn('⚠️  Storage invalid în findPendingNotifications, returnez array gol');
            return [];
        }
        return storage.notifications.filter(notification =>
            notification.matchId === matchId &&
            (!notification.validated || notification.validated === false)
        );
    }

    /**
     * Actualizează rezultatul pentru o notificare
     * Compatibilitate cu RESULTS_VALIDATOR și AUTO_VALIDATOR
     */
    updateNotificationResult(notificationId, result, validationDetails) {
        const storage = this.readStorage();
        if (!storage || !storage.notifications || !Array.isArray(storage.notifications)) {
            console.warn('⚠️  Storage invalid în updateNotificationResult');
            return false;
        }

        const notification = storage.notifications.find(n => n.id === notificationId);

        if (!notification) {
            console.error(`❌ Notificare nu există: ${notificationId}`);
            return false;
        }

        notification.result = result;
        notification.validated = true;
        notification.validatedAt = new Date().toISOString();
        notification.validationDetails = validationDetails;
        notification.updated_at = new Date().toISOString();

        // Setează validation_result pe baza validationDetails
        if (validationDetails && validationDetails.successCount !== undefined) {
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

        if (this.writeStorage(storage)) {
            console.log(`✅ Notification result updated: ${notificationId}`);
            return true;
        }

        return false;
    }

    /**
     * Afișează statistici tracking (pentru debugging)
     */
    displayTrackingStats() {
        const storage = this.readStorage();
        if (!storage || !storage.notifications || !Array.isArray(storage.notifications)) {
            console.warn('⚠️  Storage invalid în displayTrackingStats');
            return;
        }

        const total = storage.notifications.length;
        const validated = storage.notifications.filter(n => n.validated).length;
        const pending = total - validated;

        console.log(`\n📊 STATISTICI TRACKING NOTIFICĂRI\n`);
        console.log('='.repeat(60));
        console.log(`📝 Total notificări: ${total}`);
        console.log(`✅ Validate: ${validated}`);
        console.log(`⏳ În așteptare: ${pending}`);
        console.log(`🔄 Monitoring: ${storage.notifications.filter(n => n.status === 'MONITORING').length}`);
        console.log(`✅ Completed: ${storage.notifications.filter(n => n.status === 'COMPLETED').length}`);
        console.log(`❌ Failed: ${storage.notifications.filter(n => n.status === 'FAILED').length}`);

        if (validated > 0) {
            const successful = storage.notifications.filter(n =>
                n.validated && n.validationDetails && n.validationDetails.success
            ).length;

            const successRate = Math.round((successful / validated) * 100);
            console.log(`\n🎯 Rate succes: ${successRate}% (${successful}/${validated})`);
        }

        console.log('='.repeat(60));
    }

    /**
     * Export notificări ca CSV pentru analiză
     */
    exportToCSV(outputPath) {
        const storage = this.readStorage();
        if (!storage || !storage.notifications || !Array.isArray(storage.notifications)) {
            console.warn('⚠️  Storage invalid în exportToCSV');
            return false;
        }

        let csv = 'ID,Timestamp,Match,MatchId,Event,Probability,Initial Odd,Status,Validated,Minute Odd 1.50,Minute Odd 2.00,Minute Fulfilled\n';

        storage.notifications.forEach(notification => {
            const row = [
                notification.id,
                notification.created_at || notification.timestamp,
                notification.match,
                notification.matchId,
                `"${notification.event || ''}"`,
                notification.probability,
                notification.initial_odd,
                notification.status,
                notification.validated ? 'Yes' : 'No',
                notification.minute_odd_1_50 || 'N/A',
                notification.minute_odd_2_00 || 'N/A',
                notification.minute_fulfilled || 'N/A'
            ].join(',');

            csv += row + '\n';
        });

        fs.writeFileSync(outputPath, csv, 'utf8');
        console.log(`✅ Export CSV salvat: ${outputPath}`);
        console.log(`📊 ${storage.notifications.length} notificări exportate`);
    }

    /**
     * Salvează o notificare (compatibilitate cu email-notifier și NOTIFICATIONS_TRACKER)
     * Wrapper peste addNotification() pentru structura veche
     */
    async saveNotification(matchData, patterns, odds = null) {
        console.log(`\n📊 TRACKING NOTIFICARE (compatibility mode)\n`);
        console.log('='.repeat(60));

        // Pentru fiecare pattern, creează o notificare
        const results = [];

        for (const pattern of patterns) {
            const teamName = pattern.team === 'gazda' ? matchData.homeTeam :
                            pattern.team === 'oaspete' ? matchData.awayTeam :
                            'Meci';

            const event = `${teamName} va marca în repriza 2`;

            const notification = this.addNotification({
                matchId: matchData.matchId,
                homeTeam: matchData.homeTeam,
                awayTeam: matchData.awayTeam,
                event: event,
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

            if (notification) {
                results.push(notification);
            }
        }

        console.log('='.repeat(60));

        return {
            success: results.length > 0,
            notificationId: results[0]?.id,
            patternsCount: results.length
        };
    }

    /**
     * Obține istoricul recent al unei echipe
     * @param {string} teamName - Numele echipei
     * @param {number} limit - Număr maxim de notificări (default: 10)
     * @returns {Array} - Array cu ultimele notificări pentru echipa respectivă
     */
    getTeamRecentHistory(teamName, limit = 10) {
        const storage = this.readStorage();
        if (!storage || !storage.notifications || !Array.isArray(storage.notifications)) {
            return [];
        }

        // Filtrează notificările pentru echipa respectivă (gazda sau oaspete)
        const teamNotifications = storage.notifications.filter(n =>
            n.homeTeam === teamName || n.awayTeam === teamName
        );

        // Sortează descrescător după timestamp (cele mai recente primele)
        teamNotifications.sort((a, b) => b.timestamp - a.timestamp);

        // Limitează la numărul dorit
        const recentNotifications = teamNotifications.slice(0, limit);

        // Formează răspunsul cu informații relevante
        return recentNotifications.map(n => ({
            date: n.date,
            match: n.match,
            pattern: n.pattern?.name || 'N/A',
            probability: n.probability,
            result: n.result || null, // WON/LOST/null
            status: n.status
        }));
    }

    /**
     * Calculează rata de succes pentru o echipă
     * @param {string} teamName - Numele echipei
     * @param {number} limit - Număr maxim de notificări de analizat
     * @returns {Object} - Statistici: total, won, lost, successRate
     */
    getTeamSuccessRate(teamName, limit = 10) {
        const history = this.getTeamRecentHistory(teamName, limit);

        const validatedNotifications = history.filter(n => n.result === 'WON' || n.result === 'LOST');
        const won = validatedNotifications.filter(n => n.result === 'WON').length;
        const lost = validatedNotifications.filter(n => n.result === 'LOST').length;
        const total = validatedNotifications.length;

        return {
            total: history.length,
            validated: total,
            won,
            lost,
            pending: history.length - total,
            successRate: total > 0 ? Math.round((won / total) * 100) : null
        };
    }
}

module.exports = new NotificationTracker();
