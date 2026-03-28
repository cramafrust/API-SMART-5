#!/usr/bin/env node
/**
 * API SMART 5 - Watchdog Monitor
 *
 * Monitorizează API SMART 5 (care rulează din cron/manual) și:
 * - Trimite START notification când pornește watchdog-ul
 * - Trimite HEARTBEAT la fiecare 3 ore (8:00-1:00, skip noaptea)
 * - Verifică că STATS MONITOR a rulat recent (ultimele 5 minute)
 * - Trimite CRASH notification dacă sistemul nu mai rulează
 * - Monitorizează memoria sistemului și restartează preventiv la >90%
 * - Trimite notificare la shutdown/OOM (SIGTERM/SIGINT)
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec, execSync } = require('child_process');
const SystemNotifier = require('./SYSTEM_NOTIFIER');
const lifecycle = require('./LIFECYCLE_MANAGER');
const logger = require('./LOG_MANAGER');
const memoryThrottle = require('./MEMORY_THROTTLE');

// Paths
const LOG_DIR = path.join(__dirname, 'logs');
const MONITOR_LOG = path.join(LOG_DIR, 'stats-monitor.log');
const WATCHDOG_LOG = path.join(LOG_DIR, 'watchdog.log');
const CRASH_STATE_FILE = path.join(__dirname, '.crash-state.json');
const NO_MATCHES_FLAG = path.join(__dirname, '.no-matches-today.flag');

// Settings
const HEARTBEAT_INTERVAL = 3 * 60 * 60 * 1000; // 3 ore (doar orele active 8:00-1:00)
const HEARTBEAT_START_HOUR = 8; // 08:00
const HEARTBEAT_END_HOUR = 1; // 01:00
const MEMORY_WARNING_PERCENT = 85; // Warning la 85% memorie folosită
const MEMORY_CRITICAL_PERCENT = 90; // Restart preventiv la 90%
const HEALTH_CHECK_INTERVAL = 3 * 60 * 1000; // 3 minute (verificare mai frecventă)
const MAX_INACTIVE_TIME = 8 * 60 * 1000; // 8 minute fără activitate = posibil CRASH
const MAX_NO_ACTIVITY_TIME = 6 * 60 * 60 * 1000; // 6 ore fără procesare = alertă (relaxat pt noapte)
const MAX_RESTARTS_PER_HOUR = 2; // Max 2 restarturi pe oră (evită spam emailuri)
const AUTO_RESTART_ENABLED = true; // Activează auto-restart
const SCRIPT_PATH = '/home/florian/API SMART 5/API-SMART-5.js'; // Path complet
const SCRIPT_LOG = '/home/florian/API SMART 5/api-smart-5-run.log'; // Log pentru restart

class Watchdog {
    constructor() {
        this.notifier = new SystemNotifier();
        this.startTime = Date.now();
        this.heartbeatTimer = null;
        this.healthCheckTimer = null;
        this.isFirstStart = true;
        this.lastCrashNotificationTime = 0;
        this.systemWasCrashed = false;
        this.restartCount = 0;
        this.restartTimestamps = []; // Tracking restarturi recente (anti-spam)
        this.scriptProcess = null; // Process pentru API-SMART-5
        this.firstHealthCheckDone = false; // Skip crash detection la prima verificare

        // Creează director logs
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }

        // Încarcă crash state
        this.loadCrashState();

        // Handle cleanup la exit
        process.on('SIGINT', () => this.cleanup('SIGINT'));
        process.on('SIGTERM', () => this.cleanup('SIGTERM'));
    }

    /**
     * Logger
     */
    log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;

        logger.info(message);

        try {
            fs.appendFileSync(WATCHDOG_LOG, logMessage);
        } catch (err) {
            // Ignore log errors
        }
    }

    /**
     * Încarcă crash state
     */
    loadCrashState() {
        try {
            if (fs.existsSync(CRASH_STATE_FILE)) {
                const data = fs.readFileSync(CRASH_STATE_FILE, 'utf8');
                const state = JSON.parse(data);
                this.systemWasCrashed = state.crashed || false;
                this.lastCrashNotificationTime = state.lastCrashTime || 0;
            }
        } catch (err) {
            this.systemWasCrashed = false;
        }
    }

    /**
     * Salvează crash state
     */
    saveCrashState(crashed) {
        try {
            const state = {
                crashed: crashed,
                lastCrashTime: crashed ? Date.now() : 0,
                timestamp: new Date().toISOString()
            };
            fs.writeFileSync(CRASH_STATE_FILE, JSON.stringify(state, null, 2));
        } catch (err) {
            // Ignore save errors
        }
    }

    /**
     * Calculează uptime
     */
    getUptime() {
        const uptimeMs = Date.now() - this.startTime;
        const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
        const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    /**
     * Citește memoria sistemului din /proc/meminfo
     */
    getMemoryUsage() {
        try {
            const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
            const getValue = (key) => {
                const match = meminfo.match(new RegExp(`${key}:\\s+(\\d+)`));
                return match ? parseInt(match[1]) : 0;
            };

            const totalKB = getValue('MemTotal');
            const availableKB = getValue('MemAvailable');
            const usedKB = totalKB - availableKB;
            const usedPercent = Math.round((usedKB / totalKB) * 100);

            const totalMB = Math.round(totalKB / 1024);
            const usedMB = Math.round(usedKB / 1024);
            const availableMB = Math.round(availableKB / 1024);

            return {
                totalMB,
                usedMB,
                availableMB,
                usedPercent,
                display: `${usedMB}MB / ${totalMB}MB (${usedPercent}%)`
            };
        } catch (err) {
            return { totalMB: 0, usedMB: 0, availableMB: 0, usedPercent: 0, display: 'N/A' };
        }
    }

    /**
     * Verifică dacă procesul API-SMART-5.js rulează
     */
    async isProcessRunning() {
        return new Promise((resolve) => {
            exec('ps aux | grep "node.*API-SMART-5.js.*full" | grep -v grep', (error, stdout, stderr) => {
                if (error || !stdout || stdout.trim() === '') {
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    /**
     * Pornește scriptul API-SMART-5
     */
    /**
     * Verifică dacă am depășit limita de restarturi pe oră
     */
    isRestartLimitReached() {
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        this.restartTimestamps = this.restartTimestamps.filter(t => t > oneHourAgo);
        return this.restartTimestamps.length >= MAX_RESTARTS_PER_HOUR;
    }

    async restartScript() {
        try {
            // Verifică limita de restarturi pe oră
            if (this.isRestartLimitReached()) {
                this.log(`⛔ Limita de ${MAX_RESTARTS_PER_HOUR} restarturi/oră atinsă. Aștept să treacă ora.`);
                return false;
            }

            this.log('🔄 Pornesc API-SMART-5.js...');

            // Pornește procesul în background cu nohup
            const child = spawn('nohup', [
                'node',
                SCRIPT_PATH,
                'full'
            ], {
                cwd: path.dirname(SCRIPT_PATH),
                detached: true,
                stdio: ['ignore', 'ignore', 'ignore']
            });

            child.unref();

            this.restartCount++;
            this.restartTimestamps.push(Date.now());
            this.log(`✅ API-SMART-5 pornit! PID: ${child.pid}, Total restart-uri: ${this.restartCount}`);

            // Așteaptă 10 secunde și verifică dacă procesul rulează
            await new Promise(resolve => setTimeout(resolve, 10000));

            const isRunning = await this.isProcessRunning();
            if (isRunning) {
                this.log('✅ Verificare OK: API-SMART-5 rulează');

                // Trimite notificare doar la primul restart din această sesiune de probleme
                // (evită spam cu 8-10 emailuri identice)
                const oneHourAgo = Date.now() - 60 * 60 * 1000;
                const restartsLastHour = this.restartTimestamps.filter(t => t > oneHourAgo).length;
                if (restartsLastHour <= 1) {
                    await this.notifier.sendCrashNotification({
                        reason: 'Watchdog a detectat că scriptul s-a oprit și l-a repornit automat',
                        exitCode: null,
                        signal: null,
                        restartCount: this.restartCount,
                        pid: child.pid
                    });
                } else {
                    this.log(`📧 Email skip (deja ${restartsLastHour} restarturi în ultima oră - evit spam)`);
                }

                return true;
            } else {
                this.log('⚠️  Procesul nu pare să ruleze după restart');
                return false;
            }

        } catch (error) {
            this.log(`❌ Eroare la restart: ${error.message}`);
            return false;
        }
    }

    /**
     * Găsește ultimul timestamp din log-uri
     */
    getLastActivityTime() {
        try {
            // Caută ultimul fișier log modificat recent
            const logFiles = fs.readdirSync(LOG_DIR)
                .filter(f => f.startsWith('stats-monitor'))
                .map(f => path.join(LOG_DIR, f));

            if (logFiles.length === 0) {
                return null;
            }

            // Obține cel mai recent fișier modificat
            let lastModTime = 0;
            for (const logFile of logFiles) {
                try {
                    const stats = fs.statSync(logFile);
                    if (stats.mtimeMs > lastModTime) {
                        lastModTime = stats.mtimeMs;
                    }
                } catch (err) {
                    // Skip file
                }
            }

            return lastModTime || null;
        } catch (err) {
            this.log(`⚠️  Eroare la verificare log-uri: ${err.message}`);
            return null;
        }
    }

    /**
     * Găsește ultima procesare reală (stats HT extrase)
     */
    getLastProcessingTime() {
        try {
            // Caută ultimul fișier stats-*-HT.json creat
            const statsFiles = fs.readdirSync(__dirname)
                .filter(f => f.startsWith('stats-') && f.endsWith('-HT.json'))
                .map(f => path.join(__dirname, f));

            if (statsFiles.length === 0) {
                return null;
            }

            // Obține cel mai recent fișier modificat
            let lastModTime = 0;
            for (const statsFile of statsFiles) {
                try {
                    const stats = fs.statSync(statsFile);
                    if (stats.mtimeMs > lastModTime) {
                        lastModTime = stats.mtimeMs;
                    }
                } catch (err) {
                    // Skip file
                }
            }

            return lastModTime || null;
        } catch (err) {
            this.log(`⚠️  Eroare la verificare stats files: ${err.message}`);
            return null;
        }
    }

    /**
     * Verifică dacă există flag "no-matches-today"
     */
    hasNoMatchesFlag() {
        try {
            if (fs.existsSync(NO_MATCHES_FLAG)) {
                const data = fs.readFileSync(NO_MATCHES_FLAG, 'utf8');
                const flag = JSON.parse(data);
                const flagDate = new Date(flag.date);
                const now = new Date();

                // Verifică dacă flag-ul e de astăzi (nu de ieri)
                const isSameDay = flagDate.toDateString() === now.toDateString();

                if (isSameDay) {
                    return true;
                }
            }
            return false;
        } catch (err) {
            return false;
        }
    }

    /**
     * Verifică dacă procesul curent e pe ziua corectă
     * Detectează situația: proces din ziua anterioară încă activ, fără meciuri noi generate
     */
    isStaleDayProcess() {
        try {
            const now = new Date();
            const hour = now.getHours();
            const minute = now.getMinutes();

            // Verifică doar după 08:05 (lasă timp cron-ului de la 08:00 să pornească)
            if (hour < 8 || (hour === 8 && minute < 5)) {
                return false;
            }

            // Formează numele fișierului de meciuri pentru azi
            const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
            const todayMatchFile = path.join(__dirname, `meciuri-${today}.json`);

            if (!fs.existsSync(todayMatchFile)) {
                this.log(`📅 Fișierul meciuri-${today}.json NU EXISTĂ (procesul rulează pe ziua anterioară)`);
                return true;
            }

            return false;
        } catch (err) {
            this.log(`⚠️  Eroare la verificare stale day: ${err.message}`);
            return false;
        }
    }

    /**
     * Verifică health API SMART 5
     */
    async checkHealth() {
        const now = Date.now();
        const hour = new Date().getHours();

        // Verifică memoria sistemului
        await this.checkMemory();

        // Verifică ÎNTÂI dacă procesul rulează
        const isRunning = await this.isProcessRunning();

        if (!isRunning) {
            // PROCESUL NU RULEAZĂ!

            // La prima verificare după boot, NU raportăm crash
            // — procesul poate fi încă în curs de pornire din crontab
            if (!this.firstHealthCheckDone) {
                this.firstHealthCheckDone = true;
                this.log('🔍 Prima verificare health — procesul nu rulează încă, aștept (poate pornește din crontab)');
                return;
            }

            // Verifică dacă există flag "no-matches-today"
            if (this.hasNoMatchesFlag()) {
                this.log('🚩 Flag "no-matches-today" detectat - scriptul s-a oprit intenționat (nu sunt meciuri)');
                this.log('⏳ WATCHDOG așteaptă cron-ul de mâine la 08:00 pentru restart');

                // Marchează ca recovered pentru a nu trimite notificări repetate
                if (this.systemWasCrashed) {
                    this.systemWasCrashed = false;
                    this.saveCrashState(false);
                }
                return; // NU repornește!
            }

            if (!this.systemWasCrashed) {
                this.log(`🚨 API-SMART-5 NU RULEAZĂ! Detectat la ${new Date().toLocaleTimeString('ro-RO')}`);
                this.systemWasCrashed = true;
                this.saveCrashState(true);
            }

            // AUTO-RESTART (doar în orele active: 08:00-01:00)
            if (AUTO_RESTART_ENABLED) {
                // Orele active: 8-23 și 0-1
                const isActiveHour = (hour >= 8 && hour <= 23) || (hour >= 0 && hour <= 1);

                if (isActiveHour) {
                    this.log(`🔄 Orele active (${hour}:00) - PORNESC AUTO-RESTART`);

                    // Verifică dacă nu am restartat prea recent (ultimele 2 minute)
                    const timeSinceLastCrashNotif = now - this.lastCrashNotificationTime;
                    if (timeSinceLastCrashNotif > 2 * 60 * 1000) {
                        const restartSuccess = await this.restartScript();

                        if (restartSuccess) {
                            this.systemWasCrashed = false;
                            this.saveCrashState(false);
                            this.lastCrashNotificationTime = now;
                        } else {
                            this.log('❌ Restart eșuat!');
                        }
                    } else {
                        this.log('⏳ Aștept 2 minute între restart-uri...');
                    }
                } else {
                    this.log(`😴 Ore de somn (${hour}:00) - NU PORNESC scriptul (meciuri terminate)`);
                }
            } else {
                this.log('⚠️  Auto-restart DISABLED - doar notific');

                // Trimite notificare fără restart
                const timeSinceLastCrashNotif = now - this.lastCrashNotificationTime;
                if (timeSinceLastCrashNotif > 30 * 60 * 1000) {
                    await this.notifier.sendCrashNotification({
                        reason: `API SMART 5 nu rulează (verificat cu ps aux)`,
                        exitCode: null,
                        signal: null,
                        restartCount: this.restartCount,
                        pid: null
                    });
                    this.lastCrashNotificationTime = now;
                }
            }

        } else {
            // Procesul rulează OK
            this.firstHealthCheckDone = true;

            if (this.systemWasCrashed) {
                this.log(`✅ Sistem RECOVERED! API SMART 5 rulează din nou`);
                this.systemWasCrashed = false;
                this.saveCrashState(false);
            }

            // Verificare ZI NOUĂ: procesul rulează dar e din ziua anterioară?
            if (this.isStaleDayProcess()) {
                const lastRestartTime = this.lastCrashNotificationTime || 0;
                const timeSinceLastRestart = now - lastRestartTime;

                // Evită restart loop: max 1 restart la 30 minute
                if (timeSinceLastRestart > 30 * 60 * 1000) {
                    this.log(`🚨 STALE DAY: Procesul rulează cu meciurile de ieri! RESTART NECESAR.`);

                    try {
                        await new Promise((resolve) => {
                            exec('pkill -f "node.*API-SMART-5.js.*full"', (error) => resolve());
                        });
                        this.log(`✅ Proces vechi oprit`);

                        await new Promise(resolve => setTimeout(resolve, 3000));

                        // Șterge flag no-matches dacă e de ieri
                        if (fs.existsSync(NO_MATCHES_FLAG)) {
                            try {
                                const flagData = JSON.parse(fs.readFileSync(NO_MATCHES_FLAG, 'utf8'));
                                const flagDate = new Date(flagData.date).toDateString();
                                const todayDate = new Date().toDateString();
                                if (flagDate !== todayDate) {
                                    fs.unlinkSync(NO_MATCHES_FLAG);
                                    this.log(`🗑️  Flag no-matches de ieri șters`);
                                }
                            } catch (e) { /* ignore */ }
                        }

                        const restartSuccess = await this.restartScript();

                        if (restartSuccess) {
                            this.log(`✅ Proces repornit pentru ziua curentă!`);
                            this.lastCrashNotificationTime = now;
                            // Email trimis deja din restartScript() dacă e primul din oră
                        } else {
                            this.log(`❌ Restart eșuat pentru ziua curentă!`);
                        }
                    } catch (error) {
                        this.log(`❌ Eroare la stale day restart: ${error.message}`);
                    }
                } else {
                    const minutesWait = Math.ceil((30 * 60 * 1000 - timeSinceLastRestart) / 60000);
                    this.log(`⏳ Stale day: așteaptă ${minutesWait} min până la următorul restart`);
                }
                return; // Nu mai verifica restul, am gestionat situația
            }

            // Verificare CRITICĂ: procesul rulează DAR procesează ceva?
            const lastProcessingTime = this.getLastProcessingTime();

            if (lastProcessingTime) {
                const timeSinceLastProcessing = now - lastProcessingTime;
                const hoursSince = Math.floor(timeSinceLastProcessing / 1000 / 60 / 60);
                const minutesSince = Math.floor((timeSinceLastProcessing % (1000 * 60 * 60)) / 1000 / 60);

                // ALERTĂ: fără procesare mult timp (când ar trebui să fie meciuri)
                if (timeSinceLastProcessing > MAX_NO_ACTIVITY_TIME) {
                    // Verifică dacă sunt meciuri programate ACUM (nu doar ore active)
                    const isActiveHour = (hour >= 14 && hour <= 23) || (hour >= 0 && hour <= 1);
                    // Dimineața (8-14) nu sunt meciuri europene, nu alerta!

                    // Verifică dacă există meciuri care AR FI TREBUIT deja verificate
                    const today = new Date().toISOString().split('T')[0];
                    const verifFile = path.join(__dirname, `verificari-${today}.json`);
                    let hasOverdueMatches = false;
                    let earliestVerifTime = null;
                    try {
                        if (fs.existsSync(verifFile)) {
                            const verifData = JSON.parse(fs.readFileSync(verifFile, 'utf8'));
                            const pending = (verifData.verificari || []).filter(v => v.status === 'programat');
                            if (pending.length > 0) {
                                // Găsește cel mai devreme timestamp de verificare
                                const nowTimestamp = Math.floor(Date.now() / 1000);
                                earliestVerifTime = Math.min(...pending.map(v => v.timestampVerificare));
                                // Alertează DOAR dacă cel mai devreme meci ar fi trebuit deja verificat
                                // (adică ora curentă > ora verificării primului meci)
                                hasOverdueMatches = nowTimestamp > earliestVerifTime;
                            }
                        }
                    } catch(e) { /* ignore */ }

                    if (isActiveHour && hasOverdueMatches && !this.hasNoMatchesFlag()) {
                        this.log(`🚨 ALERTĂ: Procesul rulează DAR nicio procesare de ${hoursSince}h ${minutesSince}m (meciuri depășite!)`);

                        // SOLUȚIE: KILL procesul blocat și REPORNEȘTE-L
                        if (AUTO_RESTART_ENABLED) {
                            const lastNotifTime = this.lastCrashNotificationTime || 0;

                            // Evită restart loop (max 1 restart la 30 minute pentru procese blocate)
                            if (now - lastNotifTime > 30 * 60 * 1000) {
                                this.log(`🔪 KILL proces blocat...`);

                                try {
                                    // Kill procesul blocat
                                    await new Promise((resolve) => {
                                        exec('pkill -f "node.*API-SMART-5.js.*full"', (error) => {
                                            // Ignore error (procesul poate să nu existe)
                                            resolve();
                                        });
                                    });

                                    this.log(`✅ Proces blocat oprit`);

                                    // Așteaptă 3 secunde pentru cleanup
                                    await new Promise(resolve => setTimeout(resolve, 3000));

                                    this.log(`🔄 Repornesc API-SMART-5...`);

                                    // Repornește procesul
                                    const restartSuccess = await this.restartScript();

                                    if (restartSuccess) {
                                        this.log(`✅ Proces repornit cu succes după deblocare!`);
                                        this.lastCrashNotificationTime = now;
                                    } else {
                                        this.log(`❌ Restart eșuat după kill!`);

                                        // Trimite notificare de eroare critică
                                        await this.notifier.sendCrashNotification({
                                            reason: `Proces blocat ${hoursSince}h ${minutesSince}m - KILL + RESTART EȘUAT!`,
                                            exitCode: null,
                                            signal: 'BLOCKED_RESTART_FAILED',
                                            restartCount: this.restartCount,
                                            pid: process.pid
                                        });
                                        this.lastCrashNotificationTime = now;
                                    }

                                } catch (error) {
                                    this.log(`❌ Eroare la kill/restart proces blocat: ${error.message}`);
                                }
                            } else {
                                const minutesUntilNextRestart = Math.ceil((30 * 60 * 1000 - (now - lastNotifTime)) / 60000);
                                this.log(`⏳ Așteaptă ${minutesUntilNextRestart} min până la următorul restart (evitare loop)`);
                            }
                        } else {
                            // Auto-restart dezactivat - doar notifică
                            const lastNotifTime = this.lastCrashNotificationTime || 0;
                            if (now - lastNotifTime > 24 * 60 * 60 * 1000) {
                                await this.notifier.sendCrashNotification({
                                    reason: `Sistem rulează dar NU procesează meciuri de ${hoursSince}h ${minutesSince}m! Ultima procesare: ${new Date(lastProcessingTime).toLocaleString('ro-RO')}`,
                                    exitCode: null,
                                    signal: 'INACTIV',
                                    restartCount: this.restartCount,
                                    pid: process.pid
                                });
                                this.lastCrashNotificationTime = now;
                            }
                        }
                    }
                } else if (hoursSince > 0) {
                    this.log(`📊 Ultima procesare: ${hoursSince}h ${minutesSince}m ago (OK - în limite normale)`);
                }
            } else {
                this.log(`⚠️  Nu am găsit fișiere stats (prima rulare sau director gol)`);
            }
        }
    }

    /**
     * Verifică memoria sistemului și restartează preventiv dacă e critică
     */
    async checkMemory() {
        const mem = this.getMemoryUsage();
        if (mem.totalMB === 0) return;

        // Memory throttle: pauză componente extra înainte de a ajunge la kill
        memoryThrottle.check();

        if (mem.usedPercent >= MEMORY_CRITICAL_PERCENT) {
            this.log(`🚨 MEMORIE CRITICĂ: ${mem.display} - RESTART PREVENTIV!`);

            // Trimite alertă
            const timeSinceLastCrashNotif = Date.now() - this.lastCrashNotificationTime;
            if (timeSinceLastCrashNotif > 5 * 60 * 1000) {
                await this.notifier.sendCrashNotification({
                    reason: `MEMORIE CRITICĂ: ${mem.display} - Restart preventiv pentru a evita OOM-kill`,
                    exitCode: null,
                    signal: 'OOM_PREVENTION',
                    restartCount: this.restartCount,
                    pid: process.pid
                });
            }

            // Kill și restart API-SMART-5
            try {
                await new Promise((resolve) => {
                    exec('pkill -f "node.*API-SMART-5.js.*full"', () => resolve());
                });
                this.log('✅ Proces oprit pentru eliberare memorie');

                // Kill backfill dacă rulează (eliberare memorie)
                await new Promise((resolve) => {
                    exec('pkill -f "UNIVERSAL_BACKFILL" 2>/dev/null', () => resolve());
                });
                this.log('✅ Backfill oprit (dacă rula)');

                // Kill procese Chrome/Chromium zombie
                await new Promise((resolve) => {
                    exec('pkill -f "chrome" 2>/dev/null', () => resolve());
                });
                this.log('✅ Procese Chrome oprite');

                await new Promise(resolve => setTimeout(resolve, 5000));

                // Verifică dacă memoria s-a eliberat
                const memAfter = this.getMemoryUsage();
                this.log(`📊 Memorie după cleanup: ${memAfter.display}`);

                // Restart
                const restartSuccess = await this.restartScript();
                if (restartSuccess) {
                    this.log('✅ Restart preventiv reușit');
                    this.lastCrashNotificationTime = Date.now();
                }
            } catch (error) {
                this.log(`❌ Eroare la restart preventiv: ${error.message}`);
            }
        } else if (mem.usedPercent >= MEMORY_WARNING_PERCENT) {
            this.log(`⚠️  MEMORIE WARNING: ${mem.display}`);
        }
    }

    /**
     * Start heartbeat timer (doar orele active 8:00-1:00, la fiecare 3 ore)
     */
    startHeartbeatTimer() {
        this.log(`💓 Pornesc heartbeat timer (la fiecare 3 ore, ${HEARTBEAT_START_HOUR}:00-${HEARTBEAT_END_HOUR}:00)`);

        lifecycle.setInterval('watchdog-heartbeat', async () => {
            const now = new Date();
            const hour = now.getHours();

            // Trimite doar în orele active: 8-23 și 0-1
            const isActiveHour = (hour >= HEARTBEAT_START_HOUR && hour <= 23) || (hour >= 0 && hour <= HEARTBEAT_END_HOUR);

            if (!isActiveHour) {
                this.log(`😴 Ora ${hour}:00 - heartbeat skip (ore de somn)`);
                return;
            }

            const uptime = this.getUptime();
            const lastProcessingTime = this.getLastProcessingTime();
            const memoryInfo = this.getMemoryUsage();

            let lastProcessingInfo = 'unknown';
            if (lastProcessingTime) {
                const hoursSince = Math.floor((Date.now() - lastProcessingTime) / 1000 / 60 / 60);
                const minutesSince = Math.floor(((Date.now() - lastProcessingTime) % (1000 * 60 * 60)) / 1000 / 60);

                if (hoursSince > 0) {
                    lastProcessingInfo = `${hoursSince}h ${minutesSince}m ago`;
                } else {
                    lastProcessingInfo = `${minutesSince}m ago`;
                }
            }

            this.log(`💓 Trimit heartbeat (uptime: ${uptime}, last processing: ${lastProcessingInfo}, memory: ${memoryInfo.display})`);

            await this.notifier.sendHeartbeatNotification(
                uptime,
                this.restartCount,
                process.pid,
                memoryInfo
            );
        }, HEARTBEAT_INTERVAL);
    }

    /**
     * Start health check timer
     */
    startHealthCheckTimer() {
        this.log(`🏥 Pornesc health check timer (la fiecare ${HEALTH_CHECK_INTERVAL / 1000 / 60} minute)`);

        lifecycle.setInterval('watchdog-health-check', async () => {
            await this.checkHealth();
        }, HEALTH_CHECK_INTERVAL);

        // First check după 30 secunde
        setTimeout(() => this.checkHealth(), 30000);
    }

    /**
     * Cleanup - trimite notificare la shutdown/OOM
     */
    cleanup(signal = 'UNKNOWN') {
        this.log(`🛑 Cleanup watchdog... (signal: ${signal})`);

        lifecycle.clearInterval('watchdog-heartbeat');
        lifecycle.clearInterval('watchdog-health-check');

        // Trimite notificare SINCRONĂ de shutdown (nu putem folosi async la exit)
        try {
            const mem = this.getMemoryUsage();
            const uptime = this.getUptime();
            this.log(`📊 Memorie la shutdown: ${mem.display}`);

            // Salvează crash state pentru a putea notifica la restart
            this.saveCrashState(true);

            // Scrie fișier marker pentru a ști că watchdog-ul a fost oprit neașteptat
            const shutdownInfo = {
                timestamp: new Date().toISOString(),
                signal: signal,
                uptime: uptime,
                memory: mem,
                reason: signal === 'SIGTERM' ? 'WSL shutdown sau OOM-kill' : 'Manual stop'
            };
            fs.writeFileSync(
                path.join(__dirname, '.watchdog-shutdown.json'),
                JSON.stringify(shutdownInfo, null, 2)
            );
            this.log('💾 Shutdown info salvat');
        } catch (err) {
            // Best effort
        }

        process.exit(0);
    }

    /**
     * Start watchdog
     */
    async start() {
        this.log('═'.repeat(80));
        this.log('🐕 API SMART 5 - WATCHDOG MONITOR');
        this.log('═'.repeat(80));
        this.log('');
        this.log('📋 Configurație:');
        this.log(`   Monitor log: ${LOG_DIR}`);
        this.log(`   Heartbeat: La fiecare 3 ore (${HEARTBEAT_START_HOUR}:00-${HEARTBEAT_END_HOUR}:00)`);
        this.log(`   Health check: La fiecare ${HEALTH_CHECK_INTERVAL / 1000 / 60} minute`);
        this.log(`   Max inactive time: ${MAX_INACTIVE_TIME / 1000 / 60} minute`);
        this.log(`   Max no processing: ${MAX_NO_ACTIVITY_TIME / 1000 / 60 / 60} ore (ALERTĂ)`);
        this.log(`   Memory warning: ${MEMORY_WARNING_PERCENT}% | Memory critical: ${MEMORY_CRITICAL_PERCENT}%`);
        this.log(`   Auto-restart: ${AUTO_RESTART_ENABLED ? 'ACTIVAT' : 'DEZACTIVAT'}`);
        this.log(`   Script path: ${SCRIPT_PATH}`);
        this.log('');

        // NU trimitem START notification din Watchdog
        // API-SMART-5.js trimite deja la commandFull() — evităm duplicat
        this.log('📋 Watchdog pornit (START email se trimite din API-SMART-5.js)');

        // Verifică dacă a fost un shutdown anterior (OOM/crash)
        const shutdownFile = path.join(__dirname, '.watchdog-shutdown.json');
        if (fs.existsSync(shutdownFile)) {
            try {
                const shutdownInfo = JSON.parse(fs.readFileSync(shutdownFile, 'utf8'));
                this.log(`🚨 Detectat SHUTDOWN anterior: ${shutdownInfo.signal} la ${shutdownInfo.timestamp}`);
                this.log(`   Memorie la crash: ${shutdownInfo.memory?.display || 'N/A'}`);
                this.log(`   Uptime la crash: ${shutdownInfo.uptime || 'N/A'}`);

                // Trimite notificare despre shutdown-ul anterior
                await this.notifier.sendCrashNotification({
                    reason: `WSL/Watchdog s-a oprit neașteptat (${shutdownInfo.signal}) la ${shutdownInfo.timestamp}. Memorie la crash: ${shutdownInfo.memory?.display || 'N/A'}. Uptime: ${shutdownInfo.uptime || 'N/A'}`,
                    exitCode: null,
                    signal: shutdownInfo.signal,
                    restartCount: this.restartCount,
                    pid: process.pid
                });

                // Șterge fișierul marker
                fs.unlinkSync(shutdownFile);
                this.log('📧 Notificare shutdown trimisă');
            } catch (err) {
                this.log(`⚠️  Eroare la citire shutdown info: ${err.message}`);
            }
        }

        // Log memorie curentă
        const mem = this.getMemoryUsage();
        this.log(`📊 Memorie curentă: ${mem.display}`);

        // Start timers
        this.startHeartbeatTimer();
        this.startHealthCheckTimer();

        this.log('✅ Watchdog pornit și monitorizează API SMART 5\n');
    }
}

// Run watchdog
if (require.main === module) {
    const watchdog = new Watchdog();
    watchdog.start();
}

module.exports = Watchdog;
