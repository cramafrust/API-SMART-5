const fs = require('fs');
const NotificationTracker = require('./NOTIFICATION_TRACKER');
const { fetchMatchDetails } = require('./flashscore-api');

async function validateRecent() {
    const data = JSON.parse(fs.readFileSync('notifications_tracking.json', 'utf8'));

    // Găsește notificări COMPLETED din ultima oră care NU au fost validate
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    const recentCompleted = data.notifications.filter(n =>
        n.status === 'COMPLETED' &&
        (!n.result || n.result === 'N/A') &&
        n.timestamp > oneHourAgo
    ).sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);

    console.log('📊 MECIURI COMPLETATE RECENT (ultimele 10 - fără validare):\n');
    console.log('Total găsite:', recentCompleted.length);
    console.log('');

    if (recentCompleted.length === 0) {
        console.log('⚪ Niciun meci de validat');
        return;
    }

    for (let i = 0; i < recentCompleted.length; i++) {
        const n = recentCompleted[i];
        const time = new Date(n.timestamp).toLocaleTimeString('ro-RO');

        console.log(`\n[${ i + 1 }/${ recentCompleted.length }] ${ n.match } (${ time })`);
        console.log(`   Pattern: ${ n.pattern?.name || 'N/A' } | Prob: ${ n.probability }%`);
        console.log(`   Match ID: ${ n.matchId }`);

        try {
            // Obține detalii meci
            const details = await fetchMatchDetails(n.matchId);

            if (!details || !details.core) {
                console.log('   ❌ Nu s-au putut obține detalii');
                continue;
            }

            // Verifică dacă meciul s-a terminat
            if (details.core.AZ !== '1') {
                console.log('   ⏳ Meci încă în desfășurare');
                continue;
            }

            const ftHome = parseInt(details.core.AG) || 0;
            const ftAway = parseInt(details.core.AH) || 0;

            console.log(`   Scor final: ${ ftHome }-${ ftAway }`);

            // Verifică dacă avem scor HT
            if (!n.htScore && !n.initial_score) {
                console.log('   ⚠️  Lipsește scor la pauză - SKIP');
                continue;
            }

            // Extrage scor HT
            let htHome = 0, htAway = 0;
            if (n.htScore) {
                const parts = n.htScore.split('-');
                htHome = parseInt(parts[0]) || 0;
                htAway = parseInt(parts[1]) || 0;
            } else if (n.initial_score) {
                const parts = n.initial_score.split('-');
                htHome = parseInt(parts[0]) || 0;
                htAway = parseInt(parts[1]) || 0;
            }

            console.log(`   Scor HT: ${ htHome }-${ htAway }`);

            // Calculează goluri repriza 2
            const secondHalfGoals = (ftHome - htHome) + (ftAway - htAway);
            console.log(`   Goluri repriza 2: ${ secondHalfGoals }`);

            // Determină rezultat
            let result = 'LOST';
            if (secondHalfGoals >= 1) {
                result = 'WON';
                console.log('   ✅ CÂȘTIGAT - A marcat în repriza 2!');
            } else {
                console.log('   ❌ PIERDUT - NU a marcat în repriza 2');
            }

            // Actualizează în tracking
            NotificationTracker.updateNotification(n.id, {
                result: result,
                final_score: `${ ftHome }-${ ftAway }`,
                validatedAt: new Date().toISOString()
            });

            console.log(`   💾 Salvat: ${ result }`);

            // Delay între request-uri
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            console.error(`   ❌ Eroare: ${ error.message }`);
        }
    }

    console.log('\n✅ VALIDARE COMPLETĂ!\n');
}

validateRecent().catch(console.error);
