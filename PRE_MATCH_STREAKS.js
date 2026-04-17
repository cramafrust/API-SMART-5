/**
 * PRE_MATCH_STREAKS - Analiză serii consecutive pre-meci
 *
 * Rulează dimineața imediat după generarea listei de meciuri.
 * Verifică S01-S22 pe ambele echipe din datele istorice.
 * Salvează rezultatele în data/pre_match_streaks_YYYY-MM-DD.json
 * La ora 12:00, trimite UN SINGUR email cu toate meciurile zilei (max 3 alerte/meci).
 */

const fs = require('fs');
const path = require('path');
const logger = require('./LOG_MANAGER');
const emailService = require('./EMAIL_SERVICE');
const PrematchTracker = require('./PREMATCH_TRACKER');

const SEASONS_DIR = path.join(__dirname, 'data', 'seasons');
const { leagueToFilePattern, normalizeName } = require('./WINNING_STREAK');
const { getTeamStreak, getStreakStats } = require('./WINNING_STREAK');

/**
 * Pragul minim de probabilitate pentru alerte pre-meci
 * Competiții europene: 75%
 * Toate celelalte: 80%
 */
function getPreMatchThreshold(leagueName) {
    const europeanKeywords = ['Champions League', 'Europa League', 'Conference League'];
    const isEuropean = europeanKeywords.some(kw => leagueName && leagueName.includes(kw));
    if (isEuropean) return 70;

    // Ligi cu win rate istoric sub 50% — prag ridicat
    const weakLeagues = [
        'SERBIA',
        'SCOTLAND',
        'ENGLAND: Championship',
        'PORTUGAL: Liga Portugal',
        'ITALY: Serie A',
        'BRAZIL: Serie A'
    ];
    const isWeak = weakLeagues.some(wl => leagueName && leagueName.includes(wl));
    if (isWeak) return 85;

    return 75;
}

// ============================================================
// DEFINIREA PATTERN-URILOR S01-S22
// ============================================================

const STREAK_PATTERNS = [
    {
        id: 'S01', category: 'GOLURI',
        label: (n) => `a marcat 2+ goluri în ${n} meciuri la rând → prob. să marcheze 1+ gol`,
        getStat: (m, h) => { if (!m.scor) return null; return h ? m.scor.final_gazda : m.scor.final_oaspete; },
        threshold: 2, nextThreshold: 1, minStreak: 3, type: 'team'
    },
    {
        id: 'S02', category: 'GOLURI',
        label: (n) => `a marcat în ${n} meciuri la rând → prob. să marcheze și acum`,
        getStat: (m, h) => { if (!m.scor) return null; return h ? m.scor.final_gazda : m.scor.final_oaspete; },
        threshold: 1, nextThreshold: 1, minStreak: 5, type: 'team'
    },
    {
        id: 'S03', category: 'GOLURI PRIMITE',
        label: (n) => `a primit gol în ${n} meciuri la rând → prob. să primească gol`,
        getStat: (m, h) => { if (!m.scor) return null; return h ? m.scor.final_oaspete : m.scor.final_gazda; },
        threshold: 1, nextThreshold: 1, minStreak: 3, type: 'team'
    },
    {
        id: 'S04', category: 'GOLURI PRIMITE',
        label: (n) => `a primit 2+ goluri în ${n} meciuri la rând → prob. să primească 1+ gol`,
        getStat: (m, h) => { if (!m.scor) return null; return h ? m.scor.final_oaspete : m.scor.final_gazda; },
        threshold: 2, nextThreshold: 1, minStreak: 3, type: 'team'
    },
    {
        id: 'S05', category: 'GOLURI R1',
        label: (n) => `a marcat în R1 în ${n} meciuri la rând → prob. să marcheze în R1`,
        getStat: (m, h) => { if (!m.scor) return null; return h ? m.scor.pauza_gazda : m.scor.pauza_oaspete; },
        threshold: 1, nextThreshold: 1, minStreak: 3, type: 'team'
    },
    {
        id: 'S06', category: 'OVER TOTAL MECI',
        label: (n) => `meciurile au avut 3+ goluri TOTAL în ${n} meciuri la rând → prob. 2+ goluri TOTAL MECI`,
        getStat: (m, h) => { if (!m.scor) return null; return m.scor.final_gazda + m.scor.final_oaspete; },
        threshold: 3, nextThreshold: 2, minStreak: 3, type: 'team'
    },
    {
        id: 'S07', category: 'CORNERE',
        label: (n) => `a avut 4+ cornere în ${n} meciuri la rând → prob. să aibă 4+ cornere`,
        getStat: (m, h) => { const c = m.statistici && m.statistici.cornere; if (!c) return null; return h ? c.total_gazda : c.total_oaspete; },
        threshold: 4, nextThreshold: 4, minStreak: 3, type: 'team'
    },
    {
        id: 'S08', category: 'CORNERE',
        label: (n) => `a avut 4+ cornere în ${n} meciuri la rând → prob. să aibă 3+ cornere`,
        getStat: (m, h) => { const c = m.statistici && m.statistici.cornere; if (!c) return null; return h ? c.total_gazda : c.total_oaspete; },
        threshold: 4, nextThreshold: 3, minStreak: 3, type: 'team'
    },
    {
        id: 'S09', category: 'CORNERE',
        label: (n) => `a avut 5+ cornere în ${n} meciuri la rând → prob. să aibă 3+ cornere`,
        getStat: (m, h) => { const c = m.statistici && m.statistici.cornere; if (!c) return null; return h ? c.total_gazda : c.total_oaspete; },
        threshold: 5, nextThreshold: 3, minStreak: 3, type: 'team'
    },
    {
        id: 'S10', category: 'CORNERE',
        label: (n) => `a avut 5+ cornere în ${n} meciuri la rând → prob. să aibă 5+ cornere`,
        getStat: (m, h) => { const c = m.statistici && m.statistici.cornere; if (!c) return null; return h ? c.total_gazda : c.total_oaspete; },
        threshold: 5, nextThreshold: 5, minStreak: 3, type: 'team'
    },
    {
        id: 'S11', category: 'ȘUTURI PE POARTĂ',
        label: (n) => `a avut 4+ șuturi pe poartă în ${n} meciuri la rând → prob. 4+`,
        getStat: (m, h) => { const s = m.statistici && m.statistici.suturi_pe_poarta; if (!s) return null; return h ? s.total_gazda : s.total_oaspete; },
        threshold: 4, nextThreshold: 4, minStreak: 3, type: 'team'
    },
    {
        id: 'S12', category: 'ȘUTURI PE POARTĂ',
        label: (n) => `a avut 4+ șuturi pe poartă în ${n} meciuri la rând → prob. 3+`,
        getStat: (m, h) => { const s = m.statistici && m.statistici.suturi_pe_poarta; if (!s) return null; return h ? s.total_gazda : s.total_oaspete; },
        threshold: 4, nextThreshold: 3, minStreak: 3, type: 'team'
    },
    {
        id: 'S13', category: 'ȘUTURI PE POARTĂ',
        label: (n) => `a avut 5+ șuturi pe poartă în ${n} meciuri la rând → prob. 3+`,
        getStat: (m, h) => { const s = m.statistici && m.statistici.suturi_pe_poarta; if (!s) return null; return h ? s.total_gazda : s.total_oaspete; },
        threshold: 5, nextThreshold: 3, minStreak: 3, type: 'team'
    },
    {
        id: 'S14', category: 'ȘUTURI PE POARTĂ',
        label: (n) => `a avut 6+ șuturi pe poartă în ${n} meciuri la rând → prob. 4+`,
        getStat: (m, h) => { const s = m.statistici && m.statistici.suturi_pe_poarta; if (!s) return null; return h ? s.total_gazda : s.total_oaspete; },
        threshold: 6, nextThreshold: 4, minStreak: 3, type: 'team'
    },
    {
        id: 'S15', category: 'TOTAL ȘUTURI',
        label: (n) => `a tras 10+ șuturi în ${n} meciuri la rând → prob. 10+ șuturi`,
        getStat: (m, h) => { const s = m.statistici && m.statistici.total_suturi; if (!s) return null; return h ? s.total_gazda : s.total_oaspete; },
        threshold: 10, nextThreshold: 10, minStreak: 3, type: 'team'
    },
    {
        id: 'S16', category: 'TOTAL ȘUTURI',
        label: (n) => `a tras 12+ șuturi în ${n} meciuri la rând → prob. 10+ șuturi`,
        getStat: (m, h) => { const s = m.statistici && m.statistici.total_suturi; if (!s) return null; return h ? s.total_gazda : s.total_oaspete; },
        threshold: 12, nextThreshold: 10, minStreak: 3, type: 'team'
    },
    {
        id: 'S17', category: 'TOTAL ȘUTURI',
        label: (n) => `a tras 12+ șuturi în ${n} meciuri la rând → prob. 10+ șuturi`,
        getStat: (m, h) => { const s = m.statistici && m.statistici.total_suturi; if (!s) return null; return h ? s.total_gazda : s.total_oaspete; },
        threshold: 12, nextThreshold: 10, minStreak: 3, type: 'team'
    },
    {
        id: 'S18', category: 'FAULTURI',
        label: (n) => `a comis 10+ faulturi în ${n} meciuri la rând → prob. 11+ faulturi`,
        getStat: (m, h) => { const f = m.statistici && m.statistici.faulturi; if (!f) return null; return h ? f.total_gazda : f.total_oaspete; },
        threshold: 10, nextThreshold: 11, minStreak: 3, type: 'team'
    },
    {
        id: 'S19', category: 'FAULTURI',
        label: (n) => `a comis 10+ faulturi în ${n} meciuri la rând → prob. 11+ faulturi`,
        getStat: (m, h) => { const f = m.statistici && m.statistici.faulturi; if (!f) return null; return h ? f.total_gazda : f.total_oaspete; },
        threshold: 10, nextThreshold: 11, minStreak: 3, type: 'team'
    },
    {
        id: 'S20', category: 'FAULTURI',
        label: (n) => `a comis 12+ faulturi în ${n} meciuri la rând → prob. 11+ faulturi`,
        getStat: (m, h) => { const f = m.statistici && m.statistici.faulturi; if (!f) return null; return h ? f.total_gazda : f.total_oaspete; },
        threshold: 12, nextThreshold: 11, minStreak: 3, type: 'team'
    },
    {
        id: 'S21', category: 'CARTONAȘE',
        label: (n) => `a luat 2+ cartonașe în ${n} meciuri la rând → prob. 2+ cartonașe`,
        getStat: (m, h) => { const yc = m.statistici && m.statistici.cartonase_galbene; if (!yc) return null; return h ? yc.total_gazda : yc.total_oaspete; },
        threshold: 2, nextThreshold: 2, minStreak: 3, type: 'team'
    },
    {
        id: 'S22', category: 'CARTONAȘE',
        label: (n) => `a luat 2+ cartonașe în ${n} meciuri la rând → prob. 1+ cartonaș`,
        getStat: (m, h) => { const yc = m.statistici && m.statistici.cartonase_galbene; if (!yc) return null; return h ? yc.total_gazda : yc.total_oaspete; },
        threshold: 2, nextThreshold: 1, minStreak: 3, type: 'team'
    },
];

