#!/usr/bin/env node
/**
 * MIGRATE_DATA_STRUCTURE.js
 *
 * Migrează structura de date din formatul vechi în formatul nou:
 *
 * VECHI:
 *   data/seasons/complete_FULL_SEASON_PremierLeague_2025-2026.json
 *   notifications_tracking.json (root)
 *   prematch_tracking.json (root)
 *   meciuri-2026-03-28.json (root)
 *
 * NOU:
 *   data/seasons/2025-2026/PremierLeague.json
 *   data/tracking/notifications.json
 *   data/tracking/prematch.json
 *   data/daily/2026-03-28/meciuri.json
 *   data/streaks/*.json
 *
 * SAFE: Creează symlink-uri de la path-ul vechi la cel nou,
 *       astfel încât modulele neactualizate încă funcționează.
 */

const fs = require('fs');
const path = require('path');
const { DIRS, FILES, LEGACY, ensureDirs } = require('./PATHS');

const BASE_DIR = __dirname;
const DRY_RUN = process.argv.includes('--dry-run');

function log(msg) { console.log(DRY_RUN ? `[DRY-RUN] ${msg}` : msg); }

function moveFile(oldPath, newPath) {
    if (!fs.existsSync(oldPath)) return false;
    if (fs.existsSync(newPath)) {
        log(`  ⚠️  Destinația există deja: ${newPath}`);
        return false;
    }

    // Asigură directorul destinație
    const dir = path.dirname(newPath);
    if (!fs.existsSync(dir)) {
        if (!DRY_RUN) fs.mkdirSync(dir, { recursive: true });
        log(`  📁 Creat director: ${dir}`);
    }

    if (!DRY_RUN) {
        fs.copyFileSync(oldPath, newPath);
        fs.unlinkSync(oldPath);
        // Symlink de la vechi la nou (compatibilitate)
        try { fs.symlinkSync(newPath, oldPath); } catch {}
    }
    log(`  ✅ ${path.basename(oldPath)} → ${path.relative(BASE_DIR, newPath)}`);
    return true;
}

