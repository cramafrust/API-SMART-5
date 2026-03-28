/**
 * TEST: Verifică ce date returnează FlashScore API pentru round/etapă
 */

const { fetchMatchDetails } = require('./flashscore-api');

async function test() {
    // Test cu un meci real din Premier League
    const matchId = 'AFilY12h'; // Un meci random din Premier League

    console.log(`🔍 Testare FlashScore API pentru meci: ${matchId}\n`);

    try {
        const data = await fetchMatchDetails(matchId);

        console.log('📦 Date primite de la FlashScore API:\n');
        console.log('CORE data keys:', Object.keys(data.core || {}).join(', '));

        // Caută câmpuri care ar putea conține round/stage
        const coreData = data.core || {};
        const possibleRoundFields = Object.entries(coreData).filter(([key, value]) => {
            return typeof value === 'string' && (
                value.includes('Round') ||
                value.includes('round') ||
                value.includes('Stage') ||
                value.includes('Etapa') ||
                /^\d+$/.test(value) // doar cifre
            );
        });

        console.log('\n🎯 Câmpuri posibile pentru ROUND/ETAPA:');
        possibleRoundFields.forEach(([key, value]) => {
            console.log(`   ${key}: "${value}"`);
        });

        // Afișează TOATE câmpurile core pentru analiză
        console.log('\n📋 TOATE câmpurile CORE:');
        Object.entries(coreData).slice(0, 30).forEach(([key, value]) => {
            const displayValue = typeof value === 'string' ? value.substring(0, 50) : value;
            console.log(`   ${key}: ${JSON.stringify(displayValue)}`);
        });

    } catch (error) {
        console.error('❌ Eroare:', error.message);
    }
}

test();
