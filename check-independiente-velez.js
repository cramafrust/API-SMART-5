const SuperbetLiveOdds = require('../superbet-analyzer/SUPERBET_LIVE_ODDS');

(async () => {
    console.log('🇦🇷 Verific cote pentru Independiente vs Velez Sarsfield...');
    console.log('');

    try {
        const scraper = new SuperbetLiveOdds();

        // Găsește event ID
        console.log('1️⃣  Căutare event ID pe Superbet...');
        const eventId = await scraper.findEventId('Independiente', 'Velez');

        if (!eventId) {
            console.log('❌ Nu am găsit meciul pe Superbet');
            console.log('   Posibil că meciul nu este disponibil pentru pariuri live');
            console.log('');
            console.log('🔄 Încerc cu nume complete...');
            const eventId2 = await scraper.findEventId('Independiente', 'Velez Sarsfield');

            if (!eventId2) {
                console.log('❌ Nu am găsit meciul nici cu numele complet');
                return;
            }

            console.log('   ✅ Event ID:', eventId2);
            await extractOdds(scraper, eventId2);
        } else {
            console.log('   ✅ Event ID:', eventId);
            console.log('');
            await extractOdds(scraper, eventId);
        }

    } catch (error) {
        console.error('❌ Excepție:', error.message);
        console.error(error.stack);
    }
})();

async function extractOdds(scraper, eventId) {
    // Extrage cotele
    console.log('2️⃣  Extragere cote...');
    const odds = await scraper.getLiveOdds(eventId);

    if (odds && odds.odds) {
        console.log('✅ COTE GĂSITE:');
        console.log('');
        console.log('📊 Total Goluri:');
        console.log('   peste 0.5 (UN GOL):', odds.odds.peste_0_5 || 'N/A');
        console.log('   peste 1.5:', odds.odds.peste_1_5 || 'N/A');
        console.log('   peste 2.5:', odds.odds.peste_2_5 || 'N/A');
        console.log('');

        if (odds.odds.peste_0_5) {
            const cota = parseFloat(odds.odds.peste_0_5);
            console.log('🎯 MONITORIZARE:');
            console.log('   Cotă actuală:', cota);

            if (cota >= 1.5) {
                console.log('   ✅ COTA >= 1.5 - Vei primi EMAIL AUTOMAT!');
            } else {
                const diferenta = (1.5 - cota).toFixed(2);
                console.log('   ⏳ Mai trebuie +' + diferenta + ' până la 1.5');
            }

            if (cota >= 2.0) {
                console.log('   ✅ COTA >= 2.0 - Vei primi EMAIL AUTOMAT!');
            } else {
                const diferenta = (2.0 - cota).toFixed(2);
                console.log('   ⏳ Mai trebuie +' + diferenta + ' până la 2.0');
            }
        }

        console.log('');
        console.log('🕐 Verificat la:', new Date().toLocaleTimeString('ro-RO'));
        console.log('⏰ Următoarea verificare automată în max 2 minute');
    } else {
        console.log('❌ Nu am putut extrage cotele');
    }
}
