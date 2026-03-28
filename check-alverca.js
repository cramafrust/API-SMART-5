const SuperbetLiveOdds = require('../superbet-analyzer/SUPERBET_LIVE_ODDS');

(async () => {
    console.log('🔍 Verific cote pentru Alverca vs Estrela...');
    console.log('');

    try {
        const scraper = new SuperbetLiveOdds();

        // Găsește event ID
        console.log('1️⃣  Căutare event ID...');
        const eventId = await scraper.findEventId('Alverca', 'Estrela');
        console.log('   Event ID:', eventId);
        console.log('');

        if (!eventId) {
            console.log('❌ Nu am găsit meciul pe Superbet');
            console.log('   Posibil că meciul nu este disponibil pentru pariuri live');
            return;
        }

        // Extrage cotele
        console.log('2️⃣  Extragere cote...');
        const odds = await scraper.getLiveOdds(eventId);

        if (odds) {
            console.log('✅ COTE GĂSITE:');
            console.log('');
            console.log('RAW ODDS OBJECT:');
            console.log(JSON.stringify(odds, null, 2));
            console.log('');
            console.log('📊 Total Goluri peste 1.5:');
            console.log('   Cotă actuală:', odds.odd_1_50 || 'N/A');
            console.log('');
            console.log('📊 Total Goluri peste 2.0:');
            console.log('   Cotă actuală:', odds.odd_2_00 || 'N/A');
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
