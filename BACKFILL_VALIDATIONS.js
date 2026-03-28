/**
 * 🔄 BACKFILL_VALIDATIONS.js
 *
 * Script de backfill pentru validarea tuturor notificărilor nevalidate.
 * Extrage scorurile finale de pe FlashScore API și validează pattern-urile.
 *
 * USAGE:
 *   node BACKFILL_VALIDATIONS.js                # Validează toate
 *   node BACKFILL_VALIDATIONS.js --dry-run      # Doar afișează ce ar valida
 *   node BACKFILL_VALIDATIONS.js --batch=20     # Procesează doar 20
 */

const NotificationTracker = require('./NOTIFICATION_TRACKER');
const ResultsValidator = require('./RESULTS_VALIDATOR');
const { extractFinalStats } = require('./FINAL_STATS_EXTRACTOR');
const fs = require('fs');
const path = require('path');

// Configurare
const DELAY_BETWEEN_MATCHES = 4000; // 4s între meciuri (rate limiting)
const DELAY_BETWEEN_API_CALLS = 2000; // 2s între API calls

/**
 * Găsește toate notificările care necesită validare
 */
function findUnvalidatedNotifications() {
    const trackingData = NotificationTracker.readStorage();
    if (!trackingData || !trackingData.notifications) return [];

    return trackingData.notifications.filter(n => {
        // Exclude cele deja validate corect
        if (n.validation_result === 'won' || n.validation_result === 'lost') return false;

        // Include: fără validation_result, unknown, sau validated=true dar fără result
        const noResult = !n.result || !n.result.fulltime;
        const isUnknown = n.validation_result === 'unknown';
        const isMissing = !n.validation_result || n.validation_result === 'pending';
        const hasNoValidation = n.validated && noResult;

        return isUnknown || isMissing || hasNoValidation;
    });
}

/**
 * Grupează notificările pe matchId (un singur API call per meci)
 */
function groupByMatch(notifications) {
    const groups = {};
    for (const n of notifications) {
        const key = n.matchId || n.id;
        if (!groups[key]) {
            groups[key] = {
                matchId: n.matchId,
                homeTeam: n.homeTeam,
                awayTeam: n.awayTeam,
                date: n.date,
                league: n.league,
                notifications: []
            };
        }
        groups[key].notifications.push(n);
    }
    return Object.values(groups);
}

/**
 * Procesează un grup de notificări pentru un meci
 */
async function processMatch(matchGroup) {
    const { matchId, homeTeam, awayTeam, date, league } = matchGroup;
    const matchLabel = `${homeTeam} vs ${awayTeam} (${date})`;

    console.log(`\n⚽ ${matchLabel}`);
    console.log(`   Match ID: ${matchId}`);
    console.log(`   Notificări de validat: ${matchGroup.notifications.length}`);

    if (!matchId) {
        console.log(`   ❌ Fără matchId — skip`);
        return { validated: 0, errors: matchGroup.notifications.length };
    }

    // Extrage date finale o singură dată per meci
    let matchData = null;
    try {
        matchData = await extractFinalStats(matchId, {
            homeTeam,
            awayTeam,
            league: league || 'Unknown'
        });
    } catch (error) {
        console.log(`   ❌ Eroare extragere date: ${error.message}`);
    }

    if (!matchData) {
        console.log(`   ⚠️  Nu s-au putut extrage date finale (meci prea vechi sau indisponibil)`);
        return { validated: 0, errors: 0, unavailable: matchGroup.notifications.length };
    }

    const ftScore = `${matchData.fulltime.score.home}-${matchData.fulltime.score.away}`;
    const htScore = `${matchData.halftime.score.home}-${matchData.halftime.score.away}`;
    console.log(`   📊 Scor: ${htScore} (HT) → ${ftScore} (FT)`);

    // Validează fiecare notificare din acest meci
    let validated = 0;
    let errors = 0;

    for (const notification of matchGroup.notifications) {
        try {
            // Pregătește notificarea pentru validare
            // Resetează statusul ca să treacă prin validator
            notification.validated = false;
            notification.validation_result = undefined;

            // Setează result-ul extras pentru a evita re-fetch
            notification.result = matchData;

            const result = await ResultsValidator.validateNotification(notification);

            if (result.success) {
                validated++;
                const d = result.validationDetails;
                const status = d.successCount > 0 && d.failCount === 0 ? '✅ WON' :
                              d.failCount > 0 && d.successCount === 0 ? '❌ LOST' : '⚠️  PARTIAL';
                console.log(`   ${status} | ${notification.pattern.name} | Scor: ${ftScore}`);
            } else {
                errors++;
                console.log(`   ❌ Eroare validare ${notification.pattern.name}: ${result.error || result.reason}`);
            }
        } catch (error) {
            errors++;
            console.log(`   ❌ Excepție ${notification.pattern.name}: ${error.message}`);
        }
    }

    return { validated, errors, unavailable: 0 };
}

