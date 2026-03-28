/**
 * VALIDATE_FROM_CHAMPIONSHIPS.js
 *
 * Validează pronosticuri folosind datele COMPLETE din JSON-urile campionatelor
 */

const fs = require('fs');
const path = require('path');

const TRACKING_FILE = path.join(__dirname, 'notifications_tracking.json');
const CHAMPIONSHIPS_DIR = path.join(__dirname, 'data', 'seasons');

/**
 * Găsește meciul în JSON-urile campionatelor
 */
function findMatchInChampionships(matchId) {
    const files = fs.readdirSync(CHAMPIONSHIPS_DIR).filter(f => f.endsWith('.json'));

    for (const file of files) {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(CHAMPIONSHIPS_DIR, file), 'utf8'));

            if (!data.meciuri || !Array.isArray(data.meciuri)) continue;

            const match = data.meciuri.find(m => m.id_meci === matchId || m.id_flashscore === matchId);

            if (match) {
                return match;
            }
        } catch (err) {
            // Skip fișiere corupte
            continue;
        }
    }

    return null;
}

/**
 * Validează pattern
 */
function validatePattern(patternName, teamType, matchData) {
    if (!matchData || !matchData.scor) {
        return { success: null, reason: 'Date meci lipsă' };
    }

    const scor = matchData.scor;
    const stats = matchData.statistici || {};

    // PATTERN 1.x, 2.x, 4.x, 7.x, 8.x - Echipa marchează în R2
    if (patternName.match(/^PATTERN_[12478]\./)) {
        let goluriR2 = 0;

        if (scor.final_gazda !== undefined && scor.final_oaspete !== undefined) {
            if (teamType === 'gazda' || teamType === 'home') {
                goluriR2 = (scor.final_gazda || 0) - (scor.pauza_gazda || 0);
            } else if (teamType === 'oaspete' || teamType === 'away') {
                goluriR2 = (scor.final_oaspete || 0) - (scor.pauza_oaspete || 0);
            }

            const success = goluriR2 >= 1;
            return {
                success,
                reason: success ? `Echipa a marcat ${goluriR2} gol(uri) în R2` : `Echipa NU a marcat în R2`
            };
        }

        return { success: null, reason: 'Scor lipsă' };
    }

    // PATTERN 3.x - Peste 2.5 goluri
    if (patternName.match(/^PATTERN_3\./)) {
        if (scor.final_gazda !== undefined && scor.final_oaspete !== undefined) {
            const total = (scor.final_gazda || 0) + (scor.final_oaspete || 0);
            const success = total > 2.5;
            return {
                success,
                reason: success ? `${total} goluri (> 2.5) ✓` : `${total} goluri (≤ 2.5) ✗`
            };
        }
        return { success: null, reason: 'Scor lipsă' };
    }

    // PATTERN 5.x, 6.x - Cornere R2
    if (patternName.match(/^PATTERN_[56]\./)) {
        const cornere = stats.cornere || {};
        let cornereR2 = 0;

        if (teamType === 'gazda' || teamType === 'home') {
            cornereR2 = cornere.repriza_2_gazda || 0;
        } else if (teamType === 'oaspete' || teamType === 'away') {
            cornereR2 = cornere.repriza_2_oaspete || 0;
        }

        const success = cornereR2 > 2;
        return {
            success,
            reason: success ? `${cornereR2} cornere R2 (> 2) ✓` : `${cornereR2} cornere R2 (≤ 2) ✗`
        };
    }

    // PATTERN 9.x - Cartonașe
    if (patternName.match(/^PATTERN_9\./)) {
        const cards = stats.cartonase_galbene || {};
        const total = (cards.total_gazda || 0) + (cards.total_oaspete || 0);
        const success = total >= 3;
        return {
            success,
            reason: success ? `${total} cartonașe (≥ 3) ✓` : `${total} cartonașe (< 3) ✗`
        };
    }

    return { success: null, reason: 'Pattern necunoscut: ' + patternName };
}

/**
 * Main
 */
function validateFromChampionships(targetDate) {
    console.log('\n🔍 VALIDARE DIN JSON-URI CAMPIONATE\n');
    console.log('='.repeat(60));

    const trackingData = JSON.parse(fs.readFileSync(TRACKING_FILE, 'utf8'));
    let notifications = trackingData.notifications || [];

    if (targetDate) {
        notifications = notifications.filter(n => {
            const d = new Date(n.timestamp).toISOString().split('T')[0];
            return d === targetDate;
        });
        console.log(`📅 Data: ${targetDate}`);
    }

    notifications = notifications.filter(n =>
        n.pattern?.team &&
        n.pattern?.name &&
        (!n.result || n.result === 'EXPIRED' || n.result === 'UNKNOWN')
    );

    console.log(`📊 Notificări de validat: ${notifications.length}\n`);

    let won = 0, lost = 0, unknown = 0;

    notifications.forEach((notif, i) => {
        console.log(`[${i + 1}/${notifications.length}] ${notif.homeTeam} vs ${notif.awayTeam}`);
        console.log(`   Pattern: ${notif.pattern.name} (${notif.pattern.team})`);

        const matchData = findMatchInChampionships(notif.matchId);

        if (!matchData) {
            console.log(`   ⚠️  Meci negăsit în campionate\n`);
            notif.result = 'UNKNOWN';
            notif.validationReason = 'Meci negăsit';
            unknown++;
            return;
        }

        const validation = validatePattern(notif.pattern.name, notif.pattern.team, matchData);

        if (validation.success === true) {
            notif.result = 'WON';
            notif.validationReason = validation.reason;
            notif.validated = true;
            notif.status = 'COMPLETED';
            won++;
            console.log(`   ✅ CÂȘTIGAT - ${validation.reason}\n`);
        } else if (validation.success === false) {
            notif.result = 'LOST';
            notif.validationReason = validation.reason;
            notif.validated = true;
            notif.status = 'COMPLETED';
            lost++;
            console.log(`   ❌ PIERDUT - ${validation.reason}\n`);
        } else {
            notif.result = 'UNKNOWN';
            notif.validationReason = validation.reason;
            unknown++;
            console.log(`   ⚠️  ${validation.reason}\n`);
        }

        notif.validatedAt = new Date().toISOString();
    });

    fs.writeFileSync(TRACKING_FILE, JSON.stringify(trackingData, null, 2));

    console.log('='.repeat(60));
    console.log('\n📊 REZULTATE:');
    console.log(`   ✅ Câștigate: ${won}`);
    console.log(`   ❌ Pierdute: ${lost}`);
    console.log(`   ⚠️  Necunoscute: ${unknown}`);
    const validated = won + lost;
    console.log(`   📈 Success rate: ${validated > 0 ? Math.round(won / validated * 100) : 0}%\n`);
}

const targetDate = process.argv[2];
validateFromChampionships(targetDate);
