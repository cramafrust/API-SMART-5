/**
 * 🧪 TEST TRACKING WORKFLOW
 *
 * Test complet al sistemului de tracking + validare
 */

const NotificationTracker = require('./NOTIFICATION_TRACKER');
const BettingOdds = require('./BETTING_ODDS_SCRAPER');

console.log(`\n🧪 TEST WORKFLOW COMPLET - TRACKING + COTE\n`);
console.log('='.repeat(60));

(async () => {
    try {
        // 1. SIMULARE DATE MECI
        console.log(`\n📋 PASUL 1: Simulare date meci la pauză\n`);

        const matchData = {
            matchId: 'TEST123ABC',
            homeTeam: 'Liverpool',
            awayTeam: 'Chelsea',
            leagueName: 'Premier League',
            country: 'England',
            scor: {
                pauza_gazda: 1,
                pauza_oaspete: 0
            },
            statistici: {
                suturi_pe_poarta: {
                    pauza_gazda: 5,
                    pauza_oaspete: 2
                },
                total_suturi: {
                    pauza_gazda: 8,
                    pauza_oaspete: 4
                },
                cornere: {
                    repriza_1_gazda: 4,
                    repriza_1_oaspete: 2
                },
                cartonase_galbene: {
                    pauza_gazda: 1,
                    pauza_oaspete: 2
                },
                cartonase_rosii: {
                    pauza_gazda: 0,
                    pauza_oaspete: 0
                },
                suturi_salvate: {
                    pauza_gazda: 2,
                    pauza_oaspete: 4
                }
            }
        };

        console.log(`⚽ Meci: ${matchData.homeTeam} vs ${matchData.awayTeam}`);
        console.log(`📊 Scor HT: ${matchData.scor.pauza_gazda}-${matchData.scor.pauza_oaspete}`);

        // 2. PATTERN-URI DETECTATE
        console.log(`\n📋 PASUL 2: Pattern-uri detectate\n`);

        const patterns = [
            {
                name: 'OVER_2_5_GOLURI',
                team: 'gazda',
                teamName: 'Liverpool',
                probability: 78,
                tier: 'A',
                position: 3,
                isEstimate: false,
                stats: {
                    suturiPePtPauza: 5,
                    cornerePauza: 4,
                    suturiPeLanga: 3,
                    adversarSalvariPauza: 4
                }
            },
            {
                name: 'BTTS_GOLURI_AMBELE',
                team: 'meci',
                teamName: 'Meci',
                probability: 72,
                tier: null,
                position: null,
                isEstimate: false,
                stats: {}
            }
        ];

        console.log(`📊 Total pattern-uri: ${patterns.length}`);
        patterns.forEach(p => {
            console.log(`   - ${p.name} (${p.teamName}): ${p.probability}%`);
        });

        // 3. EXTRAGERE COTE
        console.log(`\n📋 PASUL 3: Extragere cote pariuri\n`);

        const odds = await BettingOdds.getOddsForMatch(
            matchData.homeTeam,
            matchData.awayTeam,
            patterns
        );

        if (odds.available) {
            console.log(`✅ Cote extrase cu succes`);
            console.log(`   Superbet: ${odds.superbet ? 'Disponibil' : 'Indisponibil'}`);
            console.log(`   Netbet: ${odds.netbet ? 'Disponibil' : 'Indisponibil'}`);
        }

        // 4. SALVARE ÎN TRACKING
        console.log(`\n📋 PASUL 4: Salvare în tracking\n`);

        const trackingResult = await NotificationTracker.saveNotification(
            matchData,
            patterns,
            odds
        );

        if (trackingResult.success) {
            console.log(`\n✅ TEST REUȘIT!\n`);
            console.log(`📝 ID Notificare: ${trackingResult.notificationId}`);
            console.log(`📊 Pattern-uri salvate: ${trackingResult.patternsCount}`);

            // 5. VERIFICARE STATISTICI
            console.log(`\n📋 PASUL 5: Verificare statistici tracking\n`);

            NotificationTracker.displayTrackingStats();

            // 6. VERIFICARE FIȘIER
            console.log(`\n📋 PASUL 6: Verificare fișier JSON\n`);

            const trackingData = NotificationTracker.loadTrackingData();
            const lastNotification = trackingData.notifications[trackingData.notifications.length - 1];

            console.log(`📄 Ultima notificare salvată:`);
            console.log(`   ID: ${lastNotification.id}`);
            console.log(`   Meci: ${lastNotification.match.homeTeam} vs ${lastNotification.match.awayTeam}`);
            console.log(`   Pattern-uri: ${lastNotification.patterns.length}`);
            console.log(`   Cote Superbet: ${lastNotification.patterns[0].odds?.superbet || 'N/A'}`);
            console.log(`   Cote Netbet: ${lastNotification.patterns[0].odds?.netbet || 'N/A'}`);

            console.log(`\n✅ TOATE TESTELE AU TRECUT!\n`);
            console.log('='.repeat(60));

            console.log(`\n📝 NEXT STEPS:\n`);
            console.log(`1. Rulează sistem live: node API-SMART-5.js full`);
            console.log(`2. Așteaptă notificări (vor fi salvate automat)`);
            console.log(`3. Dimineața următoare: node RESULTS_VALIDATOR.js validate`);
            console.log(`4. Vezi raport: node RESULTS_VALIDATOR.js report`);

        } else {
            console.log(`\n❌ TEST EȘUAT\n`);
            console.log(`Eroare: ${trackingResult.error}`);
        }

    } catch (error) {
        console.error(`\n❌ EROARE ÎN TEST: ${error.message}\n`);
        console.error(error.stack);
        process.exit(1);
    }
})();
