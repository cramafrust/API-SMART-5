/**
 * DAILY MATCHES SCRIPT
 *
 * Rulează automat în fiecare zi la 08:00
 * Generează lista cu toate meciurile programate pentru ziua curentă
 * din TOP 30 ligi + competiții europene
 *
 * IMPORTANT: Include și meciuri de mâine dimineață (00:00-07:59) pentru
 * a prinde meciurile din Brazilia/Argentina care se joacă după miezul nopții
 * (ora locală) dar cad în ziua următoare (ora României) din cauza fusului orar.
 */

const fs = require('fs');
const path = require('path');
const { fetchMainFeed } = require('./flashscore-api');
const { isTopLeague } = require('./TOP_LEAGUES');

/**
 * 🇷🇴 ECHIPE PLAYOFF vs PLAYOUT - România Superliga 2025-2026
 *
 * FlashScore API nu diferențiază corect Championship Group (playoff) de
 * Relegation Group (playout). Uneori pune meciuri playoff sub "Relegation Group"
 * sau le omite complet din feed. Fix: clasificăm pe baza echipelor.
 *
 * Championship Group (top 6): U. Cluj, CFR Cluj, Dinamo, Rapid, FC Arges, Univ. Craiova
 * Relegation Group (bottom 10): FCSB, UTA, Hermannstadt, Botosani, Slobozia, Otelul, Csikszereda, Farul, Petrolul, Metaloglobus
 */
const ROMANIA_PLAYOFF_TEAMS = [
    'U. Cluj', 'CFR Cluj', 'Dinamo Bucuresti', 'Dinamo', 'FC Rapid Bucuresti', 'Rapid Bucuresti',
    'FC Arges', 'Univ. Craiova', 'Universitatea Craiova'
];
const ROMANIA_PLAYOUT_TEAMS = [
    'FCSB', 'UTA Arad', 'UTA', 'FC Hermannstadt', 'Hermannstadt',
    'FC Botosani', 'Botosani', 'Unirea Slobozia', 'Slobozia',
    'Otelul', 'Otelul Galati', 'Csikszereda', 'Csikszereda M. Ciuc',
    'Farul Constanta', 'Farul', 'Petrolul', 'Petrolul Ploiesti',
    'Metaloglobus', 'Metaloglobus Bucharest'
];

/**
 * Corectează numele ligii pentru meciurile din România post-sezon regulat.
 * FlashScore pune uneori meciuri de playoff sub "Relegation Group".
 */
function fixRomaniaLeagueName(leagueName, homeTeam, awayTeam) {
    if (!leagueName.toLowerCase().includes('romania')) return leagueName;
    if (!leagueName.toLowerCase().includes('relegation') && !leagueName.toLowerCase().includes('championship')) return leagueName;

    const homeIsPlayoff = ROMANIA_PLAYOFF_TEAMS.some(t => homeTeam.includes(t) || t.includes(homeTeam));
    const awayIsPlayoff = ROMANIA_PLAYOFF_TEAMS.some(t => awayTeam.includes(t) || t.includes(awayTeam));

    // Dacă AMBELE echipe sunt din playoff → Championship Group
    if (homeIsPlayoff && awayIsPlayoff) {
        return 'ROMANIA: Superliga - Championship Group';
    }

    // Dacă niciuna nu e din playoff → Relegation Group
    const homeIsPlayout = ROMANIA_PLAYOUT_TEAMS.some(t => homeTeam.includes(t) || t.includes(homeTeam));
    const awayIsPlayout = ROMANIA_PLAYOUT_TEAMS.some(t => awayTeam.includes(t) || t.includes(awayTeam));
    if (homeIsPlayout && awayIsPlayout) {
        return 'ROMANIA: Superliga - Relegation Group';
    }

    // Fallback: returnează ce a venit de la FlashScore
    return leagueName;
}

/**
 * Generează numele fișierului JSON pentru data curentă
 */