// ============================================================
// ÎNCĂRCARE DATE CATALOG
// ============================================================

let catalog = null;
function loadCatalog() {
    if (catalog) return catalog;
    try {
        catalog = JSON.parse(
            fs.readFileSync(path.join(__dirname, 'data', 'streak_patterns_catalog.json'), 'utf8')
        );
    } catch (e) {
        logger.error('PRE_MATCH_STREAKS: Nu am putut încărca streak_patterns_catalog.json');
        catalog = { patterns: {} };
    }
    return catalog;
}

// ============================================================
// FUNCȚII PRINCIPALE
// ============================================================

/**
 * Calculează seria curentă a unei echipe pentru un pattern dat
 */
function getTeamPatternStreak(leagueName, teamName, pattern) {
    const filePattern = leagueToFilePattern(leagueName);
    if (!filePattern) return 0;

    const normalizedTeam = normalizeName(teamName);

    // Încarcă meciurile
    const files = fs.readdirSync(SEASONS_DIR)
        .filter(f => f.includes(filePattern) && f.endsWith('.json') &&
            f.indexOf('BACKUP') === -1 && f.indexOf('OLD_FORMAT') === -1 && f.indexOf('pre-') === -1)
        .sort();

    let allMatches = [];
    for (const f of files) {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8'));
            allMatches = allMatches.concat((data.meciuri || []).filter(m =>
                m.scor && m.scor.final_gazda !== null && m.echipa_gazda && m.echipa_oaspete));
        } catch (e) { continue; }
    }
    allMatches.sort((a, b) => ((a.data_ora ? a.data_ora.data : '').localeCompare(b.data_ora ? b.data_ora.data : '')));

    // Meciurile echipei
    const teamMatches = allMatches.filter(m =>
        normalizeName(m.echipa_gazda.nume) === normalizedTeam ||
        normalizeName(m.echipa_oaspete.nume) === normalizedTeam
    );

    // Numărăm seria de la coada spre cap
    let streak = 0;
    for (let i = teamMatches.length - 1; i >= 0; i--) {
        const m = teamMatches[i];
        const isHome = normalizeName(m.echipa_gazda.nume) === normalizedTeam;
        const val = pattern.getStat(m, isHome);
        if (val === null || val < pattern.threshold) break;
        streak++;
    }

    return streak;
}

/**
 * Obține probabilitatea din catalog pentru un pattern + serie + tier
 */
function getCatalogProb(patternId, streakLength, leagueName, tier) {
    const cat = loadCatalog();
    const patData = cat.patterns[patternId];
    if (!patData) return null;

    let normalizedTier = tier || 'MID';
    if (normalizedTier.startsWith('TOP')) normalizedTier = 'TOP';
    else if (normalizedTier.startsWith('MID')) normalizedTier = 'MID';
    else if (normalizedTier.startsWith('LOW')) normalizedTier = 'LOW';

    const maxStreak = Math.min(streakLength, 7);

    for (let n = maxStreak; n >= 3; n--) {
        const key = n + 'W';

        // Per campionat
        for (const [jsonLeague, streaks] of Object.entries(patData.perLeague || {})) {
            if (leagueNamesMatch(leagueName, jsonLeague)) {
                const tierData = streaks[key] && streaks[key][normalizedTier];
                if (tierData && tierData.total >= 5) {
                    return {
                        success: tierData.success,
                        total: tierData.total,
                        rate: tierData.rate,
                        streakUsed: n,
                        source: 'league'
                    };
                }
            }
        }

        // Global
        const globalData = patData.global[key] && patData.global[key][normalizedTier];
        if (globalData && globalData.total >= 5) {
            return {
                success: globalData.success,
                total: globalData.total,
                rate: globalData.rate,
                streakUsed: n,
                source: 'global'
            };
        }
    }

    return null;
}

