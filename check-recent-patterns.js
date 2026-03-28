const fs = require('fs');
const ProcenteLoader = require('./PROCENTE_LOADER');
const { getTeamPosition } = require('./standings-scraper-puppeteer');

// Lista meciuri recente (ultimele 15-20 min)
const recentMatches = [
    'stats-Cfb5H9Sg-HT.json',  // Monaco vs Rennes
    'stats-W6sEKwFb-HT.json',  // Cordoba vs Valladolid
    'stats-runNPizJ-HT.json',  // Elche vs Barcelona
    'stats-0Y3xPZCO-HT.json',  // Dundee Utd vs Hearts
    'stats-MgJFt8Ad-HT.json',  // Sparta Rotterdam vs Groningen
    'stats-bTitnz7m-HT.json'   // Liverpool vs Newcastle
];

const procenteLoader = new ProcenteLoader();

function detectPatterns(stats) {
    const patterns = [];

    const homeShots = stats.statistici.suturi_pe_poarta.pauza_gazda;
    const awayShots = stats.statistici.suturi_pe_poarta.pauza_oaspete;
    const homeTotalShots = stats.statistici.total_suturi.pauza_gazda;
    const awayTotalShots = stats.statistici.total_suturi.pauza_oaspete;
    const homeCorners = stats.statistici.cornere.repriza_1_gazda;
    const awayCorners = stats.statistici.cornere.repriza_1_oaspete;
    const homeGoals = stats.scor.pauza_gazda;
    const awayGoals = stats.scor.pauza_oaspete;

    // PATTERN 1.x - Șuturi pe poartă fără gol (GAZDA)
    if (homeGoals === 0 && homeShots >= 3) {
        patterns.push({
            name: `PATTERN_1.${ homeShots - 3 }`,
            team: 'gazda',
            value: homeShots
        });
    }

    // PATTERN 1.x - Șuturi pe poartă fără gol (OASPETE)
    if (awayGoals === 0 && awayShots >= 3) {
        patterns.push({
            name: `PATTERN_1.${ awayShots - 3 }`,
            team: 'oaspete',
            value: awayShots
        });
    }

    // PATTERN 2.x - Total suturi fără gol (GAZDA)
    if (homeGoals === 0 && homeTotalShots >= 6) {
        patterns.push({
            name: `PATTERN_2.${ homeTotalShots - 5 }`,
            team: 'gazda',
            value: homeTotalShots
        });
    }

    // PATTERN 2.x - Total suturi fără gol (OASPETE)
    if (awayGoals === 0 && awayTotalShots >= 6) {
        patterns.push({
            name: `PATTERN_2.${ awayTotalShots - 5 }`,
            team: 'oaspete',
            value: awayTotalShots
        });
    }

    // PATTERN 4.x - Cornere fără gol (GAZDA)
    if (homeGoals === 0 && homeCorners >= 5) {
        patterns.push({
            name: `PATTERN_4.${ homeCorners }`,
            team: 'gazda',
            value: homeCorners
        });
    }

    // PATTERN 4.x - Cornere fără gol (OASPETE)
    if (awayGoals === 0 && awayCorners >= 5) {
        patterns.push({
            name: `PATTERN_4.${ awayCorners }`,
            team: 'oaspete',
            value: awayCorners
        });
    }

    // PATTERN 5.x - Combinație șuturi pe poartă + cornere (GAZDA)
    if (homeGoals === 0) {
        const homeCombo = homeShots + homeCorners;
        if (homeCombo >= 5) {
            patterns.push({
                name: `PATTERN_5.${ homeCombo }`,
                team: 'gazda',
                value: homeCombo
            });
        }
    }

    // PATTERN 5.x - Combinație șuturi pe poartă + cornere (OASPETE)
    if (awayGoals === 0) {
        const awayCombo = awayShots + awayCorners;
        if (awayCombo >= 5) {
            patterns.push({
                name: `PATTERN_5.${ awayCombo }`,
                team: 'oaspete',
                value: awayCombo
            });
        }
    }

    return patterns;
}

async function checkRecentMatches() {
    console.log('🔍 VERIFICARE PATTERN-URI - MECIURI RECENTE (15-20 min)\n');
    console.log('='.repeat(70));

    for (const file of recentMatches) {
        try {
            const stats = JSON.parse(fs.readFileSync(file, 'utf8'));
            const patterns = detectPatterns(stats);

            console.log(`\n⚽ ${ stats.echipa_gazda.nume } vs ${ stats.echipa_oaspete.nume }`);
            console.log(`   Liga: ${ stats.liga }`);
            console.log(`   Scor HT: ${ stats.scor.pauza_gazda }-${ stats.scor.pauza_oaspete }`);
            console.log(`   Match ID: ${ stats.id_meci }`);

            if (patterns.length === 0) {
                console.log('   ⚪ Niciun pattern detectat');
                continue;
            }

            console.log(`\n   📊 PATTERN-URI DETECTATE: ${ patterns.length }`);

            for (const pattern of patterns) {
                // Determină tier și poziție
                const teamName = pattern.team === 'gazda' ? stats.echipa_gazda.nume : stats.echipa_oaspete.nume;

                let tier = 'MID';
                let position = null;

                try {
                    const pos = await getTeamPosition(teamName, stats.liga);
                    if (pos && pos.position && pos.totalTeams) {
                        position = pos.position;
                        const totalTeams = pos.totalTeams;

                        if (position <= 3) tier = 'TOP';
                        else if (position >= totalTeams - 2) tier = 'BOTTOM';
                        else if (position <= Math.ceil(totalTeams * 0.3)) tier = 'TOP_4-5';
                        else if (position <= Math.ceil(totalTeams * 0.5)) tier = 'MID_6-10';
                        else tier = 'MID_11-15';
                    }
                } catch (e) {
                    // Silent fail - folosim tier default
                }

                // Obține probabilitate
                const prob = procenteLoader.getPatternProbabilityWithFallback(
                    stats.liga,
                    tier,
                    pattern.name
                );

                const teamLabel = pattern.team === 'gazda' ? '🏠' : '✈️';
                const probText = prob ? `${ prob.procent }%` : 'N/A';
                const probColor = prob && prob.procent >= 70 ? '✅' : '⚪';

                console.log(`   ${ probColor } ${ teamLabel } ${ pattern.name } (${ teamName }): ${ probText }`);
                if (tier && position) {
                    console.log(`      Tier: ${ tier } | Poziție: ${ position }`);
                }
            }

        } catch (error) {
            console.error(`\n❌ Eroare procesare ${ file }: ${ error.message }`);
        }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ VERIFICARE COMPLETĂ!\n');
}

checkRecentMatches().catch(console.error);
