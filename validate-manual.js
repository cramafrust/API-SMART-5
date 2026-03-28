const fs = require('fs');
const data = JSON.parse(fs.readFileSync('notifications-tracking.json', 'utf8'));

console.log('\n🎯 VALIDARE MANUALĂ - CÂTE AU CONFIRMAT?\n');
console.log('='.repeat(70));

const validated = data.notifications.filter(n => n.validated && n.result);

let totalPatterns = 0;
let successPatterns = 0;

validated.forEach((notif) => {
    const htHome = parseInt(notif.result.halftime.score.home);
    const htAway = parseInt(notif.result.halftime.score.away);
    const ftHome = parseInt(notif.result.fulltime.score.home);
    const ftAway = parseInt(notif.result.fulltime.score.away);

    const r2Home = ftHome - htHome;
    const r2Away = ftAway - htAway;
    const totalGoals = ftHome + ftAway;

    // Get corners if available
    const htCornersHome = parseInt(notif.result.halftime.statistics.home['Corner Kicks'] || 0);
    const htCornersAway = parseInt(notif.result.halftime.statistics.away['Corner Kicks'] || 0);
    const ftCornersHome = parseInt(notif.result.fulltime.statistics.home['Corner Kicks'] || 0);
    const ftCornersAway = parseInt(notif.result.fulltime.statistics.away['Corner Kicks'] || 0);

    const r2Corners = (ftCornersHome + ftCornersAway) - (htCornersHome + htCornersAway);

    console.log(`\n📋 ${notif.match.homeTeam} vs ${notif.match.awayTeam}`);
    console.log(`   HT: ${htHome}-${htAway}  →  FT: ${ftHome}-${ftAway}  (R2: ${r2Home}-${r2Away})`);
    console.log(`   Total goluri: ${totalGoals} | Cornere R2: ${r2Corners}`);
    console.log(`\n   Pattern-uri (${notif.patterns.length}):`);

    notif.patterns.forEach(pattern => {
        totalPatterns++;
        let success = null;
        let message = '';

        const patternName = pattern.patternName;
        const team = pattern.team;
        const teamName = pattern.teamName;

        // PATTERN_5.X - Team to score in 2H
        if (patternName.startsWith('PATTERN_5.')) {
            const r2Goals = team === 'gazda' ? r2Home : r2Away;

            if (patternName === 'PATTERN_5.8') {
                // 2+ goluri în R2
                success = r2Goals >= 2;
                message = `${teamName} să marcheze 2+ în R2 → ${r2Goals} goluri`;
            } else {
                // 1+ gol în R2
                success = r2Goals >= 1;
                message = `${teamName} să marcheze în R2 → ${r2Goals} goluri`;
            }
        }

        // PATTERN_6.X - Corners in 2H
        else if (patternName.startsWith('PATTERN_6.')) {
            if (patternName === 'PATTERN_6.3') {
                success = r2Corners >= 2;
                message = `2+ cornere în R2 → ${r2Corners} cornere`;
            }
        }

        // PATTERN_9.X - Total match goals
        else if (patternName.startsWith('PATTERN_9.')) {
            if (patternName === 'PATTERN_9.3') {
                success = totalGoals >= 3;
                message = `3+ goluri total → ${totalGoals} goluri`;
            }
        }

        // OVER_2_5_GOLURI - Team over 2.5 goals
        else if (patternName === 'OVER_2_5_GOLURI') {
            const teamGoals = team === 'gazda' ? ftHome : ftAway;
            success = teamGoals >= 3;
            message = `${teamName} 3+ goluri total → ${teamGoals} goluri`;
        }

        // BTTS
        else if (patternName === 'BTTS_GOLURI_AMBELE') {
            success = ftHome > 0 && ftAway > 0;
            message = `Ambele marchează → ${ftHome}-${ftAway}`;
        }

        if (success !== null) {
            const icon = success ? '✅' : '❌';
            console.log(`      ${icon} ${patternName} - ${message}`);
            if (success) successPatterns++;
        } else {
            console.log(`      ⚠️  ${patternName} - Pattern necunoscut`);
        }
    });
});

console.log('\n' + '='.repeat(70));
console.log(`\n📊 STATISTICI FINALE:\n`);
console.log(`   Total pattern-uri validate: ${totalPatterns}`);
console.log(`   ✅ Confirmate (SUCCESS): ${successPatterns}`);
console.log(`   ❌ Eșuate (FAILED): ${totalPatterns - successPatterns}`);
console.log(`   📈 Success Rate: ${((successPatterns / totalPatterns) * 100).toFixed(1)}%`);
console.log('\n' + '='.repeat(70));
console.log();