function getOutputFilename() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `meciuri-${year}-${month}-${day}.json`;
}

/**
 * Verifică dacă un timestamp este în ziua curentă SAU mâine dimineață (00:00-07:59)
 *
 * Motivație: Meciurile din Brazilia/Argentina care se joacă după miezul nopții
 * (ora locală) apar în ziua următoare (ora României) din cauza fusului orar.
 *
 * Exemplu:
 * - Meci Brazilia: 1 feb 23:30 (ora Braziliei, UTC-3)
 * - În România (UTC+2): 2 feb 04:30
 * - Lista generată pe 1 feb la 08:00 trebuie să îl includă!
 *
 * @param {number} timestamp - Unix timestamp în secunde
 * @returns {boolean} - true dacă meciul e astăzi sau mâine înainte de 08:00
 */
function isToday(timestamp) {
    const matchDate = new Date(timestamp * 1000);
    const today = new Date();

    // Verifică dacă e în ziua curentă
    const isSameDay = matchDate.getFullYear() === today.getFullYear() &&
                      matchDate.getMonth() === today.getMonth() &&
                      matchDate.getDate() === today.getDate();

    if (isSameDay) {
        return true;
    }

    // Verifică dacă e mâine dimineață înainte de 08:00
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isTomorrowEarly = matchDate.getFullYear() === tomorrow.getFullYear() &&
                           matchDate.getMonth() === tomorrow.getMonth() &&
                           matchDate.getDate() === tomorrow.getDate() &&
                           matchDate.getHours() < 8;

    return isTomorrowEarly;
}

/**
 * Formatează timestamp în format HH:MM
 */
function formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * Formatează data în format DD.MM.YYYY
 */
function formatDate(date = new Date()) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

/**
 * Generează lista de meciuri pentru ziua curentă
 */
