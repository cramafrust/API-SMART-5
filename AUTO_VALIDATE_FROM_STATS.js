/**
 * AUTO_VALIDATE_FROM_STATS.js
 *
 * Validează automat pronosticurile folosind JSON-urile cu statistici salvate
 *
 * USAGE:
 *   node AUTO_VALIDATE_FROM_STATS.js              # Validează toate nevalidate
 *   node AUTO_VALIDATE_FROM_STATS.js 2026-01-31   # Validează doar din data specificată
 */

const fs = require('fs');
const path = require('path');

const TRACKING_FILE = path.join(__dirname, 'notifications_tracking.json');

/**
 * Încarcă statisticile pentru un meci
 */
function loadMatchStats(matchId) {
    const statsFile = path.join(__dirname, `stats-${matchId}-HT.json`);

    if (!fs.existsSync(statsFile)) {
        return null;
    }

    try {
        return JSON.parse(fs.readFileSync(statsFile, 'utf8'));
    } catch (err) {
        console.error(`⚠️  Eroare citire stats pentru ${matchId}: ${err.message}`);
        return null;
    }
}

/**
 * Verifică dacă un pattern s-a îndeplinit
 */
function validatePattern(patternName, teamType, stats) {
    if (!stats || !stats.scor) {
        return { success: null, reason: 'Lipsesc statistici complete' };
    }

    const scor = stats.scor;
    const statistici = stats.statistici || {};

    // Determinăm ce echipă verificăm
    const isHome = (teamType === 'gazda' || teamType === 'home');
    const isAway = (teamType === 'oaspete' || teamType === 'away');

    // PATTERN 1.x, 2.x, 4.x, 7.x, 8.x - Echipa marchează în repriza 2
    if (patternName.match(/^PATTERN_[12478]\./)) {
        let goluriR2 = 0;

        if (scor.final_gazda !== undefined && scor.final_oaspete !== undefined) {
            if (isHome) {
                const goluriPauza = scor.pauza_gazda || 0;
                const goluriFinal = scor.final_gazda || 0;
                goluriR2 = goluriFinal - goluriPauza;
            } else if (isAway) {
                const goluriPauza = scor.pauza_oaspete || 0;
                const goluriFinal = scor.final_oaspete || 0;
                goluriR2 = goluriFinal - goluriPauza;
            }

            const success = goluriR2 >= 1;
            return {
                success,
                reason: success ? `Echipa a marcat ${goluriR2} gol(uri) în R2` : `Echipa nu a marcat în R2 (${goluriR2} goluri)`
            };
        }

        return { success: null, reason: 'Scor final lipsă' };
    }

    // PATTERN 3.x - Peste 2.5 goluri în meci
    if (patternName.match(/^PATTERN_3\./)) {
        if (scor.final_gazda !== undefined && scor.final_oaspete !== undefined) {
            const totalGoluri = (scor.final_gazda || 0) + (scor.final_oaspete || 0);
            const success = totalGoluri > 2.5;
            return {
                success,
                reason: success ? `${totalGoluri} goluri (> 2.5)` : `${totalGoluri} goluri (≤ 2.5)`
            };
        }
        return { success: null, reason: 'Scor final lipsă' };
    }

    // PATTERN 5.x, 6.x - Cornere echipă în repriza 2
    if (patternName.match(/^PATTERN_[56]\./)) {
        const cornere = statistici.cornere || {};
        let cornereR2 = 0;

        if (isHome && cornere.repriza_2_gazda !== undefined) {
            cornereR2 = cornere.repriza_2_gazda || 0;
        } else if (isAway && cornere.repriza_2_oaspete !== undefined) {
            cornereR2 = cornere.repriza_2_oaspete || 0;
        } else {
            return { success: null, reason: 'Date cornere R2 lipsă' };
        }

        const success = cornereR2 > 2; // Peste 2 cornere
        return {
            success,
            reason: success ? `${cornereR2} cornere în R2 (> 2)` : `${cornereR2} cornere în R2 (≤ 2)`
        };
    }

    // PATTERN 9.x - Cartonașe galbene
    if (patternName.match(/^PATTERN_9\./)) {
        const cards = statistici.cartonase_galbene || {};
        if (scor.final_gazda !== undefined) {
            const totalCards = (cards.pauza_gazda || 0) + (cards.pauza_oaspete || 0) +
                             (cards.repriza_2_gazda || 0) + (cards.repriza_2_oaspete || 0);
            const success = totalCards >= 3; // Minim 3 cartonașe
            return {
                success,
                reason: success ? `${totalCards} cartonașe (≥ 3)` : `${totalCards} cartonașe (< 3)`
            };
        }
        return { success: null, reason: 'Date cartonașe lipsă' };
    }

    return { success: null, reason: 'Pattern necunoscut' };
}

