/**
 * INVESTIGARE: Afișează TOATE piețele disponibile pe Superbet
 */

const { execSync } = require('child_process');

async function investigateMarkets() {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 INVESTIGARE PIEȚE SUPERBET');
    console.log('='.repeat(80) + '\n');

    const eventId = '11359110'; // Independiente Petrolero vs Guabira

    try {
        const url = `https://production-superbet-offer-ro.freetls.fastly.net/v3/subscription/ro-RO/events?events=${eventId}`;
        const cmd = `curl -s --max-time 5 "${url}" -H "Accept: text/event-stream" -H "Accept-Language: ro-RO" -H "Origin: https://superbet.ro" --compressed`;

        let output = '';
        try {
            output = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
        } catch (error) {
            if (error.stdout) {
                output = error.stdout.toString();
            } else {
                throw error;
            }
        }

        // Parsare SSE
        const lines = output.split('\n').filter(l => l.startsWith('data:'));
        if (lines.length === 0) {
            console.log('❌ Nu am primit date SSE\n');
            return;
        }

        const data = JSON.parse(lines[0].substring(5).trim());
        if (!Array.isArray(data) || !data[0]) {
            console.log('❌ Format date invalid\n');
            return;
        }

        const event = data[0];

        console.log('📊 STATISTICI CURENTE:');
        if (event.inplay_stats) {
            const s = event.inplay_stats;
            console.log(`   Goluri echipa 1: ${s.home_team_score || 0}`);
            console.log(`   Goluri echipa 2: ${s.away_team_score || 0}`);
            console.log(`   Total goluri: ${(parseInt(s.home_team_score) || 0) + (parseInt(s.away_team_score) || 0)}`);
            console.log(`   Cornere: ${(parseInt(s.home_team_corners) || 0) + (parseInt(s.away_team_corners) || 0)}`);
            console.log(`   Cartonașe: ${(parseInt(s.home_team_yellow_cards) || 0) + (parseInt(s.away_team_yellow_cards) || 0)}\n`);
        }

        console.log('='.repeat(80));
        console.log('📋 TOATE PIEȚELE DISPONIBILE:');
        console.log('='.repeat(80) + '\n');

        if (!event.markets || event.markets.length === 0) {
            console.log('❌ Nu sunt piețe disponibile\n');
            return;
        }

        const activeMarkets = event.markets.filter(m =>
            m.odds && m.odds.some(o => o.price != null)
        );

        console.log(`Total piețe active: ${activeMarkets.length}\n`);

        activeMarkets.forEach((market, index) => {
            console.log(`${index + 1}. ${market.name || 'N/A'}`);

            if (market.odds && market.odds.length > 0) {
                market.odds.forEach(odd => {
                    if (odd.price && odd.metadata) {
                        const name = odd.metadata.name || 'N/A';
                        const info = odd.metadata.info || '';
                        console.log(`   - ${name}${info ? ' (' + info + ')' : ''}: ${odd.price.toFixed(2)}`);
                    }
                });
            }
            console.log('');
        });

        console.log('='.repeat(80));
        console.log('🔍 PIEȚE RELEVANTE PENTRU GOLURI ECHIPE:');
        console.log('='.repeat(80) + '\n');

        const teamGoalMarkets = activeMarkets.filter(m => {
            const n = (m.name || '').toLowerCase();
            return (n.includes('gol') || n.includes('marc')) &&
                   (n.includes('echip') || n.includes('team'));
        });

        if (teamGoalMarkets.length === 0) {
            console.log('❌ Nu am găsit piețe pentru goluri echipe\n');
        } else {
            console.log(`Găsite ${teamGoalMarkets.length} piețe:\n`);

            teamGoalMarkets.forEach((market, index) => {
                console.log(`${index + 1}. "${market.name}"`);

                if (market.odds && market.odds.length > 0) {
                    market.odds.forEach(odd => {
                        if (odd.price && odd.metadata) {
                            const name = odd.metadata.name || 'N/A';
                            const info = odd.metadata.info || '';
                            console.log(`   - ${name}${info ? ' (' + info + ')' : ''}: ${odd.price.toFixed(2)}`);
                        }
                    });
                }
                console.log('');
            });
        }

        console.log('='.repeat(80) + '\n');

    } catch (error) {
        console.error('❌ Eroare:', error.message);
    }
}

investigateMarkets().then(() => {
    console.log('✅ Investigare completă\n');
    process.exit(0);
}).catch(error => {
    console.error('💥 Eroare fatală:', error.message);
    process.exit(1);
});
