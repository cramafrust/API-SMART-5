const tracker = require('./NOTIFICATION_TRACKER');
const FlashScoreAPI = require('./flashscore-api');

(async () => {
    console.log('🇦🇷 Adaug INDEPENDIENTE vs VELEZ SARSFIELD ca notificare completă...');
    console.log('');

    try {
        const api = new FlashScoreAPI();
        const today = new Date().toLocaleDateString('ro-RO');

        // Încearcă să găsească meciul pe FlashScore pentru detalii complete
        console.log('🔍 Căutare detalii meci pe FlashScore...');

        let matchData = null;
        try {
            const matches = await api.getMatchesByTeams('Independiente', 'Velez');
            if (matches && matches.length > 0) {
                matchData = matches[0];
                console.log('✅ Detalii găsite:');
                console.log('   ID:', matchData.id);
                console.log('   Status:', matchData.statusText || matchData.status);
                console.log('   Scor:', matchData.homeScore + '-' + matchData.awayScore);
            }
        } catch (err) {
            console.log('⚠️  Nu am găsit pe FlashScore, folosesc date manuale');
        }

        console.log('');

        // Creează notificarea completă - EXACT ca și cum ai primi email la pauză
        const notification = {
            id: matchData?.id || 'ARG_INDEPENDIENTE_' + Date.now(),
            match: 'Independiente vs Velez Sarsfield',
            homeTeam: 'Independiente',
            awayTeam: 'Velez Sarsfield',
            league: 'Argentina - Primera Division',
            country: 'Argentina',
            date: today,
            time: new Date().toLocaleTimeString('ro-RO'),

            // Eveniment - GOL în repriza 2
            event: 'UN GOL în repriza 2',

            // Pattern detectat
            pattern: {
                name: 'Echipa oaspete marchează în R2 după ce a pierdut R1',
                code: 'AWAY_GOAL_R2_AFTER_LOSING_R1'
            },

            // Probabilitate
            probability: '85%',

            // Status - ÎN MONITORIZARE (cum ar fi după HT)
            status: 'MONITORING',

            // Flag-uri importante
            skipMinuteFilter: true,  // Nu expira după 80 min
            oddsMonitoringFailed: false,

            // Cote - null până când sunt atinse pragurile
            minute_odd_1_50: null,
            minute_odd_2_00: null,

            // Date suplimentare
            matchData: matchData || {
                homeScore: 0,
                awayScore: 0,
                statusText: 'LIVE'
            },

            // Timestamp notificare (ca și cum ai primit email)
            notifiedAt: new Date().toISOString(),
            emailSent: true  // Marchează că "email a fost trimis"
        };

        // Adaugă în tracker
        tracker.addNotification(notification);

        console.log('✅ NOTIFICARE ADĂUGATĂ (ca după email la pauză):');
        console.log('');
        console.log('📧 Detalii notificare:');
        console.log('   Match:', notification.match);
        console.log('   League:', notification.league);
        console.log('   Event:', notification.event);
        console.log('   Pattern:', notification.pattern.name);
        console.log('   Probability:', notification.probability);
        console.log('   Status:', notification.status);
        console.log('   Email trimis:', notification.emailSent ? 'DA' : 'NU');
        console.log('');

        // Verifică în listă
        const active = tracker.getActiveMonitoring();
        const independiente = active.find(m =>
            m.homeTeam === 'Independiente' ||
            m.match.includes('Independiente')
        );

        if (independiente) {
            console.log('🎯 CONFIRMARE - Meci în monitorizare activă:');
            console.log('   Total meciuri active:', active.length);
            console.log('   ID:', independiente.id);
            console.log('   Status:', independiente.status);
            console.log('');
            console.log('⏰ SIMPLE_ODDS_MONITOR verifică automat la fiecare 2 min');
            console.log('📧 Email automat când cota >= 1.5 și >= 2.0');
            console.log('');
            console.log('📊 Cotă actuală pe Superbet: 1.14 (mai trebuie +0.36 până la 1.5)');
        } else {
            console.log('❌ EROARE: Meciul nu a fost adăugat!');
        }

    } catch (error) {
        console.error('❌ Eroare:', error.message);
        console.error(error.stack);
    }
})();