function leagueNamesMatch(apiName, jsonName) {
    if (!apiName || !jsonName) return false;
    const a = apiName.toLowerCase();
    const b = jsonName.toLowerCase();
    if (a === b) return true;
    if (a.includes(b) || b.includes(a)) return true;
    const aPart = a.includes(':') ? a.split(':')[1].trim() : a;
    const bPart = b.includes(':') ? b.split(':')[1].trim() : b;
    return aPart === bPart;
}

/**
 * Obține tier-ul echipei din datele istorice
 */
function getTeamTier(leagueName, teamName) {
    const { getPositionFromHistory } = require('./POSITION_FALLBACK');
    const hist = getPositionFromHistory(leagueName, teamName);
    return hist ? hist.tier : 'MID_6-10';
}

/**
 * Scanează toate meciurile zilei și generează pre-match streaks
 */
async function generatePreMatchStreaks(matchesFile) {
    logger.info('\n📊 PRE-MATCH STREAKS: Analiză serii consecutive pre-meci\n');

    if (!fs.existsSync(matchesFile)) {
        logger.error(`PRE_MATCH_STREAKS: Fișierul ${matchesFile} nu există`);
        return null;
    }

    const matchesData = JSON.parse(fs.readFileSync(matchesFile, 'utf8'));
    const meciuri = matchesData.meciuri || [];

    if (meciuri.length === 0) {
        logger.info('PRE_MATCH_STREAKS: Nu sunt meciuri pentru astăzi');
        return null;
    }

    logger.info(`   Analizez ${meciuri.length} meciuri...\n`);

    const results = {
        _meta: {
            generatedAt: new Date().toISOString(),
            date: matchesData.data,
            totalMatches: meciuri.length,
            totalAlerts: 0
        },
        matches: {}
    };

    // Cache pentru meciurile încărcate per liga (evităm re-citirea)
    const matchesCache = {};

    for (const meci of meciuri) {
        if (meci.finished) continue;

        const matchAlerts = {
            matchId: meci.matchId,
            homeTeam: meci.homeTeam,
            awayTeam: meci.awayTeam,
            liga: meci.liga,
            ora: meci.ora,
            timestamp: meci.timestamp,
            alerts: []
        };

        // Obține tier-urile
        const homeTier = getTeamTier(meci.liga, meci.homeTeam);
        const awayTier = getTeamTier(meci.liga, meci.awayTeam);

        // Verificăm winning streak separat (calculat dinamic, nu din catalog)
        try {
            for (const teamInfo of [
                { name: meci.homeTeam, side: 'gazda', tier: homeTier },
                { name: meci.awayTeam, side: 'oaspete', tier: awayTier }
            ]) {
                const ws = getTeamStreak(meci.liga, teamInfo.name);
                if (ws.currentWinStreak >= 3) {
                    const wsStats = getStreakStats(meci.liga, ws.currentWinStreak);
                    if (wsStats && wsStats.rate >= getPreMatchThreshold(meci.liga)) {
                        matchAlerts.alerts.push({
                            patternId: 'WIN_STREAK',
                            category: 'VICTORII',
                            team: teamInfo.name,
                            side: teamInfo.side,
                            streak: ws.currentWinStreak,
                            success: wsStats.won,
                            total: wsStats.total,
                            rate: wsStats.rate,
                            label: `${teamInfo.name} are ${ws.currentWinStreak} victorii la rând — în ${wsStats.total} cazuri similare istorice, ${wsStats.won} au câștigat și următorul meci (${wsStats.rate}% reușită)`
                        });
                    }
                }
            }
        } catch (e) { /* skip */ }

        // Verificăm S01-S22
        for (const pat of STREAK_PATTERNS) {
            for (const teamInfo of [
                { name: meci.homeTeam, side: 'gazda', tier: homeTier },
                { name: meci.awayTeam, side: 'oaspete', tier: awayTier }
            ]) {
                try {
                    const streak = getTeamPatternStreak(meci.liga, teamInfo.name, pat);
                    if (streak < pat.minStreak) continue;

                    const prob = getCatalogProb(pat.id, streak, meci.liga, teamInfo.tier);
                    if (!prob) continue;

                    // Salvăm toate, filtrul de 70% se aplică la afișare
                    matchAlerts.alerts.push({
                        patternId: pat.id,
                        category: pat.category,
                        team: teamInfo.name,
                        side: teamInfo.side,
                        streak: streak,
                        success: prob.success,
                        total: prob.total,
                        rate: prob.rate,
                        streakUsed: prob.streakUsed,
                        source: prob.source,
                        label: `${teamInfo.name} ${pat.label(streak)} — în ${prob.total} cazuri similare istorice, s-a întâmplat de ${prob.success} ori (${prob.rate}% reușită)`
                    });
                } catch (e) { /* skip */ }
            }
        }

        if (matchAlerts.alerts.length > 0) {
            // DEDUPLICARE: un singur pronostic per echipă+categorie, cel cu rata cea mai bună
            // Ex: S15 (10+ → 10+), S16 (12+ → 10+), S17 (12+ → 10+) = ACELAȘI pronostic "10+ șuturi"
            const deduped = [];
            const seenKeys = new Set();
            matchAlerts.alerts.sort((a, b) => b.rate - a.rate); // Sortăm mai întâi
            for (const alert of matchAlerts.alerts) {
                const dedupKey = `${alert.team}|${alert.category}|${alert.side}`;
                if (seenKeys.has(dedupKey)) continue;
                seenKeys.add(dedupKey);
                deduped.push(alert);
            }
            matchAlerts.alerts = deduped;
            results.matches[meci.matchId] = matchAlerts;
            results._meta.totalAlerts += matchAlerts.alerts.length;

            const threshold = getPreMatchThreshold(meci.liga);
            const alertsAboveThreshold = matchAlerts.alerts.filter(a => a.rate >= threshold).length;
            logger.info(`   ✅ ${meci.homeTeam} vs ${meci.awayTeam} (${meci.ora}) — ${alertsAboveThreshold} alerte ≥${threshold}% din ${matchAlerts.alerts.length} total`);
        }
    }

    // Salvează — păstrează emailSent din fișierul existent (evită retrimitere)
    const today = new Date().toISOString().split('T')[0];
    const outputFile = path.join(__dirname, 'data', `pre_match_streaks_${today}.json`);

    // Citește fișierul existent pentru a păstra emailSent flags
    try {
        if (fs.existsSync(outputFile)) {
            const existing = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
            if (existing.matches) {
                for (const [matchId, existingMatch] of Object.entries(existing.matches)) {
                    if (existingMatch.emailSent && results.matches[matchId]) {
                        results.matches[matchId].emailSent = true;
                    }
                }
            }
        }
    } catch (e) {
        // Ignoră erori la citirea fișierului vechi
    }

    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');

    logger.info(`\n   💾 Salvat: data/pre_match_streaks_${today}.json`);
    logger.info(`   📊 ${Object.keys(results.matches).length} meciuri cu alerte, ${results._meta.totalAlerts} alerte total\n`);

    return results;
}

