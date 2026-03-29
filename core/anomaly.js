/**
 * core/anomaly.js — Detectare anomalii și validări de bun simț
 *
 * Verifică datele colectate și alertează când ceva nu e normal.
 *
 * REGULI:
 * - Max 20 meciuri per ligă per zi (o etapă are max 10 meciuri)
 * - Max 150 meciuri total per zi (record e ~80-90 în zilele pline)
 * - Niciun meci cu "Unknown" ca echipă
 * - România: max 5 playoff + max 5 playout per zi
 * - Nicio ligă cu mai mult de 30% din totalul meciurilor zilei
 */

const config = require('./config');
const logger = require('./logger');

// Limite rezonabile
const LIMITS = {
    maxMatchesPerDay: 150,
    maxMatchesPerLeague: 20,
    maxRomaniaPlayoff: 5,
    maxRomaniaPlayout: 5,
    maxUnknownTeams: 0,
    maxSingleLeaguePercent: 30,
};

/**
 * Validează fișierul zilnic de meciuri
 * @param {Object} matchesData - Datele din meciuri-YYYY-MM-DD.json
 * @returns {{ valid: boolean, anomalies: string[], cleaned?: Object }}
 */
function validateDailyMatches(matchesData) {
    const anomalies = [];
    const meciuri = matchesData?.meciuri || [];

    // 1. Total meciuri excesiv
    if (meciuri.length > LIMITS.maxMatchesPerDay) {
        anomalies.push(`ANOMALIE: ${meciuri.length} meciuri total (max normal: ${LIMITS.maxMatchesPerDay})`);
    }

    // 2. Echipe Unknown
    const unknowns = meciuri.filter(m => !m.homeTeam || !m.awayTeam || m.homeTeam === 'Unknown' || m.awayTeam === 'Unknown');
    if (unknowns.length > LIMITS.maxUnknownTeams) {
        anomalies.push(`ANOMALIE: ${unknowns.length} meciuri cu echipe Unknown/lipsă`);
    }

    // 3. Per ligă
    const perLeague = {};
    meciuri.forEach(m => {
        const liga = m.liga || 'Unknown';
        perLeague[liga] = (perLeague[liga] || 0) + 1;
    });

    for (const [liga, count] of Object.entries(perLeague)) {
        if (count > LIMITS.maxMatchesPerLeague) {
            anomalies.push(`ANOMALIE: ${liga} are ${count} meciuri (max normal: ${LIMITS.maxMatchesPerLeague})`);
        }

        const percent = Math.round((count / meciuri.length) * 100);
        if (meciuri.length > 10 && percent > LIMITS.maxSingleLeaguePercent) {
            anomalies.push(`ANOMALIE: ${liga} = ${percent}% din total (${count}/${meciuri.length})`);
        }
    }

    // 4. România playoff/playout
    const romaniaPlayoff = meciuri.filter(m => m.liga?.includes('Championship Group'));
    const romaniaPlayout = meciuri.filter(m => m.liga?.includes('Relegation Group'));

    if (romaniaPlayoff.length > LIMITS.maxRomaniaPlayoff) {
        anomalies.push(`ANOMALIE: ${romaniaPlayoff.length} meciuri playoff România (max normal: ${LIMITS.maxRomaniaPlayoff})`);
    }
    if (romaniaPlayout.length > LIMITS.maxRomaniaPlayout) {
        anomalies.push(`ANOMALIE: ${romaniaPlayout.length} meciuri playout România (max normal: ${LIMITS.maxRomaniaPlayout})`);
    }

    // 5. Meciuri duplicate (același matchId)
    const ids = meciuri.map(m => m.matchId);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length > 0) {
        anomalies.push(`ANOMALIE: ${dupes.length} meciuri duplicate (matchId repetate)`);
    }

    // Log anomalii
    if (anomalies.length > 0) {
        logger.error(`🚨 ANOMALII DETECTATE (${anomalies.length}):`);
        anomalies.forEach(a => logger.error(`   ${a}`));
    }

    return {
        valid: anomalies.length === 0,
        anomalies,
        stats: {
            total: meciuri.length,
            unknowns: unknowns.length,
            leagues: Object.keys(perLeague).length,
            romaniaPlayoff: romaniaPlayoff.length,
            romaniaPlayout: romaniaPlayout.length,
            duplicates: dupes.length,
        }
    };
}

/**
 * Curăță automat anomaliile evidente (Unknown teams, duplicate)
 * Returnează datele curățate
 */
function autoClean(matchesData) {
    const meciuri = matchesData?.meciuri || [];
    const before = meciuri.length;

    // Elimină Unknown
    let cleaned = meciuri.filter(m => m.homeTeam && m.awayTeam && m.homeTeam !== 'Unknown' && m.awayTeam !== 'Unknown');

    // Elimină duplicate
    const seen = new Set();
    cleaned = cleaned.filter(m => {
        if (seen.has(m.matchId)) return false;
        seen.add(m.matchId);
        return true;
    });

    const removed = before - cleaned.length;
    if (removed > 0) {
        logger.warn(`🧹 Auto-clean: eliminat ${removed} meciuri invalide (${before} → ${cleaned.length})`);
    }

    matchesData.meciuri = cleaned;
    matchesData.totalMatches = cleaned.length;
    return matchesData;
}

module.exports = { validateDailyMatches, autoClean, LIMITS };
