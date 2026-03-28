const SuperbetLiveOdds = require('../superbet-analyzer/SUPERBET_LIVE_ODDS');

(async () => {
    console.log('🇦🇷 Verific cota pentru VELEZ să marcheze...');
    console.log('');

    try {
        const scraper = new SuperbetLiveOdds();

        // Găsește event ID
        console.log('1️⃣  Căutare event ID pe Superbet...');
        const eventId = await scraper.findEventId('Independiente', 'Velez');

        if (!eventId) {
            console.log('❌ Nu am găsit meciul pe Superbet');
            return;
        }

        console.log('   ✅ Event ID:', eventId);
        console.log('');

        // Extrage TOATE cotele (nu doar Total Goluri)
        console.log('2️⃣  Extragere cote complete...');
        const oddsData = await scraper.getLiveOdds(eventId);

        if (oddsData && oddsData.odds) {
            console.log('✅ COTE COMPLETE:');
            console.log('');
            console.log('📊 RAW ODDS OBJECT:');
            console.log(JSON.stringify(oddsData.odds, null, 2));
            console.log('');

            // Caută specific cota pentru "Velez to score" / "Away team to score"
            console.log('🎯 COTE SPECIFICE PENTRU VELEZ:');

            if (oddsData.odds.away_to_score) {
                console.log('   ✅ Velez să marcheze (away to score):', oddsData.odds.away_to_score);
            } else {
                console.log('   ⚠️  Cotă "away to score" nu este disponibilă');
            }

            if (oddsData.odds.velez_to_score) {
                console.log('   ✅ Velez să marcheze:', oddsData.odds.velez_to_score);
            }

            if (oddsData.odds.both_teams_to_score) {
                console.log('   📊 Ambele echipe marchează:', oddsData.odds.both_teams_to_score);
            }

            console.log('');
            console.log('📋 ALTE COTE DISPONIBILE:');
            Object.keys(oddsData.odds).forEach(key => {
                if (key.includes('away') || key.includes('velez') || key.includes('score')) {
                    console.log('   -', key + ':', oddsData.odds[key]);
                }
            });

            console.log('');
            console.log('🕐 Verificat la:', new Date().toLocaleTimeString('ro-RO'));
        } else {
            console.log('❌ Nu am putut extrage cotele');
        }

    } catch (error) {
        console.error('❌ Excepție:', error.message);
        console.error(error.stack);
    }
})();