// ============================================================
// TRIMITERE EMAIL PRE-MECI
// ============================================================

/**
 * Filtrează alertele unui meci: 1 per categorie×echipă, apoi maxim 3 (cele mai bune)
 */
function filterMatchAlerts(matchData) {
    const MAX_ALERTS_PER_MATCH = 3;
    const threshold = getPreMatchThreshold(matchData.liga);
    const aboveThreshold = matchData.alerts.filter(a => a.rate >= threshold);
    if (aboveThreshold.length === 0) return [];

    // Pas 1: cel mai bun per categorie × echipă
    const bestPerCategoryTeam = {};
    for (const a of aboveThreshold) {
        const key = `${a.side}_${a.category}`;
        if (!bestPerCategoryTeam[key] || a.rate > bestPerCategoryTeam[key].rate) {
            bestPerCategoryTeam[key] = a;
        }
    }
    const afterStep1 = Object.values(bestPerCategoryTeam);

    // Pas 2: maxim MAX_ALERTS_PER_MATCH, sortate descrescător
    afterStep1.sort((a, b) => b.rate - a.rate);
    return afterStep1.slice(0, MAX_ALERTS_PER_MATCH);
}

/**
 * Generează HTML pentru un singur meci (secțiune în emailul zilnic)
 */
function formatMatchSection(matchData, filteredAlerts) {
    const threshold = getPreMatchThreshold(matchData.liga);

    // Grupează pe echipă
    const homeAlerts = filteredAlerts.filter(a => a.side === 'gazda');
    const awayAlerts = filteredAlerts.filter(a => a.side === 'oaspete');

    let patternsHTML = '';

    for (const section of [
        { alerts: homeAlerts, icon: '🏠', label: matchData.homeTeam },
        { alerts: awayAlerts, icon: '✈️', label: matchData.awayTeam }
    ]) {
        if (section.alerts.length === 0) continue;

        patternsHTML += `<div style="margin: 10px 0;">
            <h4 style="color: #1976d2; margin: 0 0 6px 0; font-size: 14px;">${section.icon} ${section.label}:</h4>`;

        for (const a of section.alerts) {
            const isStrong = a.rate >= 90 && a.total >= 10;
            if (isStrong) {
                patternsHTML += `<div style="margin: 6px 0; padding: 6px 10px; background-color: #fff8e1; border: 1px solid #ffb300; border-radius: 6px;">
                    <div style="font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 3px;">${a.category}</div>
                    <span style="font-size: 12px; font-weight: 700; color: #e65100;">🎯 ${a.label}</span>
                </div>`;
            } else {
                const color = a.rate >= 80 ? '#2e7d32' : '#1565c0';
                patternsHTML += `<div style="margin: 6px 0; padding: 6px 10px; background-color: #f8f9fa; border-radius: 6px;">
                    <div style="font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 3px;">${a.category}</div>
                    <div style="font-size: 12px; color: ${color}; font-weight: 600;">📈 ${a.label}</div>
                </div>`;
            }
        }

        patternsHTML += `</div>`;
    }

    const maxRate = Math.max(...filteredAlerts.map(a => a.rate));

    return `
    <div style="margin: 20px 0; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #1565c0, #0d47a1); color: white; padding: 12px 16px;">
            <div style="font-size: 16px; font-weight: bold;">
                ${matchData.homeTeam} vs ${matchData.awayTeam}
            </div>
            <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">
                ${matchData.liga} • ${matchData.ora} • ${filteredAlerts.length} alerte (max ${maxRate}%)
            </div>
        </div>
        <div style="padding: 12px 16px; background: white;">
            ${patternsHTML}
        </div>
    </div>`;
}

/**
 * Generează HTML pentru emailul zilnic cu TOATE meciurile
 */