async function migrate() {
    log('═══════════════════════════════════════════════════════');
    log('  MIGRARE STRUCTURĂ DATE API SMART 5');
    log('═══════════════════════════════════════════════════════');
    log('');

    // 1. Creează directoarele noi
    log('📁 PASUL 1: Creare directoare noi...');
    if (!DRY_RUN) ensureDirs();
    Object.entries(DIRS).forEach(([name, dir]) => {
        log(`  📁 ${name}: ${path.relative(BASE_DIR, dir)}`);
    });
    log('');

    // 2. Migrare season files
    log('📊 PASUL 2: Migrare season files...');
    const oldSeasonsDir = path.join(BASE_DIR, 'data', 'seasons');
    let seasonsMoved = 0;

    if (fs.existsSync(oldSeasonsDir)) {
        const files = fs.readdirSync(oldSeasonsDir).filter(f =>
            f.startsWith('complete_FULL_SEASON_') && f.endsWith('.json') &&
            !f.includes('backup') && !f.includes('CORRUPT') && !f.includes('OLD_FORMAT')
        );

        for (const file of files) {
            const match = file.match(/^complete_FULL_SEASON_(.+?)_(\d{4}-\d{4})\.json$/);
            if (!match) {
                log(`  ⚠️  Skip (format necunoscut): ${file}`);
                continue;
            }

            const [, league, season] = match;
            const oldPath = path.join(oldSeasonsDir, file);
            const newDir = path.join(DIRS.seasons, season);
            const newPath = path.join(newDir, `${league}.json`);

            if (moveFile(oldPath, newPath)) seasonsMoved++;
        }
    }
    log(`  📊 Total: ${seasonsMoved} fișiere season migrate`);
    log('');

    // 3. Migrare tracking files
    log('📋 PASUL 3: Migrare tracking files...');
    moveFile(
        path.join(BASE_DIR, 'notifications_tracking.json'),
        FILES.notifications
    );
    moveFile(
        path.join(BASE_DIR, 'prematch_tracking.json'),
        FILES.prematch
    );
    log('');

    // 4. Migrare streaks (din data/ în data/streaks/)
    log('📈 PASUL 4: Migrare streak files...');
    const streakFiles = [
        ['streak_patterns_catalog.json', FILES.streakCatalog],
        ['scoring_streak_probabilities.json', FILES.scoringStreak],
        ['goal_streak_probabilities.json', FILES.goalStreak],
        ['yellow_cards_streak_probabilities.json', FILES.yellowCards],
        ['yellow_cards_2plus_streak_probabilities.json', FILES.yellowCards2plus],
    ];
    for (const [oldName, newPath] of streakFiles) {
        moveFile(path.join(BASE_DIR, 'data', oldName), newPath);
    }
    log('');

    // 5. Migrare fișiere zilnice
    log('📅 PASUL 5: Migrare fișiere zilnice...');
    let dailyMoved = 0;
    const rootFiles = fs.readdirSync(BASE_DIR);

    // meciuri-YYYY-MM-DD.json → data/daily/YYYY-MM-DD/meciuri.json
    for (const file of rootFiles) {
        let match;
        let type, date;

        if ((match = file.match(/^meciuri-(\d{4}-\d{2}-\d{2})\.json$/))) {
            [, date] = match; type = 'meciuri';
        } else if ((match = file.match(/^verificari-(\d{4}-\d{2}-\d{2})\.json$/))) {
            [, date] = match; type = 'verificari';
        } else if ((match = file.match(/^final-verificari-(\d{4}-\d{2}-\d{2})\.json$/))) {
            [, date] = match; type = 'final-verificari';
        } else {
            continue;
        }

        const oldPath = path.join(BASE_DIR, file);
        const newDir = path.join(DIRS.daily, date);
        const newPath = path.join(newDir, `${type}.json`);

        if (moveFile(oldPath, newPath)) dailyMoved++;
    }

    // daily_collected_YYYY-MM-DD.json → data/daily/YYYY-MM-DD/collected.json
    const dataDir = path.join(BASE_DIR, 'data');
    if (fs.existsSync(dataDir)) {
        const dataFiles = fs.readdirSync(dataDir);
        for (const file of dataFiles) {
            const match = file.match(/^daily_collected_(\d{4}-\d{2}-\d{2})\.json$/);
            if (!match) continue;

            const date = match[1];
            const oldPath = path.join(dataDir, file);
            const newPath = path.join(DIRS.daily, date, 'collected.json');

            if (moveFile(oldPath, newPath)) dailyMoved++;
        }
    }

    log(`  📅 Total: ${dailyMoved} fișiere zilnice migrate`);
    log('');

    // 6. Migrare procente (rename)
    log('📊 PASUL 6: Migrare procente...');
    const oldProcente = path.join(DIRS.procente, 'JSON PROCENTE AUTOACTUAL.json');
    if (fs.existsSync(oldProcente) && !fs.existsSync(FILES.procente)) {
        moveFile(oldProcente, FILES.procente);
    } else if (fs.existsSync(oldProcente)) {
        log('  ✅ Procente deja la locul corect (sau rename necesar doar dacă diferă)');
    }
    log('');

    // REZUMAT
    log('═══════════════════════════════════════════════════════');
    log(`  ✅ MIGRARE ${DRY_RUN ? '(DRY-RUN) ' : ''}COMPLETĂ`);
    log(`  📊 ${seasonsMoved} season files migrate`);
    log(`  📅 ${dailyMoved} fișiere zilnice migrate`);
    log(`  📋 Tracking files migrate`);
    log(`  📈 Streak files migrate`);
    log('═══════════════════════════════════════════════════════');

    if (DRY_RUN) {
        log('\n💡 Rulează fără --dry-run pentru a executa migrarea efectivă.');
    }
}

migrate().catch(e => {
    console.error('❌ Eroare migrare:', e.message);
    process.exit(1);
});
