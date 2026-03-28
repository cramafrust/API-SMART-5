/**
 * TEST cu pattern-uri realiste care vor găsi cote disponibile
 */

const SuperbetOdds = require('./SUPERBET_ODDS_INTEGRATION');

async function testRealistic() {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 TEST CU PATTERN-URI REALISTE');
    console.log('='.repeat(80) + '\n');

    const homeTeam = 'Independiente Petrolero';
    const awayTeam = 'Guabira';

    // Pattern-uri care vor găsi cote disponibile pe Superbet
    const patterns = [
        {
            name: 'PATTERN_GOL_GENERAL',
            team: 'meci',  // Nu e nici gazda nici oaspete → va căuta "Încă un gol"
            probability: 85
        },
        {
            name: 'PATTERN_SUTURI_GAZDA',
            team: 'gazda',  // Va căuta "Echipa 1 marchează" (dacă e disponibil)
            probability: 78
        },
        {
            name: 'PATTERN_ATACURI',
            team: 'general',  // Va căuta "Încă un gol"
            probability: 82
        }
    ];

    console.log(`📊 Meci: ${homeTeam} vs ${awayTeam}`);
    console.log(`🎯 Pattern-uri: ${patterns.length}\n`);

    patterns.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name} (team: ${p.team}, prob: ${p.probability}%)`);
    });

    console.log('\n🔍 Extragere cote LIVE...\n');

    const result = await SuperbetOdds.getOddsForMatch(homeTeam, awayTeam, patterns);

    if (!result.available) {
        console.log('❌ Cote indisponibile\n');
        return;
    }

    console.log('✅ COTE EXTRASE!\n');
    console.log('='.repeat(80));
    console.log('📊 STATISTICI CURENTE');
    console.log('='.repeat(80));

    if (result.superbet.currentStats) {
        const s = result.superbet.currentStats;
        console.log(`   Goluri: ${s.goals}`);
        console.log(`   Cornere: ${s.corners}`);
        console.log(`   Cartonașe: ${s.cards}\n`);
    }

    console.log('='.repeat(80));
    console.log('💰 COTE RELEVANTE PENTRU PATTERN-URI');
    console.log('='.repeat(80));

    if (result.superbet.relevantOdds) {
        const count = Object.keys(result.superbet.relevantOdds).length;

        if (count === 0) {
            console.log('\n   ⚠️  Nu s-au găsit cote relevante\n');
        } else {
            console.log(`\n   Găsite ${count} cote:\n`);

            Object.entries(result.superbet.relevantOdds).forEach(([key, value], index) => {
                console.log(`   ${index + 1}. [${key}]`);
                console.log(`      ${value.description}`);
                console.log(`      Cotă: ${value.odd.toFixed(2)}`);
                if (value.currentValue !== 'N/A') {
                    console.log(`      Situație actuală: ${value.currentValue}`);
                }
                console.log(`      Tip: ${value.eventType}`);
                console.log('');
            });
        }
    }

    console.log('='.repeat(80) + '\n');
}

testRealistic().then(() => {
    console.log('🏁 Test finalizat\n');
    process.exit(0);
}).catch(error => {
    console.error('❌ EROARE:', error.message);
    console.error(error.stack);
    process.exit(1);
});
