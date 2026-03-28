/**
 * TEST INTEGRARE SUPERBET LIVE ODDS
 *
 * Testează extragerea cotelor LIVE pentru un meci
 */

const SuperbetOdds = require('./SUPERBET_ODDS_INTEGRATION');

async function testIntegration() {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 TEST INTEGRARE SUPERBET LIVE ODDS');
    console.log('='.repeat(80) + '\n');

    // Test cu un meci LIVE (Independiente Petrolero vs Guabira)
    const homeTeam = 'Independiente Petrolero';
    const awayTeam = 'Guabira';

    // Simulare pattern-uri detectate
    const patterns = [
        {
            name: 'PATTERN_5.5',
            team: 'gazda',
            probability: 85
        },
        {
            name: 'PATTERN_CORNERS',
            team: 'meci',
            probability: 78
        }
    ];

    console.log(`📊 Meci test: ${homeTeam} vs ${awayTeam}`);
    console.log(`🎯 Pattern-uri simulate: ${patterns.length}\n`);

    try {
        console.log('🔍 Extragere cote LIVE...\n');

        const result = await SuperbetOdds.getOddsForMatch(homeTeam, awayTeam, patterns);

        if (!result.available) {
            console.log('❌ Cote indisponibile\n');
            console.log('   Motive posibile:');
            console.log('   - Meciul nu este LIVE pe Superbet');
            console.log('   - Cotele sunt suspendate');
            console.log('   - Eroare API\n');
            return;
        }

        console.log('✅ COTE EXTRASE CU SUCCES!\n');
        console.log('='.repeat(80));
        console.log('📊 STATISTICI CURENTE');
        console.log('='.repeat(80));

        if (result.superbet && result.superbet.currentStats) {
            const stats = result.superbet.currentStats;
            console.log(`   Goluri: ${stats.goals}`);
            console.log(`   Cornere: ${stats.corners}`);
            console.log(`   Cartonașe: ${stats.cards}\n`);
        }

        console.log('='.repeat(80));
        console.log('💰 COTE RELEVANTE PENTRU PATTERN-URI');
        console.log('='.repeat(80));

        if (result.superbet && result.superbet.relevantOdds) {
            const relevantOdds = result.superbet.relevantOdds;
            const count = Object.keys(relevantOdds).length;

            if (count === 0) {
                console.log('\n   ⚠️  Nu s-au găsit cote relevante pentru pattern-urile detectate\n');
            } else {
                console.log(`\n   Găsite ${count} cote relevante:\n`);

                Object.entries(relevantOdds).forEach(([key, value], index) => {
                    console.log(`   ${index + 1}. ${value.description}`);
                    console.log(`      Cotă: ${value.odd.toFixed(2)}`);
                    if (value.currentValue !== 'N/A') {
                        console.log(`      Situație actuală: ${value.currentValue}`);
                    }
                    console.log('');
                });
            }
        }

        console.log('='.repeat(80));
        console.log('🔗 DETALII TEHNICE');
        console.log('='.repeat(80));

        if (result.superbet) {
            console.log(`   Event ID: ${result.superbet.eventId || 'N/A'}`);
            console.log(`   Sursă: Superbet LIVE API (SSE)`);

            if (result.superbet.allOdds) {
                const allOddsCount = Object.keys(result.superbet.allOdds).length;
                console.log(`   Total cote disponibile: ${allOddsCount}`);
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('✅ TEST COMPLET!');
        console.log('='.repeat(80) + '\n');

        // Afișează exemplu de integrare în email
        console.log('📧 EXEMPLU FORMATARE EMAIL:\n');
        console.log('---');

        if (result.superbet && result.superbet.relevantOdds) {
            Object.entries(result.superbet.relevantOdds).forEach(([key, value]) => {
                console.log(`💰 ${value.description}`);
                console.log(`   Cotă: ${value.odd.toFixed(2)}`);
                if (value.currentValue !== 'N/A') {
                    console.log(`   (Situație actuală: ${value.currentValue})`);
                }
                console.log('');
            });

            if (result.superbet.currentStats) {
                const stats = result.superbet.currentStats;
                console.log(`📊 Statistici meci: ${stats.goals} gol${stats.goals !== 1 ? 'uri' : ''}, ${stats.corners} cornere, ${stats.cards} cartonaș${stats.cards !== 1 ? 'e' : ''}`);
            }
        }

        console.log('---\n');

    } catch (error) {
        console.error('\n❌ EROARE LA TEST:', error.message);
        console.error('\nStack trace:');
        console.error(error.stack);
        console.log('\n');
    }
}

// Run test
testIntegration().then(() => {
    console.log('🏁 Test finalizat\n');
    process.exit(0);
}).catch(error => {
    console.error('\n💥 EROARE FATALĂ:', error.message);
    process.exit(1);
});
