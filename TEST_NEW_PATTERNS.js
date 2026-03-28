#!/usr/bin/env node
/**
 * TEST_NEW_PATTERNS.js
 *
 * Testează pattern-uri noi pe datele istorice
 * Verifică probabilitatea de reușită pe sezoanele Premier League
 */

const fs = require('fs');
const path = require('path');

const SEASONS_DIR = path.join(__dirname, 'data', 'seasons');

// ═══════════════════════════════════════════════
// PATTERN DEFINITIONS - noi, de testat
// ═══════════════════════════════════════════════

const NEW_PATTERNS = {

    // Pattern 14: Conduce norocos — adversarul domină dar nu a marcat
    'P14_CONDUCE_NOROCOS': {
        description: 'Echipa conduce dar adversarul are ≥4 șuturi pe poartă fără gol',
        prediction: 'Adversarul va marca în R2',
        checkTeam: (stats, teamSide, oppSide) => {
            const teamGoals = stats.scor[`pauza_${teamSide}`];
            const oppGoals = stats.scor[`pauza_${oppSide}`];
            const oppShotsOT = getStat(stats, 'suturi_pe_poarta', `pauza_${oppSide}`);
            return teamGoals >= 1 && oppGoals === 0 && oppShotsOT >= 4;
        },
        verify: (stats, teamSide, oppSide) => {
            // Adversarul a marcat în R2?
            const oppGoalsHT = stats.scor[`pauza_${oppSide}`];
            const oppGoalsFT = stats.scor[`final_${oppSide}`];
            return oppGoalsFT > oppGoalsHT;
        }
    },

    // Pattern 15: Meci agresiv → cartonaș roșu
    'P15_MECI_AGRESIV_ROSU': {
        description: 'Total faulturi ≥20 + cartonașe galbene ≥3 la pauză',
        prediction: 'Cel puțin un cartonaș roșu în R2',
        checkTeam: (stats) => {
            const totalFouls = getStat(stats, 'faulturi', 'pauza_gazda') + getStat(stats, 'faulturi', 'pauza_oaspete');
            const totalYellows = getStat(stats, 'cartonase_galbene', 'pauza_gazda') + getStat(stats, 'cartonase_galbene', 'pauza_oaspete');
            return totalFouls >= 20 && totalYellows >= 3;
        },
        verify: (stats) => {
            const redsR2Home = getStat(stats, 'cartonase_rosii', 'repriza_2_gazda');
            const redsR2Away = getStat(stats, 'cartonase_rosii', 'repriza_2_oaspete');
            return (redsR2Home + redsR2Away) >= 1;
        },
        matchLevel: true
    },

    // Pattern 16: Ofsaiduri multe = atacă dar greșit
    'P16_OFSAIDURI_PRESIUNE': {
        description: 'Echipa: 0 goluri, ≥3 ofsaiduri, ≥2 șuturi pe poartă la pauză',
        prediction: 'Echipa va marca în R2',
        checkTeam: (stats, teamSide, oppSide) => {
            const goals = stats.scor[`pauza_${teamSide}`];
            const offsides = getStat(stats, 'ofsaiduri', `pauza_${teamSide}`);
            const shotsOT = getStat(stats, 'suturi_pe_poarta', `pauza_${teamSide}`);
            return goals === 0 && offsides >= 3 && shotsOT >= 2;
        },
        verify: (stats, teamSide) => {
            const goalsHT = stats.scor[`pauza_${teamSide}`];
            const goalsFT = stats.scor[`final_${teamSide}`];
            return goalsFT > goalsHT;
        }
    },

    // Pattern 17: Salvări gardian adversar ≥4 → gol inevitabil
    'P17_SALVARI_GARDIAN': {
        description: 'Echipa: 0 goluri, gardianul adversar ≥4 salvări la pauză',
        prediction: 'Echipa va marca în R2',
        checkTeam: (stats, teamSide, oppSide) => {
            const goals = stats.scor[`pauza_${teamSide}`];
            const oppSaves = getStat(stats, 'suturi_salvate', `pauza_${oppSide}`) ||
                             getStat(stats, 'salvari_portar', `pauza_${oppSide}`);
            return goals === 0 && oppSaves >= 4;
        },
        verify: (stats, teamSide) => {
            const goalsHT = stats.scor[`pauza_${teamSide}`];
            const goalsFT = stats.scor[`final_${teamSide}`];
            return goalsFT > goalsHT;
        }
    },

    // Pattern 18: Dominare totală — posesie + cornere
    'P18_DOMINARE_TOTALA': {
        description: 'Echipa: 0 goluri, posesie ≥65%, ≥4 cornere, adversar ≤1 corner',
        prediction: 'Echipa va marca în R2',
        checkTeam: (stats, teamSide, oppSide) => {
            const goals = stats.scor[`pauza_${teamSide}`];
            const poss = getStat(stats, 'posesie', `pauza_${teamSide}`);
            const corners = getStat(stats, 'cornere', `pauza_${teamSide}`) ||
                            getStat(stats, 'cornere', `repriza_1_${teamSide}`);
            const oppCorners = getStat(stats, 'cornere', `pauza_${oppSide}`) ||
                               getStat(stats, 'cornere', `repriza_1_${oppSide}`);
            return goals === 0 && poss >= 65 && corners >= 4 && oppCorners <= 1;
        },
        verify: (stats, teamSide) => {
            const goalsHT = stats.scor[`pauza_${teamSide}`];
            const goalsFT = stats.scor[`final_${teamSide}`];
            return goalsFT > goalsHT;
        }
    },

    // Pattern 19: Meci deschis — egal + multe șuturi
    'P19_MECI_DESCHIS': {
        description: 'Scor egal ≥1-1 + total șuturi pe poartă ≥6 (ambele echipe)',
        prediction: 'Cel puțin 1 gol în R2 (over 2.5 total)',
        checkTeam: (stats) => {
            const homeGoals = stats.scor.pauza_gazda;
            const awayGoals = stats.scor.pauza_oaspete;
            const totalSOT = getStat(stats, 'suturi_pe_poarta', 'pauza_gazda') +
                             getStat(stats, 'suturi_pe_poarta', 'pauza_oaspete');
            return homeGoals >= 1 && awayGoals >= 1 && homeGoals === awayGoals && totalSOT >= 6;
        },
        verify: (stats) => {
            const goalsHT = stats.scor.pauza_gazda + stats.scor.pauza_oaspete;
            const goalsFT = stats.scor.final_gazda + stats.scor.final_oaspete;
            return goalsFT > goalsHT;
        },
        matchLevel: true
    },

    // Pattern 20: Cornere disproporționate
    'P20_CORNERE_DISPROPORTIONATE': {
        description: 'Echipa ≥5 cornere, adversar ≤1 corner la pauză',
        prediction: 'Over 8.5 cornere total meci',
        checkTeam: (stats, teamSide, oppSide) => {
            const corners = getStat(stats, 'cornere', `pauza_${teamSide}`) ||
                            getStat(stats, 'cornere', `repriza_1_${teamSide}`);
            const oppCorners = getStat(stats, 'cornere', `pauza_${oppSide}`) ||
                               getStat(stats, 'cornere', `repriza_1_${oppSide}`);
            return corners >= 5 && oppCorners <= 1;
        },
        verify: (stats) => {
            const totalCorners = (getStat(stats, 'cornere', 'total_gazda') || 0) +
                                 (getStat(stats, 'cornere', 'total_oaspete') || 0);
            return totalCorners >= 9;
        }
    },

    // Pattern 21: Pierde dar domină statisticile
    'P21_PIERDE_DAR_DOMINA': {
        description: 'Echipa: 0 goluri, adversar ≥1 gol, echipa ≥3 șuturi pe poartă, adversar ≤1',
        prediction: 'Echipa va marca în R2 (comeback)',
        checkTeam: (stats, teamSide, oppSide) => {
            const teamGoals = stats.scor[`pauza_${teamSide}`];
            const oppGoals = stats.scor[`pauza_${oppSide}`];
            const teamSOT = getStat(stats, 'suturi_pe_poarta', `pauza_${teamSide}`);
            const oppSOT = getStat(stats, 'suturi_pe_poarta', `pauza_${oppSide}`);
            return teamGoals === 0 && oppGoals >= 1 && teamSOT >= 3 && oppSOT <= 1;
        },
        verify: (stats, teamSide) => {
            const goalsHT = stats.scor[`pauza_${teamSide}`];
            const goalsFT = stats.scor[`final_${teamSide}`];
            return goalsFT > goalsHT;
        }
    }
};