/**
 * Validează toate notificările nevalidate
 */
function autoValidateNotifications(targetDate = null) {
    console.log('\n🔍 AUTO-VALIDARE PRONOSTICURI DIN STATISTICI\n');
    console.log('='.repeat(60));

    // Încarcă tracking
    if (!fs.existsSync(TRACKING_FILE)) {
        console.error('❌ Fișier tracking nu există!');
        return;
    }

    const trackingData = JSON.parse(fs.readFileSync(TRACKING_FILE, 'utf8'));
    let notifications = trackingData.notifications || [];

    // Filtrează după dată dacă e specificată
    if (targetDate) {
        notifications = notifications.filter(n => {
            const d = new Date(n.timestamp).toISOString().split('T')[0];
            return d === targetDate;
        });
        console.log(`📅 Filtrare pentru data: ${targetDate}`);
    }

    // Filtrează doar cele cu pattern valid și nevalidate sau expirate
    notifications = notifications.filter(n =>
        n.pattern &&
        n.pattern.team &&
        n.pattern.name &&
        (!n.result || n.result === 'EXPIRED' || n.result === 'UNKNOWN')
    );

    console.log(`📊 Notificări de validat: ${notifications.length}\n`);

    let validated = 0;
    let won = 0;
    let lost = 0;
    let unknown = 0;

    notifications.forEach((notif, index) => {
        console.log(`[${index + 1}/${notifications.length}] ${notif.homeTeam} vs ${notif.awayTeam}`);
        console.log(`   Pattern: ${notif.pattern.name} (${notif.pattern.team})`);

        // Încarcă statistici
        const stats = loadMatchStats(notif.matchId);

        if (!stats) {
            console.log(`   ⚠️  Fără statistici salvate\n`);
            return;
        }

        // Validează
        const validation = validatePattern(notif.pattern.name, notif.pattern.team, stats);

        if (validation.success === true) {
            notif.result = 'WON';
            notif.validationReason = validation.reason;
            notif.validated = true;
            notif.status = 'COMPLETED';
            won++;
            validated++;
            console.log(`   ✅ CÂȘTIGAT - ${validation.reason}\n`);
        } else if (validation.success === false) {
            notif.result = 'LOST';
            notif.validationReason = validation.reason;
            notif.validated = true;
            notif.status = 'COMPLETED';
            lost++;
            validated++;
            console.log(`   ❌ PIERDUT - ${validation.reason}\n`);
        } else {
            notif.result = 'UNKNOWN';
            notif.validationReason = validation.reason;
            unknown++;
            console.log(`   ⚠️  NECUNOSCUT - ${validation.reason}\n`);
        }

        notif.validatedAt = new Date().toISOString();
    });

    // Salvează tracking actualizat
    fs.writeFileSync(TRACKING_FILE, JSON.stringify(trackingData, null, 2));

    console.log('='.repeat(60));
    console.log('\n📊 REZULTATE VALIDARE:');
    console.log(`   ✅ Câștigate: ${won}`);
    console.log(`   ❌ Pierdute: ${lost}`);
    console.log(`   ⚠️  Necunoscute: ${unknown}`);
    console.log(`   📈 Success rate: ${validated > 0 ? Math.round(won / validated * 100) : 0}%`);
    console.log(`\n✅ ${validated} notificări validate!\n`);
}

// Main
const targetDate = process.argv[2]; // Optional: 2026-01-31
autoValidateNotifications(targetDate);