/**
 * Main — rulează backfill-ul
 */
async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const batchArg = args.find(a => a.startsWith('--batch='));
    const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : Infinity;

    console.log('\n' + '█'.repeat(60));
    console.log('🔄 BACKFILL VALIDATIONS');
    console.log('█'.repeat(60));
    console.log(`⏰ ${new Date().toLocaleString('ro-RO')}`);
    if (dryRun) console.log('🔍 DRY RUN — nu se salvează nimic');
    if (batchSize < Infinity) console.log(`📦 Batch size: ${batchSize}`);

    // Găsește notificări nevalidate
    const unvalidated = findUnvalidatedNotifications();
    console.log(`\n📊 Total nevalidate: ${unvalidated.length}`);

    if (unvalidated.length === 0) {
        console.log('✅ Toate notificările sunt validate!');
        return;
    }

    // Grupează pe meciuri
    const matchGroups = groupByMatch(unvalidated);
    console.log(`⚽ Meciuri unice: ${matchGroups.length}`);

    // Sortează cele mai vechi primele
    matchGroups.sort((a, b) => {
        const dateA = a.notifications[0].timestamp || a.notifications[0].date;
        const dateB = b.notifications[0].timestamp || b.notifications[0].date;
        return new Date(dateA) - new Date(dateB);
    });

    // Limitează la batch size
    const toProcess = matchGroups.slice(0, batchSize);
    console.log(`🚀 Procesez: ${toProcess.length} meciuri\n`);
    console.log('─'.repeat(60));

    if (dryRun) {
        for (const group of toProcess) {
            console.log(`  ${group.date} | ${group.homeTeam} vs ${group.awayTeam} | ${group.notifications.length} pattern(s) | ID: ${group.matchId}`);
        }
        console.log('\n🔍 Dry run finalizat. Rulează fără --dry-run pentru a valida.');
        return;
    }

    // Procesează
    const totals = { validated: 0, errors: 0, unavailable: 0 };

    for (let i = 0; i < toProcess.length; i++) {
        const group = toProcess[i];
        console.log(`\n[${i + 1}/${toProcess.length}] ─────────────────────────────`);

        const result = await processMatch(group);
        totals.validated += result.validated;
        totals.errors += result.errors;
        totals.unavailable += (result.unavailable || 0);

        // Delay între meciuri
        if (i < toProcess.length - 1) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_MATCHES));
        }
    }

    // Sumar final
    console.log('\n' + '█'.repeat(60));
    console.log('📊 REZULTATE BACKFILL:');
    console.log(`   ✅ Validate cu succes: ${totals.validated}`);
    console.log(`   ❌ Erori: ${totals.errors}`);
    console.log(`   ⚠️  Indisponibile: ${totals.unavailable}`);
    console.log(`   📦 Total procesate: ${totals.validated + totals.errors + totals.unavailable}`);
    console.log('█'.repeat(60));

    // Verifică ce a mai rămas
    const remaining = findUnvalidatedNotifications();
    console.log(`\n📊 Rămase nevalidate: ${remaining.length}`);
}

main().catch(error => {
    console.error(`\n❌ EROARE CRITICĂ: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
});