async function generateDailyMatches() {
    console.log(`\n⚽ GENERARE LISTĂ MECIURI - ${formatDate()}\n`);

    try {
        // Fetch main feed
        console.log('📡 Se extrag date din FlashScore...');
        const feed = await fetchMainFeed();

        // Obține toate meciurile
        const allMatches = Object.values(feed.matches);
        console.log(`   Total meciuri în feed: ${allMatches.length}`);

        // Filtrare 1: Doar meciuri din ziua curentă + mâine dimineață (00:00-07:59)
        const todayMatches = allMatches.filter(m => isToday(m.timestamp));
        console.log(`   Meciuri din ziua curentă + mâine dimineață: ${todayMatches.length}`);

        // Filtrare 2: Doar TOP ligi (strict) + exclude echipe tineret/rezerve
        const topLeagueMatches = todayMatches.filter(match => {
            const league = feed.leagues[match.leagueId] || {};
            const leagueName = league.name || '';

            // Exclude explicit meciuri U21/tineret/rezerve + ASIA din LIGA
            const normalizedLeague = leagueName.toLowerCase();
            const blacklist = [
                'u23', 'u22', 'u21', 'u19', 'u18', 'u17', 'under ', 'youth', 'reserve', ' ii', ' b ', 'women', ' w ',
                // 🚫 Competiții din ASIA (protecție dublă)
                'afc champions league', 'afc cup', 'gulf club champions', 'asean club', 'afc ', 'asia: '
            ];
            for (const blocked of blacklist) {
                if (normalizedLeague.includes(blocked)) {
                    return false;
                }
            }

            // Verifică dacă liga e în TOP
            if (!isTopLeague(leagueName)) {
                return false;
            }

            // ✅ VERIFICARE SUPLIMENTARĂ: Exclude echipe tineret/rezerve din NUME
            const homeTeam = (match.homeTeam || '').toLowerCase();
            const awayTeam = (match.awayTeam || '').toLowerCase();

            // Blacklist pentru nume echipe (mai strict - nu include "afc" ca să nu exclude AFC Bournemouth)
            const teamBlacklist = [
                'u23', 'u22', 'u21', 'u20', 'u19', 'u18', 'u17', 'u16',
                'under 23', 'under 22', 'under 21', 'under 20', 'under 19', 'under 18',
                ' ii', ' b', // Ex: "Real Madrid B", "Bayern II"
                'youth', 'reserve', 'reserves'
            ];

            for (const blocked of teamBlacklist) {
                if (homeTeam.includes(blocked) || awayTeam.includes(blocked)) {
                    return false;
                }
            }

            return true;
        });

        console.log(`   Meciuri TOP ligi: ${topLeagueMatches.length}`);

        // Sortează meciurile după ora de început
        topLeagueMatches.sort((a, b) => a.timestamp - b.timestamp);

        // Generează structura JSON
        const now = new Date();
        const output = {
            data: formatDate(),
            generatedAt: `${formatDate()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`,
            timezone: 'Europe/Bucharest (EET)',
            intervalAcoperit: 'Astăzi 00:00 - Mâine 07:59',
            totalMatches: topLeagueMatches.length,
            meciuri: []
        };

        // Verifică dacă sunt meciuri
        if (topLeagueMatches.length === 0) {
            output.mesaj = 'Nu sunt meciuri astăzi din TOP 30 ligi.';
            console.log('\n⚠️  Nu sunt meciuri din TOP ligi pentru astăzi.');
        } else {
            // Adaugă fiecare meci în listă
            topLeagueMatches.forEach(match => {
                const league = feed.leagues[match.leagueId] || {};
                let leagueName = league.name || 'Unknown League';

                // 🇷🇴 Fix: Corectează clasificarea playoff/playout România
                leagueName = fixRomaniaLeagueName(leagueName, match.homeTeam, match.awayTeam);

                output.meciuri.push({
                    matchId: match.matchId,
                    homeTeam: match.homeTeam,
                    awayTeam: match.awayTeam,
                    liga: leagueName,
                    ora: formatTime(match.timestamp),
                    timestamp: match.timestamp,
                    finished: match.finished || false
                });
            });

            console.log(`\n✅ Găsite ${topLeagueMatches.length} meciuri pentru astăzi:`);

            // Afișează rezumat pe ligi
            const leagueStats = {};
            topLeagueMatches.forEach(match => {
                const league = feed.leagues[match.leagueId] || {};
                const leagueName = league.name || 'Unknown';
                leagueStats[leagueName] = (leagueStats[leagueName] || 0) + 1;
            });

            console.log('\nDistribuție pe ligi:');
            Object.entries(leagueStats)
                .sort((a, b) => b[1] - a[1])
                .forEach(([liga, count]) => {
                    console.log(`   ${liga}: ${count} meciuri`);
                });
        }

        // Salvează JSON
        const outputPath = path.join(__dirname, getOutputFilename());
        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

        console.log(`\n💾 Salvat: ${getOutputFilename()}`);
        console.log(`   Calea completă: ${outputPath}\n`);

        return output;

    } catch (error) {
        console.error('❌ Eroare la generarea listei:', error);

        // Salvează JSON cu eroare
        const errorOutput = {
            data: formatDate(),
            generatedAt: new Date().toISOString(),
            error: true,
            mesaj: `Eroare la extragere date: ${error.message}`
        };

        const outputPath = path.join(__dirname, getOutputFilename());
        fs.writeFileSync(outputPath, JSON.stringify(errorOutput, null, 2), 'utf8');

        throw error;
    }
}

/**
 * Refresh: re-fetch FlashScore și adaugă meciuri noi la fișierul existent
 * Rulează la 13:00 pentru a prinde meciuri adăugate târziu de FlashScore
 * (ex: Championship Group România, playoff-uri etc.)
 */