function formatDailyPreMatchEmail(allMatchesData) {
    if (allMatchesData.length === 0) return null;

    let totalAlerts = 0;
    let matchSections = '';

    // Sortează meciurile după ora de start
    allMatchesData.sort((a, b) => (a.matchData.timestamp || 0) - (b.matchData.timestamp || 0));

    for (const { matchData, alerts } of allMatchesData) {
        totalAlerts += alerts.length;
        matchSections += formatMatchSection(matchData, alerts);
    }

    const today = new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0d47a1, #1a237e); color: white; padding: 20px; border-radius: 12px 12px 0 0;">
            <h2 style="margin: 0; font-size: 20px;">📊 RAPORT PRE-MECI ZILNIC</h2>
            <div style="font-size: 14px; opacity: 0.9; margin-top: 8px;">
                ${today}
            </div>
            <div style="font-size: 13px; opacity: 0.8; margin-top: 4px;">
                ${allMatchesData.length} meciuri • ${totalAlerts} pronosticuri
            </div>
        </div>

        <div style="background: #fafafa; padding: 16px;">
            ${matchSections}
        </div>

        <div style="background: white; padding: 16px; border: 1px solid #e0e0e0; border-radius: 0 0 12px 12px;">
            <div style="font-size: 11px; color: #999; text-align: center;">
                Generat automat de API SMART 5 la ora 12:00 • Doar informativ, nu constituie recomandare de pariere
            </div>
        </div>
    </div>`;
}

/**
 * Trimite emailul zilnic pre-meci cu toate meciurile (apelat la 12:00)
 */
async function sendDailyPreMatchEmail() {
    const today = new Date().toISOString().split('T')[0];
    const streaksFile = path.join(__dirname, 'data', `pre_match_streaks_${today}.json`);

    if (!fs.existsSync(streaksFile)) {
        logger.info('   📊 Nu există fișier pre-match streaks pentru azi');
        return false;
    }

    let data;
    try {
        data = JSON.parse(fs.readFileSync(streaksFile, 'utf8'));
    } catch (e) {
        logger.error(`   ❌ Eroare citire pre-match streaks: ${e.message}`);
        return false;
    }

    // Colectează toate meciurile cu alerte valide
    const allMatchesData = [];

    for (const [matchId, matchData] of Object.entries(data.matches)) {
        const filtered = filterMatchAlerts(matchData);
        if (filtered.length === 0) continue;
        allMatchesData.push({ matchId, matchData, alerts: filtered });
    }

    if (allMatchesData.length === 0) {
        logger.info('   📊 Niciun meci cu alerte pre-match peste prag');
        return false;
    }

    const html = formatDailyPreMatchEmail(allMatchesData);
    if (!html) return false;

    const totalAlerts = allMatchesData.reduce((sum, m) => sum + m.alerts.length, 0);
    const maxRateAll = Math.max(...allMatchesData.flatMap(m => m.alerts.map(a => a.rate)));

    try {
        const result = await emailService.send({
            subject: `📊 PRE-MECI ${today}: ${allMatchesData.length} meciuri, ${totalAlerts} pronosticuri (max ${maxRateAll}%)`,
            html: html
        });

        if (result.success) {
            logger.info(`   📧 Email zilnic pre-meci trimis: ${allMatchesData.length} meciuri, ${totalAlerts} alerte`);

            // Salvează predicțiile în tracker pentru validare ulterioară
            const saved = PrematchTracker.saveDailyPredictions(allMatchesData);
            logger.info(`   📊 ${saved} predicții salvate în prematch_tracking.json`);
        }
        return result.success;
    } catch (e) {
        logger.error(`   ❌ Eroare email zilnic pre-meci: ${e.message}`);
        return false;
    }
}

// Tracking separat pentru emailul zilnic
const DAILY_EMAIL_SENT_FILE = path.join(__dirname, 'data', 'prematch_daily_sent.json');

function isDailyEmailSent() {
    try {
        if (fs.existsSync(DAILY_EMAIL_SENT_FILE)) {
            const sent = JSON.parse(fs.readFileSync(DAILY_EMAIL_SENT_FILE, 'utf8'));
            const today = new Date().toISOString().split('T')[0];
            return sent.date === today;
        }
    } catch (e) {}
    return false;
}

function markDailyEmailSent() {
    const today = new Date().toISOString().split('T')[0];
    fs.writeFileSync(DAILY_EMAIL_SENT_FILE, JSON.stringify({ date: today, sentAt: new Date().toISOString() }, null, 2), 'utf8');
}

/**
 * Verifică dacă e ora 12:00 și trimite emailul zilnic pre-meci
 * Apelat din STATS_MONITOR la fiecare minut
 */
async function checkAndSendPreMatchEmails() {
    // Trimite un singur email zilnic la ora 12:00
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Fereastra: 12:00 - 12:05 (5 minute toleranță)
    if (hour !== 12 || minute > 5) return;

    // Verifică dacă s-a trimis deja azi
    if (isDailyEmailSent()) return;

    logger.info('   📊 Ora 12:00 — trimitere emailuri zilnice pre-meci...');

    const sent = await sendDailyPreMatchEmail();
    if (sent) {
        markDailyEmailSent();
        logger.info('   ✅ Email zilnic pre-meci marcat ca trimis');

        // Trimite și TOP 30 (doar dacă nu s-a trimis deja)
        if (!isTop30Sent()) {
            const top30sent = await sendTop30PreMatchEmail();
            if (top30sent) {
                markTop30Sent();
                logger.info('   🏆 Email TOP 30 prematch marcat ca trimis');
            }
        }
    }
}

// ============================================================
// ZILNIC TOP 30 PREMATCH — Email cu cele mai sigure pronosticuri
// ============================================================

const TOP30_SENT_FILE = path.join(__dirname, 'data', 'prematch_top30_sent.json');

function isTop30Sent() {
    try {
        if (fs.existsSync(TOP30_SENT_FILE)) {
            const sent = JSON.parse(fs.readFileSync(TOP30_SENT_FILE, 'utf8'));
            const today = new Date().toISOString().split('T')[0];
            return sent.date === today;
        }
    } catch (e) {}
    return false;
}

function markTop30Sent() {
    const today = new Date().toISOString().split('T')[0];
    fs.writeFileSync(TOP30_SENT_FILE, JSON.stringify({ date: today, sentAt: new Date().toISOString() }, null, 2), 'utf8');
}

/**
 * Colectează TOATE alertele din toate meciurile, sortează după rate, ia top 30
 */
function getTop30Predictions(data) {
    const allAlerts = [];

    for (const [matchId, matchData] of Object.entries(data.matches)) {
        const threshold = getPreMatchThreshold(matchData.liga);
        for (const alert of matchData.alerts) {
            if (alert.rate >= threshold) {
                allAlerts.push({
                    ...alert,
                    matchId,
                    homeTeam: matchData.homeTeam,
                    awayTeam: matchData.awayTeam,
                    liga: matchData.liga,
                    ora: matchData.ora
                });
            }
        }
    }

    // Sortează descrescător după rată, apoi după total (mai multe cazuri = mai fiabil)
    allAlerts.sort((a, b) => {
        if (b.rate !== a.rate) return b.rate - a.rate;
        return b.total - a.total;
    });

    return allAlerts.slice(0, 30);
}

/**
 * Generează HTML pentru emailul TOP 30
 */
function formatTop30Email(top30) {
    const today = new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    let rows = '';
    for (let i = 0; i < top30.length; i++) {
        const a = top30[i];
        const rank = i + 1;
        const isTop10 = rank <= 10;
        const bgColor = isTop10 ? '#fff8e1' : (rank % 2 === 0 ? '#f8f9fa' : '#ffffff');
        const rateColor = a.rate >= 90 ? '#e65100' : a.rate >= 85 ? '#2e7d32' : '#1565c0';
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
        const isMatchLevel = (a.category || '').includes('TOTAL MECI') || (a.category || '').includes('OVER TOTAL');
        const sideIcon = isMatchLevel ? '⚽' : (a.side === 'gazda' ? '🏠' : '✈️');
        const teamDisplay = isMatchLevel ? `${a.homeTeam} vs ${a.awayTeam}` : a.team;

        // Extrage predicția scurtă din label (ex: "prob. 8+ șuturi", "prob. să marcheze")
        let shortPrediction = '';
        if (a.label) {
            const probMatch = a.label.match(/→\s*prob\.\s*(.+?)(?:\s*—|$)/);
            if (probMatch) {
                shortPrediction = probMatch[1].trim();
            } else {
                shortPrediction = a.category;
            }
        } else {
            shortPrediction = a.category;
        }

        rows += `
        <tr style="background-color: ${bgColor}; border-bottom: 1px solid #e0e0e0;">
            <td style="padding: 10px 8px; text-align: center; font-weight: bold; font-size: 14px; width: 40px;">
                ${medal}
            </td>
            <td style="padding: 10px 8px;">
                <div style="font-weight: 600; font-size: 13px; color: #333;">
                    ${sideIcon} ${teamDisplay}
                </div>
                <div style="font-size: 11px; color: #666; margin-top: 2px;">
                    ${a.homeTeam} vs ${a.awayTeam} • ${a.ora}
                </div>
                <div style="font-size: 10px; color: #999; margin-top: 1px;">
                    ${a.liga}
                </div>
            </td>
            <td style="padding: 10px 8px;">
                <div style="font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 2px;">${a.category}</div>
                <div style="font-size: 12px; color: #333; font-weight: 600;">${shortPrediction}</div>
                <div style="font-size: 10px; color: #999; margin-top: 2px;">serie: ${a.streak || a.streakUsed || '?'} meciuri</div>
            </td>
            <td style="padding: 10px 8px; text-align: center;">
                <div style="font-size: 18px; font-weight: 700; color: ${rateColor};">${a.rate}%</div>
                <div style="font-size: 10px; color: #999;">${a.success}/${a.total}</div>
            </td>
        </tr>`;
    }

    return `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #e65100, #bf360c); color: white; padding: 20px; border-radius: 12px 12px 0 0;">
            <h2 style="margin: 0; font-size: 22px;">🏆 ZILNIC TOP 30 PREMATCH</h2>
            <div style="font-size: 14px; opacity: 0.9; margin-top: 8px;">
                ${today}
            </div>
            <div style="font-size: 13px; opacity: 0.8; margin-top: 4px;">
                Cele mai sigure 30 de pronosticuri pre-meci din toate cele disponibile
            </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; background: white;">
            <thead>
                <tr style="background-color: #263238; color: white;">
                    <th style="padding: 10px 8px; text-align: center; font-size: 11px; width: 40px;">#</th>
                    <th style="padding: 10px 8px; text-align: left; font-size: 11px;">MECI / ECHIPĂ</th>
                    <th style="padding: 10px 8px; text-align: center; font-size: 11px;">TIP</th>
                    <th style="padding: 10px 8px; text-align: center; font-size: 11px; width: 70px;">PROB.</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>

        <div style="background: #263238; color: white; padding: 12px 16px; border-radius: 0 0 12px 12px;">
            <div style="font-size: 11px; opacity: 0.7; text-align: center;">
                Generat automat de API SMART 5 • Sortat după probabilitate istorică • Doar informativ
            </div>
        </div>
    </div>`;
}

/**
 * Trimite emailul TOP 30 prematch
 */
async function sendTop30PreMatchEmail() {
    const today = new Date().toISOString().split('T')[0];
    const streaksFile = path.join(__dirname, 'data', `pre_match_streaks_${today}.json`);

    if (!fs.existsSync(streaksFile)) {
        logger.info('   🏆 Nu există fișier pre-match streaks pentru TOP 30');
        return false;
    }

    let data;
    try {
        data = JSON.parse(fs.readFileSync(streaksFile, 'utf8'));
    } catch (e) {
        logger.error(`   ❌ Eroare citire pre-match streaks (TOP 30): ${e.message}`);
        return false;
    }

    const top30 = getTop30Predictions(data);
    if (top30.length === 0) {
        logger.info('   🏆 Niciun pronostic disponibil pentru TOP 30');
        return false;
    }

    const html = formatTop30Email(top30);
    const maxRate = top30[0].rate;
    const minRate = top30[top30.length - 1].rate;

    try {
        const result = await emailService.send({
            subject: `🏆 ZILNIC TOP 30 PREMATCH ${today}: ${top30.length} pronosticuri (${maxRate}% - ${minRate}%)`,
            html: html
        });

        if (result.success) {
            logger.info(`   🏆 Email TOP 30 prematch trimis: ${top30.length} pronosticuri (${maxRate}% - ${minRate}%)`);

            // Trimite la abonați
            try {
                const { notifyAll } = require('./SUBSCRIBER_MANAGER');
                for (const a of top30) {
                    await notifyAll('prematch', {
                        matchId: a.matchId,
                        homeTeam: a.homeTeam,
                        awayTeam: a.awayTeam,
                        league: a.liga,
                        pattern: a.patternId,
                        probability: a.rate,
                        label: a.label,
                        date: today,
                    });
                }
            } catch (subErr) {
                logger.debug(`   ⚠️  Subscriber prematch: ${subErr.message}`);
            }

            // Salvează predicțiile TOP 30 în tracker pentru validare automată
            // Grupează alertele pe matchId pentru formatul așteptat de PrematchTracker
            const matchGroups = {};
            for (const a of top30) {
                if (!matchGroups[a.matchId]) {
                    matchGroups[a.matchId] = {
                        matchId: a.matchId,
                        matchData: {
                            homeTeam: a.homeTeam,
                            awayTeam: a.awayTeam,
                            liga: a.liga,
                            ora: a.ora,
                            timestamp: data.matches[a.matchId] ? data.matches[a.matchId].timestamp : null
                        },
                        alerts: []
                    };
                }
                matchGroups[a.matchId].alerts.push({ ...a, source: 'top30' });
            }
            const saved = PrematchTracker.saveDailyPredictions(Object.values(matchGroups));
            logger.info(`   🏆 ${saved} predicții TOP 30 salvate în prematch_tracking.json`);
        }
        return result.success;
    } catch (e) {
        logger.error(`   ❌ Eroare email TOP 30 prematch: ${e.message}`);
        return false;
    }
}

// ============================================================
// RAPORT VALIDARE — "Biletul de ieri" cu rezultate
// ============================================================

const TOP30_REPORT_SENT_FILE = path.join(__dirname, 'data', 'prematch_top30_report_sent.json');

function isTop30ReportSent() {
    try {
        if (fs.existsSync(TOP30_REPORT_SENT_FILE)) {
            const sent = JSON.parse(fs.readFileSync(TOP30_REPORT_SENT_FILE, 'utf8'));
            const today = new Date().toISOString().split('T')[0];
            return sent.date === today;
        }
    } catch (e) {}
    return false;
}

function markTop30ReportSent() {
    const today = new Date().toISOString().split('T')[0];
    fs.writeFileSync(TOP30_REPORT_SENT_FILE, JSON.stringify({ date: today, sentAt: new Date().toISOString() }, null, 2), 'utf8');
}

/**
 * Generează HTML pentru emailul de raport validare TOP 30
 */
function formatTop30ReportEmail(predictions, yesterdayStr) {
    const won = predictions.filter(p => p.validation_result === 'won');
    const lost = predictions.filter(p => p.validation_result === 'lost');
    const unknown = predictions.filter(p => !p.validated || p.validation_result === 'unknown');
    const total = won.length + lost.length;
    const winRate = total > 0 ? Math.round((won.length / total) * 100) : 0;

    const yesterday = new Date(yesterdayStr + 'T12:00:00');
    const dateStr = yesterday.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // Emoji și culoare header bazate pe winRate
    let headerEmoji, headerColor1, headerColor2, verdictText;
    if (winRate >= 95) {
        headerEmoji = '🏆'; headerColor1 = '#2e7d32'; headerColor2 = '#1b5e20'; verdictText = 'EXCELENT';
    } else if (winRate >= 90) {
        headerEmoji = '✅'; headerColor1 = '#1565c0'; headerColor2 = '#0d47a1'; verdictText = 'BINE';
    } else if (winRate >= 85) {
        headerEmoji = '⚠️'; headerColor1 = '#e65100'; headerColor2 = '#bf360c'; verdictText = 'MEDIOCRU';
    } else if (winRate >= 70) {
        headerEmoji = '📉'; headerColor1 = '#d84315'; headerColor2 = '#bf360c'; verdictText = 'SLAB';
    } else {
        headerEmoji = '❌'; headerColor1 = '#c62828'; headerColor2 = '#b71c1c'; verdictText = 'FOARTE SLAB';
    }

    let rows = '';
    for (let i = 0; i < predictions.length; i++) {
        const p = predictions[i];
        const rank = i + 1;
        const isWon = p.validation_result === 'won';
        const isLost = p.validation_result === 'lost';
        const isPending = !p.validated || p.validation_result === 'unknown';

        let statusIcon, statusText, bgColor, statusColor;
        if (isWon) {
            statusIcon = '✅'; statusText = 'WON'; bgColor = '#e8f5e9'; statusColor = '#2e7d32';
        } else if (isLost) {
            statusIcon = '❌'; statusText = 'LOST'; bgColor = '#ffebee'; statusColor = '#c62828';
        } else {
            statusIcon = '⏳'; statusText = 'N/A'; bgColor = '#fff8e1'; statusColor = '#f57f17';
        }

        // Extrage predicția scurtă din label
        let shortPrediction = '';
        if (p.label) {
            const probMatch = p.label.match(/→\s*prob\.\s*(.+?)(?:\s*—|$)/);
            shortPrediction = probMatch ? probMatch[1].trim() : p.category;
        } else {
            shortPrediction = p.category;
        }

        // Rezultat real
        let resultInfo = '';
        if (p.result && p.result.matchScore) {
            resultInfo = `Scor: ${p.result.matchScore}`;
            if (p.result.actualValue !== undefined) {
                resultInfo += ` | ${p.result.statType}: ${p.result.actualValue} (necesar: ${p.result.requiredValue}+)`;
            }
        }

        const isMatchLevel = (p.category || '').includes('TOTAL MECI') || (p.category || '').includes('OVER TOTAL');
        const sideIcon = isMatchLevel ? '⚽' : (p.side === 'gazda' ? '🏠' : '✈️');
        const teamDisplay = isMatchLevel ? `${p.homeTeam} vs ${p.awayTeam}` : p.team;

        rows += `
        <tr style="background-color: ${bgColor}; border-bottom: 1px solid #e0e0e0;">
            <td style="padding: 8px 6px; text-align: center; font-size: 12px; width: 30px; color: #999;">${rank}</td>
            <td style="padding: 8px 6px; text-align: center; font-size: 18px; width: 35px;">${statusIcon}</td>
            <td style="padding: 8px 6px;">
                <div style="font-weight: 600; font-size: 12px; color: #333;">
                    ${sideIcon} ${teamDisplay}
                </div>
                <div style="font-size: 11px; color: #666; margin-top: 2px;">
                    ${p.homeTeam} vs ${p.awayTeam} • ${p.ora}
                </div>
                <div style="font-size: 10px; color: #999; margin-top: 1px;">${p.liga}</div>
            </td>
            <td style="padding: 8px 6px;">
                <div style="font-size: 10px; color: #888; text-transform: uppercase;">${p.category}</div>
                <div style="font-size: 11px; color: #333; font-weight: 600;">${shortPrediction}</div>
            </td>
            <td style="padding: 8px 6px; text-align: center;">
                <div style="font-size: 14px; font-weight: 700; color: ${statusColor};">${p.rate}%</div>
            </td>
            <td style="padding: 8px 6px; text-align: center;">
                <div style="font-size: 13px; font-weight: 700; color: ${statusColor};">${statusText}</div>
                ${resultInfo ? `<div style="font-size: 9px; color: #999; margin-top: 2px;">${resultInfo}</div>` : ''}
            </td>
        </tr>`;
    }

    return `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, ${headerColor1}, ${headerColor2}); color: white; padding: 20px; border-radius: 12px 12px 0 0;">
            <h2 style="margin: 0; font-size: 22px;">${headerEmoji} BILETUL DE IERI — REZULTATE</h2>
            <div style="font-size: 14px; opacity: 0.9; margin-top: 8px;">${dateStr}</div>
            <div style="margin-top: 12px; display: flex; gap: 20px; font-size: 15px;">
                <span>✅ <strong>${won.length}</strong> câștigate</span>
                <span>❌ <strong>${lost.length}</strong> pierdute</span>
                ${unknown.length > 0 ? `<span>⏳ <strong>${unknown.length}</strong> neverificate</span>` : ''}
            </div>
            <div style="margin-top: 8px; font-size: 20px; font-weight: bold;">
                Win rate: ${winRate}% — ${verdictText}
            </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; background: white;">
            <thead>
                <tr style="background-color: #263238; color: white;">
                    <th style="padding: 8px 6px; font-size: 10px; width: 30px;">#</th>
                    <th style="padding: 8px 6px; font-size: 10px; width: 35px;"></th>
                    <th style="padding: 8px 6px; text-align: left; font-size: 10px;">MECI</th>
                    <th style="padding: 8px 6px; text-align: left; font-size: 10px;">PREDICȚIE</th>
                    <th style="padding: 8px 6px; text-align: center; font-size: 10px; width: 50px;">PROB.</th>
                    <th style="padding: 8px 6px; text-align: center; font-size: 10px; width: 60px;">REZULTAT</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>

        <div style="background: ${headerColor2}; color: white; padding: 14px 16px; border-radius: 0 0 12px 12px;">
            <div style="font-size: 12px; opacity: 0.8; text-align: center;">
                Generat automat de API SMART 5 • Validare bazată pe statisticile finale ale meciului
            </div>
        </div>
    </div>`;
}

/**
 * Trimite emailul de raport validare TOP 30 de ieri
 */
async function sendTop30ValidationReport() {
    if (isTop30ReportSent()) {
        logger.info('   📋 Raport TOP 30 de ieri deja trimis azi');
        return false;
    }

    const predictions = PrematchTracker.getYesterdayAll();
    if (predictions.length === 0) {
        logger.info('   📋 Nu există predicții prematch de ieri');
        return false;
    }

    // Verifică dacă au fost validate (minim 50% validate)
    const validatedCount = predictions.filter(p => p.validated && p.validation_result !== 'unknown').length;
    if (validatedCount < predictions.length * 0.5) {
        logger.info(`   📋 Predicții TOP 30 de ieri: doar ${validatedCount}/${predictions.length} validate — așteptăm`);
        return false;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const won = predictions.filter(p => p.validation_result === 'won').length;
    const lost = predictions.filter(p => p.validation_result === 'lost').length;
    const total = won + lost;
    const winRate = total > 0 ? Math.round((won / total) * 100) : 0;

    const html = formatTop30ReportEmail(predictions, yesterdayStr);

    try {
        const result = await emailService.send({
            subject: `📋 BILETUL DE IERI ${yesterdayStr}: ${won}/${total} câștigate (${winRate}%) — ${predictions.length} pronosticuri`,
            html: html
        });

        if (result.success) {
            markTop30ReportSent();
            logger.info(`   📋 Raport TOP 30 trimis: ${won}W/${lost}L din ${total} (${winRate}%)`);
        }
        return result.success;
    } catch (e) {
        logger.error(`   ❌ Eroare raport TOP 30: ${e.message}`);
        return false;
    }
}

// ============================================================
// EMAIL ZILNIC: TOP 20 GOL MARCAT + TOP 20 CARTONAȘ GALBEN
// ============================================================

const GOALS_CARDS_SENT_FILE = path.join(__dirname, 'data', 'prematch_goals_cards_sent.json');

function isGoalsCardsSent() {
    try {
        if (fs.existsSync(GOALS_CARDS_SENT_FILE)) {
            const sent = JSON.parse(fs.readFileSync(GOALS_CARDS_SENT_FILE, 'utf8'));
            const today = new Date().toISOString().split('T')[0];
            return sent.date === today;
        }
    } catch (e) {}
    return false;
}

function markGoalsCardsSent() {
    const today = new Date().toISOString().split('T')[0];
    fs.writeFileSync(GOALS_CARDS_SENT_FILE, JSON.stringify({ date: today, sentAt: new Date().toISOString() }, null, 2), 'utf8');
}

/**
 * Extrage top echipe pentru gol marcat și cartonaș galben din pre-match streaks
 */
function getGoalsAndCardsPredictions(data) {
    const goalAlerts = [];   // S01, S02 — echipa marchează gol
    const cardAlerts = [];   // S21, S22 — echipa primește cartonaș

    for (const [matchId, matchData] of Object.entries(data.matches)) {
        for (const alert of matchData.alerts) {
            const entry = {
                ...alert,
                matchId,
                homeTeam: matchData.homeTeam,
                awayTeam: matchData.awayTeam,
                liga: matchData.liga,
                ora: matchData.ora,
                matchTimestamp: matchData.timestamp
            };

            if (alert.patternId === 'S01' || alert.patternId === 'S02') {
                goalAlerts.push(entry);
            } else if (alert.patternId === 'S21' || alert.patternId === 'S22') {
                cardAlerts.push(entry);
            }
        }
    }

    // Sortează după probabilitate descrescător, apoi după total cazuri
    goalAlerts.sort((a, b) => b.rate !== a.rate ? b.rate - a.rate : b.total - a.total);
    cardAlerts.sort((a, b) => b.rate !== a.rate ? b.rate - a.rate : b.total - a.total);

    // Deduplică: o singură intrare per echipă (cea mai bună)
    const seenGoals = new Set();
    const uniqueGoals = goalAlerts.filter(a => {
        const key = a.team + '|' + a.matchId;
        if (seenGoals.has(key)) return false;
        seenGoals.add(key);
        return true;
    });

    const seenCards = new Set();
    const uniqueCards = cardAlerts.filter(a => {
        const key = a.team + '|' + a.matchId;
        if (seenCards.has(key)) return false;
        seenCards.add(key);
        return true;
    });

    return {
        goals: uniqueGoals.slice(0, 20),
        cards: uniqueCards.slice(0, 20)
    };
}

/**
 * Generează HTML pentru emailul gol marcat + cartonaș
 */
function formatGoalsCardsEmail(goals, cards) {
    const today = new Date().toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    function renderTable(items, title, icon, color) {
        let rows = '';
        for (let i = 0; i < items.length; i++) {
            const a = items[i];
            const rank = i + 1;
            const bgColor = rank <= 3 ? '#fff8e1' : (rank % 2 === 0 ? '#f8f9fa' : '#ffffff');
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank;
            const isML = (a.category || '').includes('TOTAL MECI') || (a.category || '').includes('OVER TOTAL');
            const sideIcon = isML ? '⚽' : (a.side === 'gazda' ? '🏠' : '✈️');
            const teamDisp = isML ? (a.homeTeam + ' vs ' + a.awayTeam) : a.team;

            rows += '<tr style="background-color:' + bgColor + ';border-bottom:1px solid #e0e0e0;">' +
                '<td style="padding:8px;text-align:center;font-weight:bold;width:40px;">' + medal + '</td>' +
                '<td style="padding:8px;">' +
                    '<div style="font-weight:600;font-size:13px;">' + sideIcon + ' ' + teamDisp + '</div>' +
                    '<div style="font-size:11px;color:#666;">' + a.homeTeam + ' vs ' + a.awayTeam + ' • ' + a.ora + '</div>' +
                    '<div style="font-size:10px;color:#999;">' + a.liga + '</div>' +
                '</td>' +
                '<td style="padding:8px;text-align:center;font-size:11px;color:#555;">' + a.patternId + '<br>serie ' + (a.streak || a.streakUsed || '?') + ' meciuri</td>' +
                '<td style="padding:8px;text-align:center;font-weight:bold;font-size:14px;color:' + color + ';">' + a.rate.toFixed(1) + '%</td>' +
                '</tr>';
        }

        return '<div style="margin-bottom:25px;">' +
            '<div style="background:' + color + ';color:white;padding:12px 15px;border-radius:8px 8px 0 0;">' +
            '<h2 style="margin:0;font-size:18px;">' + icon + ' ' + title + ' (' + items.length + ' sugestii)</h2></div>' +
            '<table style="width:100%;border-collapse:collapse;">' +
            '<thead><tr style="background:#e8eaf6;">' +
            '<th style="padding:8px;width:40px;">#</th>' +
            '<th style="padding:8px;text-align:left;">Echipă / Meci</th>' +
            '<th style="padding:8px;">Pattern</th>' +
            '<th style="padding:8px;">Prob.</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    return '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:10px;">' +
        '<div style="background:linear-gradient(135deg,#1b5e20,#2e7d32);color:white;padding:20px;border-radius:10px;text-align:center;margin-bottom:20px;">' +
        '<h1 style="margin:0;">⚽🟨 SUGESTII ZILNICE</h1>' +
        '<p style="margin:5px 0 0;opacity:0.9;">' + today + '</p></div>' +
        renderTable(goals, 'GOL MARCAT — echipa marchează minim 1 gol', '⚽', '#2e7d32') +
        renderTable(cards, 'CARTONAȘ GALBEN — echipa primește minim 1 cartonaș', '🟨', '#f57f17') +
        '<div style="background:#f5f5f5;padding:12px;text-align:center;border-radius:8px;margin-top:10px;">' +
        '<p style="margin:0;color:#999;font-size:11px;">Bazat pe serii consecutive istorice (S01/S02 goluri, S21/S22 cartonașe)</p></div>' +
        '</body></html>';
}

/**
 * Trimite emailul zilnic cu sugestii gol marcat + cartonaș galben
 */
async function sendGoalsCardsEmail() {
    if (isGoalsCardsSent()) {
        logger.info('   ⚽🟨 Email goluri+cartonașe deja trimis azi');
        return false;
    }

    const today = new Date().toISOString().split('T')[0];
    const streaksFile = path.join(__dirname, 'data', 'pre_match_streaks_' + today + '.json');

    if (!fs.existsSync(streaksFile)) {
        logger.info('   ⚽🟨 Nu există fișier pre-match streaks pentru azi');
        return false;
    }

    const data = JSON.parse(fs.readFileSync(streaksFile, 'utf8'));
    const { goals, cards } = getGoalsAndCardsPredictions(data);

    if (goals.length === 0 && cards.length === 0) {
        logger.info('   ⚽🟨 Nicio sugestie gol/cartonaș disponibilă');
        return false;
    }

    const html = formatGoalsCardsEmail(goals, cards);

    try {
        const result = await emailService.send({
            subject: '⚽🟨 SUGESTII ' + today + ': ' + goals.length + ' goluri + ' + cards.length + ' cartonașe (max ' + Math.max(...goals.map(g => g.rate), ...cards.map(c => c.rate)).toFixed(1) + '%)',
            html: html
        });

        if (result.success) {
            markGoalsCardsSent();
            logger.info('   ⚽🟨 Email goluri+cartonașe trimis: ' + goals.length + ' goluri, ' + cards.length + ' cartonașe');
        }
        return result.success;
    } catch (e) {
        logger.error('   ❌ Eroare email goluri+cartonașe: ' + e.message);
        return false;
    }
}

module.exports = { generatePreMatchStreaks, checkAndSendPreMatchEmails, sendDailyPreMatchEmail, sendTop30PreMatchEmail, sendTop30ValidationReport, sendGoalsCardsEmail };
