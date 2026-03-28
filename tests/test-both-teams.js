/**
 * TEST: Verifică cotele pentru AMBELE echipe
 */

const SuperbetOdds = require('./SUPERBET_ODDS_INTEGRATION');

async function testBothTeams() {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 TEST COTE PENTRU AMBELE ECHIPE');
    console.log('='.repeat(80) + '\n');

    const homeTeam = 'Independiente Petrolero';
    const awayTeam = 'Guabira';

    const patterns = [
        {
            name: 'PATTERN_GAZDA_SUTURI',
            team: 'gazda',
            probability: 85
        },
        {
            name: 'PATTERN_OASPETE_ATACURI',
            team: 'oaspete',
            probability: 78
        },
        {
            name: 'PATTERN_GOL_MECI',
            team: 'meci',
            probability: 90
        }
    ];

    console.log(`📊 Meci: ${homeTeam} vs ${awayTeam}\n`);

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
        console.log(`   Goluri total: ${s.goals}`);
        console.log(`   Goluri ${homeTeam}: ${s.homeGoals}`);
        console.log(`   Goluri ${awayTeam}: ${s.awayGoals}`);
        console.log(`   Cornere: ${s.corners}`);
        console.log(`   Cartonașe: ${s.cards}\n`);
    }

    console.log('='.repeat(80));
    console.log('💰 COTE PENTRU FIECARE PATTERN');
    console.log('='.repeat(80) + '\n');

    if (result.superbet.relevantOdds) {
        Object.entries(result.superbet.relevantOdds).forEach(([key, value]) => {
            console.log(`📌 [${key}]`);
            console.log(`   ${value.description}`);
            console.log(`   Cotă: ${value.odd.toFixed(2)}`);
            if (value.currentValue !== 'N/A') {
                console.log(`   Situație: ${value.currentValue} acum`);
            }
            console.log(`   Tip: ${value.eventType}\n`);
        });
    }

    console.log('='.repeat(80) + '\n');
}

testBothTeams().then(() => {
    console.log('🏁 Test finalizat\n');
    process.exit(0);
}).catch(error => {
    console.error('❌ EROARE:', error.message);
    process.exit(1);
});
