#!/usr/bin/env node
/**
 * Verifică status completare parametri
 */

const fs = require('fs');
const glob = require('glob');
const path = require('path');

// Check progress file
let progress = { completed: 0, failed: 0, skipped: 0 };
try {
    progress = JSON.parse(fs.readFileSync('complete_params_progress.json', 'utf8'));
} catch(e) {}

console.log('📊 STATUS COMPLETARE PARAMETRI\n' + '='.repeat(60));
console.log(`✅ Parametri completați: ${progress.completed}`);
console.log(`❌ Eșecuri: ${progress.failed}`);
console.log(`⏭️  Săriți (deja completați): ${progress.skipped}\n`);

// Count total missing across all seasons
const seasons = glob.sync('data/seasons/complete_FULL_SEASON_*.json').filter(f => !f.includes('BACKUP'));
let totalMissing = 0;
let totalMatches = 0;

seasons.forEach(file => {
    try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        const matches = data.meciuri || [];
        totalMatches += matches.length;

        matches.forEach(m => {
            if (!m.etapa || m.etapa === 'N/A') totalMissing++;
        });
    } catch(e) {}
});

console.log(`📁 Total meciuri în baza de date: ${totalMatches}`);
console.log(`🔍 Parametri etapa lipsă: ${totalMissing}`);
console.log(`📈 Progres: ${((progress.completed / totalMissing) * 100).toFixed(2)}%\n`);

const remaining = totalMissing - progress.completed;
const daysNeeded = Math.ceil(remaining / 10); // 10 per day in CRON

console.log(`⏳ Rămâne de completat: ${remaining}`);
console.log(`📅 Estimare completare (10/zi): ~${daysNeeded} zile\n`);
console.log('='.repeat(60));
