/**
 * DEBUG: Afișează TOATE cotele disponibile pentru un meci
 */

const SuperbetOdds = require('./SUPERBET_ODDS_INTEGRATION');

async function debugOdds() {
    const homeTeam = 'Independiente Petrolero';
    const awayTeam = 'Guabira';

    // Pattern dummy pentru a trece prin sistem
    const patterns = [{ name: 'DEBUG', team: 'meci' }];

    console.log(`\n🔍 Extragere TOATE cotele disponibile pentru: ${homeTeam} vs ${awayTeam}\n`);

    const result = await SuperbetOdds.getOddsForMatch(homeTeam, awayTeam, patterns);

    if (!result.available) {
        console.log('❌ Cote indisponibile\n');
        return;
    }

    console.log('📊 STATISTICI CURENTE:');
    if (result.superbet.currentStats) {
        const s = result.superbet.currentStats;
        console.log(`   Goluri: ${s.goals}`);
        console.log(`   Cornere: ${s.corners}`);
        console.log(`   Cartonașe: ${s.cards}\n`);
    }

    console.log('💰 TOATE COTELE DISPONIBILE (allOdds):');
    if (result.superbet.allOdds) {
        const odds = result.superbet.allOdds;
        Object.entries(odds).forEach(([key, value]) => {
            console.log(`   ${key}: ${value.toFixed(2)}`);
        });
    }

    console.log('\n');
}

debugOdds().then(() => {
    console.log('✅ Debug complet\n');
    process.exit(0);
}).catch(error => {
    console.error('❌ Eroare:', error.message);
    process.exit(1);
});
