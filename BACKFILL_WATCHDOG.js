#!/usr/bin/env node
/**
 * BACKFILL_WATCHDOG - Monitorizează și repornește backfill-ul automat
 *
 * Verifică la fiecare 60s dacă UNIVERSAL_BACKFILL rulează.
 * Dacă nu rulează și mai sunt meciuri pending → repornește automat.
 * Logează tot în backfill-watchdog.log
 *
 * USAGE:
 *   node BACKFILL_WATCHDOG.js          # Pornește monitorizarea
 *   node BACKFILL_WATCHDOG.js --status # Arată status curent
 */

const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE_DIR = __dirname;
const LOG_FILE = path.join(BASE_DIR, 'logs', 'backfill-watchdog.log');
const STATE_FILE = path.join(BASE_DIR, 'backfill_state.json');
const CHECK_INTERVAL = 60000; // 60s
const MAX_RESTARTS = 10; // max reporniri per sesiune

let restartCount = 0;
let lastRestartTime = 0;

function log(msg) {
    const ts = new Date().toLocaleString('ro-RO');
    const line = `[${ts}] ${msg}`;
    console.log(line);
    try {
        fs.appendFileSync(LOG_FILE, line + '\n');
    } catch (e) { /* ignore */ }
}

function isBackfillRunning() {
    return new Promise((resolve) => {
        exec('pgrep -f "UNIVERSAL_BACKFILL"', (err, stdout) => {
            const pids = stdout.trim().split('\n').filter(p => p && p !== String(process.pid));
            resolve(pids.length > 0 ? pids : null);
        });
    });
}

function getPendingCount() {
    try {
        const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        let total = 0;
        for (const ls of Object.values(state.leagues || {})) {
            const disc = ls.discoveredIds ? ls.discoveredIds.length : 0;
            const proc = ls.processedIds ? ls.processedIds.length : 0;
            if (disc > proc) total += disc - proc;
        }
        return total;
    } catch (e) {
        return -1;
    }
}

function getLastLogLine() {
    try {
        const logDir = path.join(BASE_DIR, 'logs');
        const logFiles = fs.readdirSync(logDir)
            .filter(f => f.startsWith('backfill_phase2'))
            .sort().reverse();
        if (logFiles.length === 0) return null;

        const content = fs.readFileSync(path.join(logDir, logFiles[0]), 'utf8');
        const lines = content.trim().split('\n').filter(l => l.includes('SALVAT:') || l.includes('DUPLICAT:') || l.includes('EROARE'));
        return lines.length > 0 ? lines[lines.length - 1].trim() : null;
    } catch (e) {
        return null;
    }
}

function startBackfill() {
    log('🔄 Pornesc UNIVERSAL_BACKFILL --phase=2 --batch=15000');
    const logFile = path.join(BASE_DIR, 'logs', `backfill_phase2_full_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.log`);

    const child = spawn('node', ['UNIVERSAL_BACKFILL.js', '--phase=2', '--batch=15000'], {
        cwd: BASE_DIR,
        detached: true,
        stdio: ['ignore', fs.openSync(logFile, 'a'), fs.openSync(logFile, 'a')]
    });
    child.unref();

    restartCount++;
    lastRestartTime = Date.now();
    log(`✅ Backfill pornit (PID: ${child.pid}, restart #${restartCount})`);
    return child.pid;
}

async function check() {
    const pids = await isBackfillRunning();
    const pending = getPendingCount();

    if (pids) {
        // Rulează OK
        const lastLine = getLastLogLine();
        const shortLine = lastLine ? lastLine.substring(0, 100) : 'N/A';
        log(`✅ Backfill rulează (PID: ${pids.join(',')}) | Pending: ${pending} | Ultimul: ${shortLine}`);
        return;
    }

    // Nu rulează
    if (pending <= 0) {
        log('🏁 Backfill terminat — 0 meciuri pending. Opresc monitorizarea.');
        process.exit(0);
    }

    // Trebuie repornit
    log(`⚠️  Backfill NU rulează! Pending: ${pending}`);

    // Rate limiting: max 1 restart la 5 minute
    const timeSinceLastRestart = Date.now() - lastRestartTime;
    if (timeSinceLastRestart < 300000 && restartCount > 0) {
        log(`   ⏳ Aștept — ultimul restart acum ${Math.round(timeSinceLastRestart / 1000)}s (min 300s între restarturi)`);
        return;
    }

    if (restartCount >= MAX_RESTARTS) {
        log(`❌ Limită de restarturi atinsă (${MAX_RESTARTS}). Opresc monitorizarea.`);
        process.exit(1);
    }

    startBackfill();
}

function showStatus() {
    isBackfillRunning().then(pids => {
        const pending = getPendingCount();
        const lastLine = getLastLogLine();

        console.log('\n=== BACKFILL STATUS ===');
        console.log(`Rulează: ${pids ? 'DA (PID: ' + pids.join(',') + ')' : 'NU'}`);
        console.log(`Pending: ${pending} meciuri`);
        console.log(`Ultimul log: ${lastLine || 'N/A'}`);
        console.log('========================\n');
        process.exit(0);
    });
}

// Main
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes('--status')) {
        showStatus();
    } else {
        log('🔍 BACKFILL WATCHDOG pornit — verific la fiecare 60s');
        log(`   Pending: ${getPendingCount()} meciuri`);

        // Prima verificare imediat
        check();

        // Apoi la fiecare 60s
        setInterval(check, CHECK_INTERVAL);

        // Keep alive
        process.stdin.resume();

        process.on('SIGINT', () => {
            log('🛑 BACKFILL WATCHDOG oprit manual');
            process.exit(0);
        });
    }
}

module.exports = { isBackfillRunning, getPendingCount, startBackfill };