// ═══════════════════════════════════════════════
// HELPER
// ═══════════════════════════════════════════════

function getStat(match, statName, key) {
    if (!match.statistici || !match.statistici[statName]) return 0;
    const val = match.statistici[statName][key];
    return (val !== null && val !== undefined) ? Number(val) : 0;
}

// ═══════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════

function runTest(leaguePattern) {
    // Find season files
    const files = fs.readdirSync(SEASONS_DIR)
        .filter(f => f.includes(leaguePattern) && f.endsWith('.json') &&
                !f.includes('BACKUP') && !f.includes('OLD_FORMAT') && !f.includes('pre-'))
        .sort();

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  TEST PATTERN-URI NOI — ${leaguePattern}`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`  Sezoane: ${files.length}`);

    // Load all matches
    let allMatches = [];
    for (const f of files) {
        const data = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8'));
        const matches = data.meciuri || [];
        const season = f.replace('complete_FULL_SEASON_', '').replace('.json', '');
        matches.forEach(m => m._season = season);
        allMatches.push(...matches);
        console.log(`  ${season}: ${matches.length} meciuri`);
    }
    console.log(`  TOTAL: ${allMatches.length} meciuri\n`);

    // Filter matches with valid HT stats
    const validMatches = allMatches.filter(m =>
        m.scor && m.statistici &&
        m.scor.pauza_gazda !== null && m.scor.pauza_gazda !== undefined &&
        m.scor.final_gazda !== null && m.scor.final_gazda !== undefined
    );
    console.log(`  Meciuri cu date valide: ${validMatches.length}\n`);

    // Test each pattern
    const results = {};
    for (const [name, pattern] of Object.entries(NEW_PATTERNS)) {
        const triggered = [];
        const won = [];
        const lost = [];
        const examples = [];

        for (const match of validMatches) {
            const sides = pattern.matchLevel
                ? [['gazda', 'oaspete']] // check once
                : [['gazda', 'oaspete'], ['oaspete', 'gazda']]; // check both

            for (const [teamSide, oppSide] of sides) {
                if (pattern.checkTeam(match, teamSide, oppSide)) {
                    triggered.push(match);
                    const success = pattern.verify(match, teamSide, oppSide);
                    if (success) {
                        won.push(match);
                    } else {
                        lost.push(match);
                    }
                    // Save first few examples
                    if (examples.length < 3) {
                        examples.push({
                            match: `${match.echipa_gazda} vs ${match.echipa_oaspete}`,
                            score: `HT ${match.scor.pauza_gazda}-${match.scor.pauza_oaspete} → FT ${match.scor.final_gazda}-${match.scor.final_oaspete}`,
                            side: teamSide,
                            result: success ? 'WON' : 'LOST',
                            season: match._season
                        });
                    }
                }
            }
        }

        const rate = triggered.length > 0 ? ((won.length / triggered.length) * 100).toFixed(1) : 0;
        results[name] = { triggered: triggered.length, won: won.length, lost: lost.length, rate, examples };
    }

    // Print results
    console.log(`${'─'.repeat(70)}`);
    console.log(`  ${'Pattern'.padEnd(32)} ${'Trig'.padStart(5)} ${'WON'.padStart(5)} ${'LOST'.padStart(5)} ${'Rate'.padStart(7)}`);
    console.log(`${'─'.repeat(70)}`);

    const sorted = Object.entries(results).sort((a, b) => b[1].rate - a[1].rate);
    for (const [name, r] of sorted) {
        const rateStr = r.triggered > 0 ? `${r.rate}%` : 'N/A';
        const bar = r.triggered > 0 ? '█'.repeat(Math.round(r.rate / 5)) : '';
        console.log(`  ${name.padEnd(32)} ${String(r.triggered).padStart(5)} ${String(r.won).padStart(5)} ${String(r.lost).padStart(5)} ${rateStr.padStart(7)}  ${bar}`);
    }
    console.log(`${'─'.repeat(70)}\n`);

    // Print details for each pattern
    for (const [name, r] of sorted) {
        const pat = NEW_PATTERNS[name];
        console.log(`\n  📊 ${name}`);
        console.log(`     ${pat.description}`);
        console.log(`     Predicție: ${pat.prediction}`);
        console.log(`     Rezultat: ${r.won}/${r.triggered} = ${r.rate}%`);
        if (r.examples.length > 0) {
            console.log(`     Exemple:`);
            r.examples.forEach(e => {
                console.log(`       ${e.result === 'WON' ? '✅' : '❌'} ${e.match} (${e.score}) [${e.season}]`);
            });
        }
    }

    // Per-season breakdown for top patterns
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  BREAKDOWN PER SEZON (pattern-uri cu rate ≥ 50%)`);
    console.log(`${'═'.repeat(70)}`);

    for (const [name, r] of sorted) {
        if (r.rate < 50 || r.triggered < 5) continue;

        console.log(`\n  ${name} (${r.rate}% overall):`);
        // Group by season
        const bySeason = {};
        for (const match of validMatches) {
            const sides = NEW_PATTERNS[name].matchLevel
                ? [['gazda', 'oaspete']]
                : [['gazda', 'oaspete'], ['oaspete', 'gazda']];

            for (const [teamSide, oppSide] of sides) {
                if (NEW_PATTERNS[name].checkTeam(match, teamSide, oppSide)) {
                    const season = match._season;
                    if (!bySeason[season]) bySeason[season] = { won: 0, lost: 0 };
                    if (NEW_PATTERNS[name].verify(match, teamSide, oppSide)) {
                        bySeason[season].won++;
                    } else {
                        bySeason[season].lost++;
                    }
                }
            }
        }

        for (const [season, data] of Object.entries(bySeason).sort()) {
            const total = data.won + data.lost;
            const sRate = ((data.won / total) * 100).toFixed(1);
            console.log(`    ${season}: ${data.won}/${total} = ${sRate}%`);
        }
    }

    console.log(`\n${'═'.repeat(70)}\n`);
}

// Run
const league = process.argv[2] || 'PremierLeague';
runTest(league);
