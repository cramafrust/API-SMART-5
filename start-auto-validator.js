#!/usr/bin/env node
/**
 * 🤖 START AUTO-VALIDATOR
 *
 * Script de pornire pentru AUTO-VALIDATOR în mod daemon
 * Se apelează automat când pornește API SMART 5
 */

const fs = require('fs');
const path = require('path');
const AutoValidator = require('./AUTO_VALIDATOR');

// Interval: 6 ore = 21600 secunde
const INTERVAL_SECONDS = 6 * 60 * 60;

// Lock file pentru a preveni instanțe duplicate
const LOCK_FILE = path.join(__dirname, '.auto-validator.lock');

function isAlreadyRunning() {
    try {
        if (fs.existsSync(LOCK_FILE)) {
            const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
            // Verifică dacă procesul din lock file mai rulează
            try {
                process.kill(lockData.pid, 0); // Signal 0 = doar verifică dacă există
                return true; // Procesul încă rulează
            } catch (e) {
                // Procesul nu mai rulează, lock file e stale — îl ștergem
                fs.unlinkSync(LOCK_FILE);
                return false;
            }
        }
    } catch (e) {
        // Lock file corupt sau eroare — îl ștergem și continuăm
        try { fs.unlinkSync(LOCK_FILE); } catch (_) {}
    }
    return false;
}

function createLockFile() {
    fs.writeFileSync(LOCK_FILE, JSON.stringify({
        pid: process.pid,
        startTime: new Date().toISOString()
    }), 'utf8');
}

function removeLockFile() {
    try { fs.unlinkSync(LOCK_FILE); } catch (_) {}
}

// Verifică dacă altă instanță rulează deja
if (isAlreadyRunning()) {
    console.log(`⚠️  AUTO-VALIDATOR deja rulează (lock file: ${LOCK_FILE}). Se oprește.`);
    process.exit(0);
}

// Creează lock file
createLockFile();

// Setup logging
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, `auto-validator-${new Date().toISOString().split('T')[0]}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Redirect console to log file
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
    const timestamp = new Date().toISOString();
    const message = args.join(' ');
    logStream.write(`[${timestamp}] ${message}\n`);
    originalLog(...args);
};

console.error = (...args) => {
    const timestamp = new Date().toISOString();
    const message = args.join(' ');
    logStream.write(`[${timestamp}] ERROR: ${message}\n`);
    originalError(...args);
};

console.log('🤖 AUTO-VALIDATOR - Pornire daemon...');
console.log(`⏰ Interval validare: ${INTERVAL_SECONDS / 3600}h`);
console.log(`📅 Start: ${new Date().toLocaleString('ro-RO')}`);
console.log(`📁 Log file: ${logFile}`);

// Pornește auto-validarea continuă
AutoValidator.startAutoValidation(INTERVAL_SECONDS).catch(error => {
    console.error('❌ Eroare AUTO-VALIDATOR:', error.message);
    process.exit(1);
});

// Handle graceful shutdown — șterge lock file la exit
function cleanup() {
    console.log('\n🛑 AUTO-VALIDATOR - Oprire daemon');
    removeLockFile();
    logStream.end();
    process.exit(0);
}

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
process.on('exit', () => { removeLockFile(); });