async function refreshDailyMatches() {
    const outputPath = path.join(__dirname, getOutputFilename());

    // Citește fișierul existent
    if (!fs.existsSync(outputPath)) {
        console.log('⚠️  Fișierul zilnic nu există, rulez generateDailyMatches()');
        return await generateDailyMatches();
    }

    const existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    const existingIds = new Set(existing.meciuri.map(m => m.matchId));
    const beforeCount = existing.meciuri.length;

    console.log(`\n🔄 REFRESH MECIURI - ${formatDate()}`);
    console.log(`   Meciuri existente: ${beforeCount}`);

    try {
        const feed = await fetchMainFeed();
        const allMatches = Object.values(feed.matches);
        const todayMatches = allMatches.filter(m => isToday(m.timestamp));

        // Același filtru ca generateDailyMatches
        const topLeagueMatches = todayMatches.filter(match => {
            const league = feed.leagues[match.leagueId] || {};
            const leagueName = league.name || '';
            const normalizedLeague = leagueName.toLowerCase();
            const blacklist = [
                'u23', 'u22', 'u21', 'u19', 'u18', 'u17', 'under ', 'youth', 'reserve', ' ii', ' b ', 'women', ' w ',
                'afc champions league', 'afc cup', 'gulf club champions', 'asean club', 'afc ', 'asia: '
            ];
            for (const blocked of blacklist) {
                if (normalizedLeague.includes(blocked)) return false;
            }
            if (!isTopLeague(leagueName)) return false;

            const homeTeam = (match.homeTeam || '').toLowerCase();
            const awayTeam = (match.awayTeam || '').toLowerCase();
            const teamBlacklist = [
                'u23', 'u22', 'u21', 'u20', 'u19', 'u18', 'u17', 'u16',
                'under 23', 'under 22', 'under 21', 'under 20', 'under 19', 'under 18',
                ' ii', ' b', 'youth', 'reserve', 'reserves'
            ];
            for (const blocked of teamBlacklist) {
                if (homeTeam.includes(blocked) || awayTeam.includes(blocked)) return false;
            }
            return true;
        });

        // Adaugă doar meciuri NOI
        let added = 0;
        for (const match of topLeagueMatches) {
            if (!existingIds.has(match.matchId)) {
                const league = feed.leagues[match.leagueId] || {};
                let leagueName = league.name || 'Unknown League';
                // 🇷🇴 Fix: Corectează clasificarea playoff/playout România
                leagueName = fixRomaniaLeagueName(leagueName, match.homeTeam, match.awayTeam);
                existing.meciuri.push({
                    matchId: match.matchId,
                    homeTeam: match.homeTeam,
                    awayTeam: match.awayTeam,
                    liga: leagueName,
                    ora: formatTime(match.timestamp),
                    timestamp: match.timestamp,
                    finished: match.finished || false
                });
                added++;
                console.log(`   ➕ NOU: ${match.homeTeam} vs ${match.awayTeam} | ${league.name} | ${formatTime(match.timestamp)}`);
            }
        }

        if (added > 0) {
            // Re-sortează și actualizează
            existing.meciuri.sort((a, b) => a.timestamp - b.timestamp);
            existing.totalMatches = existing.meciuri.length;
            existing.lastRefresh = `${formatDate()} ${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`;
            fs.writeFileSync(outputPath, JSON.stringify(existing, null, 2), 'utf8');
            console.log(`   ✅ Adăugate ${added} meciuri noi (total: ${existing.meciuri.length})`);
        } else {
            console.log(`   ✅ Niciun meci nou de adăugat`);
        }

        return { added, total: existing.meciuri.length };

    } catch (error) {
        console.error(`   ❌ Eroare refresh: ${error.message}`);
        return { added: 0, total: beforeCount, error: error.message };
    }
}

// Run if called directly
if (require.main === module) {
    generateDailyMatches()
        .then(() => {
            console.log('✅ Procesare completă.\n');
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ Eroare fatală:', err);
            process.exit(1);
        });
}

module.exports = {
    generateDailyMatches,
    refreshDailyMatches,
    fixRomaniaLeagueName,
    ROMANIA_PLAYOFF_TEAMS,
    ROMANIA_PLAYOUT_TEAMS
};
