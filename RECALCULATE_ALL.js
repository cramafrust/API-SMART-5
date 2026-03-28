#!/usr/bin/env node
/**
 * RECALCULATE_ALL.js — Recalculare completă probabilități pe 3+ ani de date
 *
 * O singură trecere prin datele de sezon, 6 module de calcul.
 * Generează:
 *   1. data/procente/JSON PROCENTE AUTOACTUAL.json  — Probabilități HT (90 pattern-uri × ligi × tier-uri)
 *   2. data/streak_patterns_catalog.json             — S01-S22 catalog (22 pattern-uri × serii 3-7W)
 *   3. data/scoring_streak_probabilities.json        — 2+ goluri consecutive → prob 1+ gol (3-5W)
 *   4. data/goal_streak_probabilities.json           — 1+ gol consecutiv → prob 1+ gol (5-10W)
 *   5. data/yellow_cards_streak_probabilities.json   — 3+ cartonașe consecutive → prob 2+/3+ (3-5W)
 *   6. data/yellow_cards_2plus_streak_probabilities.json — 2+ cartonașe consecutive → prob 1+/2+ (3-7W)
 *
 * Rulare: node RECALCULATE_ALL.js
 */

const fs = require('fs');
const path = require('path');
const PatternChecker = require('./pattern-checker');

// ============================================================
// PATHS
// ============================================================
const BASE_DIR = __dirname;
const SEASONS_DIR = path.join(BASE_DIR, 'data', 'seasons');
const DATA_DIR = path.join(BASE_DIR, 'data');

const OUTPUT_FILES = {
    procente: path.join(DATA_DIR, 'procente', 'JSON PROCENTE AUTOACTUAL.json'),
    procenteRoot: path.join(BASE_DIR, 'JSON PROCENTE AUTOACTUAL.json'),
    streakCatalog: path.join(DATA_DIR, 'streak_patterns_catalog.json'),
    scoringStreak: path.join(DATA_DIR, 'scoring_streak_probabilities.json'),
    goalStreak: path.join(DATA_DIR, 'goal_streak_probabilities.json'),
    yellowCards: path.join(DATA_DIR, 'yellow_cards_streak_probabilities.json'),
    yellowCards2plus: path.join(DATA_DIR, 'yellow_cards_2plus_streak_probabilities.json')
};

// ============================================================
// TIER CONFIGS (din GENERATE_ALL_PROCENTE.js)
// ============================================================
const TIER_CONFIGS = {
    'standard_18-20': {
        tiers: ['TOP_1-5', 'MID_6-10', 'LOW_11-15', 'BOTTOM_16-20'],
        getTier: (pos, total) => {
            if (pos >= 1 && pos <= 5) return 'TOP_1-5';
            if (pos >= 6 && pos <= 10) return 'MID_6-10';
            if (pos >= 11 && pos <= 15) return 'LOW_11-15';
            return 'BOTTOM_16-20';
        },
        categories: [
            { nume: "TOP_1-5", pozitii: "1-5", description: "Primele 5 echipe din clasament" },
            { nume: "MID_6-10", pozitii: "6-10", description: "Echipe de la poziția 6 la 10" },
            { nume: "LOW_11-15", pozitii: "11-15", description: "Echipe de la poziția 11 la 15" },
            { nume: "BOTTOM_16-20", pozitii: "16-20", description: "Ultimele echipe (16-20)" }
        ]
    },
    'standard_18': {
        tiers: ['TOP_1-5', 'MID_6-10', 'LOW_11-15', 'BOTTOM_16-18'],
        getTier: (pos, total) => {
            if (pos >= 1 && pos <= 5) return 'TOP_1-5';
            if (pos >= 6 && pos <= 10) return 'MID_6-10';
            if (pos >= 11 && pos <= 15) return 'LOW_11-15';
            return 'BOTTOM_16-18';
        },
        categories: [
            { nume: "TOP_1-5", pozitii: "1-5", description: "Primele 5 echipe din clasament" },
            { nume: "MID_6-10", pozitii: "6-10", description: "Echipe de la poziția 6 la 10" },
            { nume: "LOW_11-15", pozitii: "11-15", description: "Echipe de la poziția 11 la 15" },
            { nume: "BOTTOM_16-18", pozitii: "16-18", description: "Ultimele 3 echipe" }
        ]
    },
    'standard_12-16': {
        tiers: ['TOP_1-4', 'MID_5-8', 'LOW_9-12', 'BOTTOM_13-16'],
        getTier: (pos, total) => {
            const q = Math.ceil(total / 4);
            if (pos <= q) return 'TOP_1-4';
            if (pos <= q * 2) return 'MID_5-8';
            if (pos <= q * 3) return 'LOW_9-12';
            return 'BOTTOM_13-16';
        },
        categories: [
            { nume: "TOP_1-4", pozitii: "1-4", description: "Primele echipe" },
            { nume: "MID_5-8", pozitii: "5-8", description: "Echipe de mijloc superior" },
            { nume: "LOW_9-12", pozitii: "9-12", description: "Echipe de mijloc inferior" },
            { nume: "BOTTOM_13-16", pozitii: "13-16", description: "Ultimele echipe" }
        ]
    },
    'denmark': {
        tiers: ['TOP_1-3', 'MID_4-6', 'LOW_7-9', 'BOTTOM_10-12'],
        getTier: (pos, total) => {
            if (pos >= 1 && pos <= 3) return 'TOP_1-3';
            if (pos >= 4 && pos <= 6) return 'MID_4-6';
            if (pos >= 7 && pos <= 9) return 'LOW_7-9';
            return 'BOTTOM_10-12';
        },
        categories: [
            { nume: "TOP_1-3", pozitii: "1-3", description: "Primele 3 echipe" },
            { nume: "MID_4-6", pozitii: "4-6", description: "Echipe de la poziția 4 la 6" },
            { nume: "LOW_7-9", pozitii: "7-9", description: "Echipe de la poziția 7 la 9" },
            { nume: "BOTTOM_10-12", pozitii: "10-12", description: "Ultimele 3 echipe" }
        ]
    },
    'champions_league': {
        tiers: ['TOP_1-8', 'MID_9-24', 'BOTTOM_25-36'],
        getTier: (pos, total) => {
            if (pos >= 1 && pos <= 8) return 'TOP_1-8';
            if (pos >= 9 && pos <= 24) return 'MID_9-24';
            return 'BOTTOM_25-36';
        },
        categories: [
            { nume: "TOP_1-8", pozitii: "1-8", description: "Direct în optimi" },
            { nume: "MID_9-24", pozitii: "9-24", description: "Play-off pentru optimi" },
            { nume: "BOTTOM_25-36", pozitii: "25-36", description: "Eliminate" }
        ]
    }
};

const LEAGUE_TIER_MAP = {
    'Premier League': 'standard_18-20',
    'La Liga': 'standard_18-20',
    'Serie A': 'standard_18-20',
    'Bundesliga': 'standard_18-20',
    'Ligue 1': 'standard_18-20',
    'Eredivisie': 'standard_18-20',
    'Primeira Liga': 'standard_18',
    'Austria': 'standard_12-16',
    'Superliga': 'denmark',
    'Champions League': 'champions_league',
    'Europa League': 'champions_league',
    'Conference League': 'champions_league'
};

// ============================================================
// S01-S22 PATTERN DEFINITIONS (din PRE_MATCH_STREAKS.js)
// ============================================================
const STREAK_PATTERNS = [
    { id: 'S01', category: 'GOLURI', condition: '2+ goluri marcate', nextCondition: '1+ gol',
      getStat: (m, h) => { if (!m.scor) return null; return h ? m.scor.final_gazda : m.scor.final_oaspete; },
      threshold: 2, nextThreshold: 1, minStreak: 3 },
    { id: 'S02', category: 'GOLURI', condition: '1+ gol marcat', nextCondition: '1+ gol',
      getStat: (m, h) => { if (!m.scor) return null; return h ? m.scor.final_gazda : m.scor.final_oaspete; },
      threshold: 1, nextThreshold: 1, minStreak: 5 },
    { id: 'S03', category: 'GOLURI PRIMITE', condition: '1+ gol primit', nextCondition: '1+ gol primit',
      getStat: (m, h) => { if (!m.scor) return null; return h ? m.scor.final_oaspete : m.scor.final_gazda; },
      threshold: 1, nextThreshold: 1, minStreak: 3 },
    { id: 'S04', category: 'GOLURI PRIMITE', condition: '2+ goluri primite', nextCondition: '1+ gol primit',
      getStat: (m, h) => { if (!m.scor) return null; return h ? m.scor.final_oaspete : m.scor.final_gazda; },
      threshold: 2, nextThreshold: 1, minStreak: 3 },
    { id: 'S05', category: 'GOLURI R1', condition: '1+ gol R1', nextCondition: '1+ gol R1',
      getStat: (m, h) => { if (!m.scor) return null; return h ? m.scor.pauza_gazda : m.scor.pauza_oaspete; },
      threshold: 1, nextThreshold: 1, minStreak: 3 },
    { id: 'S06', category: 'OVER', condition: '3+ goluri total', nextCondition: '2+ goluri total',
      getStat: (m, h) => { if (!m.scor) return null; return m.scor.final_gazda + m.scor.final_oaspete; },
      threshold: 3, nextThreshold: 2, minStreak: 3 },
    { id: 'S07', category: 'CORNERE', condition: '4+ cornere', nextCondition: '4+ cornere',
      getStat: (m, h) => { const c = m.statistici && m.statistici.cornere; if (!c) return null; return h ? c.total_gazda : c.total_oaspete; },
      threshold: 4, nextThreshold: 4, minStreak: 3 },
    { id: 'S08', category: 'CORNERE', condition: '4+ cornere', nextCondition: '3+ cornere',
      getStat: (m, h) => { const c = m.statistici && m.statistici.cornere; if (!c) return null; return h ? c.total_gazda : c.total_oaspete; },
      threshold: 4, nextThreshold: 3, minStreak: 3 },
    { id: 'S09', category: 'CORNERE', condition: '5+ cornere', nextCondition: '3+ cornere',
      getStat: (m, h) => { const c = m.statistici && m.statistici.cornere; if (!c) return null; return h ? c.total_gazda : c.total_oaspete; },
      threshold: 5, nextThreshold: 3, minStreak: 3 },
    { id: 'S10', category: 'CORNERE', condition: '5+ cornere', nextCondition: '5+ cornere',
      getStat: (m, h) => { const c = m.statistici && m.statistici.cornere; if (!c) return null; return h ? c.total_gazda : c.total_oaspete; },
      threshold: 5, nextThreshold: 5, minStreak: 3 },
    { id: 'S11', category: 'ȘUTURI PE POARTĂ', condition: '4+ șuturi pe poartă', nextCondition: '4+ șuturi pe poartă',
      getStat: (m, h) => { const s = m.statistici && m.statistici.suturi_pe_poarta; if (!s) return null; return h ? s.total_gazda : s.total_oaspete; },
      threshold: 4, nextThreshold: 4, minStreak: 3 },
    { id: 'S12', category: 'ȘUTURI PE POARTĂ', condition: '4+ șuturi pe poartă', nextCondition: '3+ șuturi pe poartă',
      getStat: (m, h) => { const s = m.statistici && m.statistici.suturi_pe_poarta; if (!s) return null; return h ? s.total_gazda : s.total_oaspete; },
      threshold: 4, nextThreshold: 3, minStreak: 3 },
    { id: 'S13', category: 'ȘUTURI PE POARTĂ', condition: '5+ șuturi pe poartă', nextCondition: '3+ șuturi pe poartă',
      getStat: (m, h) => { const s = m.statistici && m.statistici.suturi_pe_poarta; if (!s) return null; return h ? s.total_gazda : s.total_oaspete; },
      threshold: 5, nextThreshold: 3, minStreak: 3 },
    { id: 'S14', category: 'ȘUTURI PE POARTĂ', condition: '6+ șuturi pe poartă', nextCondition: '4+ șuturi pe poartă',
      getStat: (m, h) => { const s = m.statistici && m.statistici.suturi_pe_poarta; if (!s) return null; return h ? s.total_gazda : s.total_oaspete; },
      threshold: 6, nextThreshold: 4, minStreak: 3 },
    { id: 'S15', category: 'TOTAL ȘUTURI', condition: '10+ șuturi total', nextCondition: '10+ șuturi total',
      getStat: (m, h) => { const s = m.statistici && m.statistici.total_suturi; if (!s) return null; return h ? s.total_gazda : s.total_oaspete; },
      threshold: 10, nextThreshold: 10, minStreak: 3 },
    { id: 'S16', category: 'TOTAL ȘUTURI', condition: '12+ șuturi total', nextCondition: '10+ șuturi total',
      getStat: (m, h) => { const s = m.statistici && m.statistici.total_suturi; if (!s) return null; return h ? s.total_gazda : s.total_oaspete; },
      threshold: 12, nextThreshold: 10, minStreak: 3 },
    { id: 'S17', category: 'TOTAL ȘUTURI', condition: '12+ șuturi total', nextCondition: '10+ șuturi total',
      getStat: (m, h) => { const s = m.statistici && m.statistici.total_suturi; if (!s) return null; return h ? s.total_gazda : s.total_oaspete; },
      threshold: 12, nextThreshold: 10, minStreak: 3 },
    { id: 'S18', category: 'FAULTURI', condition: '10+ faulturi', nextCondition: '11+ faulturi',
      getStat: (m, h) => { const f = m.statistici && m.statistici.faulturi; if (!f) return null; return h ? f.total_gazda : f.total_oaspete; },
      threshold: 10, nextThreshold: 11, minStreak: 3 },
    { id: 'S19', category: 'FAULTURI', condition: '10+ faulturi', nextCondition: '11+ faulturi',
      getStat: (m, h) => { const f = m.statistici && m.statistici.faulturi; if (!f) return null; return h ? f.total_gazda : f.total_oaspete; },
      threshold: 10, nextThreshold: 11, minStreak: 3 },
    { id: 'S20', category: 'FAULTURI', condition: '12+ faulturi', nextCondition: '11+ faulturi',
      getStat: (m, h) => { const f = m.statistici && m.statistici.faulturi; if (!f) return null; return h ? f.total_gazda : f.total_oaspete; },
      threshold: 12, nextThreshold: 11, minStreak: 3 },
    { id: 'S21', category: 'CARTONAȘE', condition: '2+ cartonașe galbene', nextCondition: '2+ cartonașe galbene',
      getStat: (m, h) => { const yc = m.statistici && m.statistici.cartonase_galbene; if (!yc) return null; return h ? yc.total_gazda : yc.total_oaspete; },
      threshold: 2, nextThreshold: 2, minStreak: 3 },
    { id: 'S22', category: 'CARTONAȘE', condition: '2+ cartonașe galbene', nextCondition: '1+ cartonaș galben',
      getStat: (m, h) => { const yc = m.statistici && m.statistici.cartonase_galbene; if (!yc) return null; return h ? yc.total_gazda : yc.total_oaspete; },
      threshold: 2, nextThreshold: 1, minStreak: 3 },
];

// ============================================================
// INFRASTRUCTURE
// ============================================================

function normalizeName(name) {
    if (!name) return '';
    let n = name.toLowerCase().trim().replace(/\s+/g, ' ');
    const prefixes = ['fc ', 'fk ', 'cs ', 'csm ', 'fcv ', 'fcs ', 'afc ', 'sc ', 'as ', 'ac ', 'cf '];
    for (const p of prefixes) { if (n.startsWith(p)) n = n.substring(p.length); }
    const suffixes = [' fc', ' fk', ' cs'];
    for (const s of suffixes) { if (n.endsWith(s)) n = n.substring(0, n.length - s.length); }
    return n.trim();
}

function normalizeForGrouping(name) {
    let normalized = name
        .replace(/\s*\d{4}(-\d{4})?\s*/g, '')
        .replace(/\s*-\s*$/, '')
        .trim();

    // Consolidare competiții UEFA — toate variantele la un singur key
    const uefaMap = {
        'EUROPE: Champions League': 'UEFA Champions League',
        'UEFA Champions League': 'UEFA Champions League',
        'EUROPE: Champions League - Play Offs': 'UEFA Champions League',
        'EUROPE: Champions League - League phase': 'UEFA Champions League',
        'EUROPE: Champions League - Knockout Round Play-offs': 'UEFA Champions League',
        'EUROPE: Champions League - Round of 16': 'UEFA Champions League',
        'EUROPE: Champions League - Quarter-finals': 'UEFA Champions League',
        'EUROPE: Champions League - Semi-finals': 'UEFA Champions League',
        'EUROPE: Europa League': 'UEFA Europa League',
        'UEFA Europa League': 'UEFA Europa League',
        'EUROPE: Europa League - Play Offs': 'UEFA Europa League',
        'EUROPE: Europa League - League phase': 'UEFA Europa League',
        'EUROPE: Europa League - Knockout Round Play-offs': 'UEFA Europa League',
        'EUROPE: Conference League': 'UEFA Conference League',
        'EUROPE: Conference League - League phase': 'UEFA Conference League',
        'EUROPE: Conference League - Play Offs': 'UEFA Conference League',
        'EUROPE: Conference League - Knockout Round Play-offs': 'UEFA Conference League',
    };

    if (uefaMap[normalized]) {
        normalized = uefaMap[normalized];
    }

    // Consolidare Scotland MULTI cu intrarea principală
    if (normalized.includes('SCOTLANDPremiership_MULTI')) {
        normalized = 'SCOTLAND: Premiership';
    }

    return normalized;
}

/**
 * Încarcă TOATE fișierele sezon din data/seasons/, grupează per ligă, deduplică per id_meci
 */
function loadAllSeasons() {
    console.log('\n📂 Încărcare fișiere sezon...');

    const files = fs.readdirSync(SEASONS_DIR)
        .filter(f => f.endsWith('.json') && !f.includes('BACKUP') && !f.includes('CORRUPT')
            && !f.includes('pre-') && !f.includes('OLD_FORMAT') && !f.includes('backup')
            && !f.includes('MULTI') && !f.includes('SMART4'));

    console.log(`   📂 ${files.length} fișiere în data/seasons/`);

    const leagueGroups = {};
    let totalMeciuri = 0;

    for (const file of files) {
        try {
            const filePath = path.join(SEASONS_DIR, file);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

            if (!data.meciuri || data.meciuri.length === 0) continue;

            const leagueName = data.campionat?.nume_complet || data.campionat?.nume || 'Unknown';
            const groupKey = normalizeForGrouping(leagueName);

            if (!leagueGroups[groupKey]) {
                // Pentru competiții UEFA consolidate, folosim groupKey ca displayName
                const isUEFA = groupKey.startsWith('UEFA ');
                leagueGroups[groupKey] = {
                    displayName: isUEFA ? groupKey : leagueName,
                    country: isUEFA ? 'Europe' : (data.campionat?.tara || 'Unknown'),
                    campionat: data.campionat,
                    meciuri: [],
                    existingIds: new Set(),
                    sezoane: [],
                    files: []
                };
            }

            // Prefer display name cu format "COUNTRY: League" (dar nu suprascrie UEFA consolidat)
            const isUEFA = groupKey.startsWith('UEFA ');
            if (!isUEFA && leagueName.includes(':')) {
                leagueGroups[groupKey].displayName = leagueName;
                leagueGroups[groupKey].country = data.campionat?.tara || leagueGroups[groupKey].country;
                leagueGroups[groupKey].campionat = data.campionat;
            }

            let added = 0;
            for (const m of data.meciuri) {
                const id = m.id_meci || m.id_flashscore;
                if (id && leagueGroups[groupKey].existingIds.has(id)) continue;
                if (id) leagueGroups[groupKey].existingIds.add(id);
                leagueGroups[groupKey].meciuri.push(m);
                added++;
            }

            leagueGroups[groupKey].files.push(file);
            const sezon = data.campionat?.sezon || 'unknown';
            if (!leagueGroups[groupKey].sezoane.includes(sezon)) {
                leagueGroups[groupKey].sezoane.push(sezon);
            }
            totalMeciuri += added;

        } catch (error) {
            console.error(`   ❌ Eroare la ${file}: ${error.message}`);
        }
    }

    // Sortare cronologică meciuri per ligă
    for (const group of Object.values(leagueGroups)) {
        group.meciuri.sort((a, b) => {
            const dateA = a.data_ora ? a.data_ora.data : '';
            const dateB = b.data_ora ? b.data_ora.data : '';
            return dateA.localeCompare(dateB);
        });
        delete group.existingIds; // cleanup
    }

    console.log(`   ✅ ${files.length} fișiere → ${Object.keys(leagueGroups).length} ligi → ${totalMeciuri} meciuri unice`);
    return leagueGroups;
}

/**
 * Calculează clasament simulat din rezultate
 */
function getSimulatedStandings(meciuri) {
    const standings = {};

    meciuri.forEach(meci => {
        if (!meci.scor || meci.scor.final_gazda === undefined || meci.scor.final_gazda === null) return;

        const gazda = meci.echipa_gazda?.nume;
        const oaspete = meci.echipa_oaspete?.nume;
        if (!gazda || !oaspete) return;

        if (!standings[gazda]) standings[gazda] = { puncte: 0, jocuri: 0 };
        if (!standings[oaspete]) standings[oaspete] = { puncte: 0, jocuri: 0 };

        const golG = meci.scor.final_gazda;
        const golO = meci.scor.final_oaspete;

        standings[gazda].jocuri++;
        standings[oaspete].jocuri++;

        if (golG > golO) {
            standings[gazda].puncte += 3;
        } else if (golO > golG) {
            standings[oaspete].puncte += 3;
        } else {
            standings[gazda].puncte += 1;
            standings[oaspete].puncte += 1;
        }
    });

    return Object.entries(standings)
        .sort((a, b) => b[1].puncte - a[1].puncte)
        .map((entry, index) => ({
            echipa: entry[0],
            pozitie: index + 1,
            puncte: entry[1].puncte,
            jocuri: entry[1].jocuri
        }));
}

/**
 * Calculează clasament per-etapă: pentru fiecare meci, returnează poziția echipelor
 * la momentul DINAINTEA acelui meci (din meciurile jucate anterior).
 *
 * Returnează Map: matchId/index -> { teamName -> pozitie }
 */
function getPerMatchStandings(meciuri) {
    // Sortează meciurile cronologic
    const sorted = [...meciuri]
        .filter(m => m.scor && m.scor.final_gazda !== undefined && m.scor.final_gazda !== null)
        .sort((a, b) => {
            const dateA = a.data_ora?.data || '9999-99-99';
            const dateB = b.data_ora?.data || '9999-99-99';
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            const oraA = a.data_ora?.ora || '00:00';
            const oraB = b.data_ora?.ora || '00:00';
            return oraA.localeCompare(oraB);
        });

    const standings = {};  // echipa -> { puncte, jocuri, golMarcate, golPrimite }
    const matchPositions = new Map();  // matchId -> { teamName -> pozitie }

    // Grupăm meciurile pe zile (meciurile din aceeași zi văd același clasament)
    let currentDate = null;
    let currentDayMatches = [];

    function getPositionMap() {
        const entries = Object.entries(standings);
        if (entries.length === 0) return {};
        entries.sort((a, b) => {
            if (b[1].puncte !== a[1].puncte) return b[1].puncte - a[1].puncte;
            const gdA = a[1].golMarcate - a[1].golPrimite;
            const gdB = b[1].golMarcate - b[1].golPrimite;
            if (gdB !== gdA) return gdB - gdA;
            return b[1].golMarcate - a[1].golMarcate;
        });
        const posMap = {};
        entries.forEach(([echipa], idx) => { posMap[echipa] = idx + 1; });
        return posMap;
    }

    function flushDay() {
        // Toate meciurile din ziua curentă primesc clasamentul de DINAINTE
        const posMap = getPositionMap();
        for (const meci of currentDayMatches) {
            const key = meci.id_meci || meci.id_flashscore || null;
            if (key) matchPositions.set(key, posMap);
        }
        // Acum actualizăm standings-ul cu rezultatele zilei
        for (const meci of currentDayMatches) {
            const gazda = meci.echipa_gazda?.nume;
            const oaspete = meci.echipa_oaspete?.nume;
            if (!gazda || !oaspete) continue;

            if (!standings[gazda]) standings[gazda] = { puncte: 0, jocuri: 0, golMarcate: 0, golPrimite: 0 };
            if (!standings[oaspete]) standings[oaspete] = { puncte: 0, jocuri: 0, golMarcate: 0, golPrimite: 0 };

            const golG = meci.scor.final_gazda;
            const golO = meci.scor.final_oaspete;

            standings[gazda].jocuri++;
            standings[oaspete].jocuri++;
            standings[gazda].golMarcate += golG;
            standings[gazda].golPrimite += golO;
            standings[oaspete].golMarcate += golO;
            standings[oaspete].golPrimite += golG;

            if (golG > golO) {
                standings[gazda].puncte += 3;
            } else if (golO > golG) {
                standings[oaspete].puncte += 3;
            } else {
                standings[gazda].puncte += 1;
                standings[oaspete].puncte += 1;
            }
        }
        currentDayMatches = [];
    }

    for (const meci of sorted) {
        const meciDate = meci.data_ora?.data || '9999-99-99';

        if (meciDate !== currentDate) {
            if (currentDayMatches.length > 0) flushDay();
            currentDate = meciDate;
        }
        currentDayMatches.push(meci);
    }
    // Flush ultimele meciuri
    if (currentDayMatches.length > 0) flushDay();

    return matchPositions;
}

/**
 * Determină configurația de tier-uri (4 nivele) pentru PROCENTE
 */
function getTierConfig(leagueName, numEchipe) {
    for (const [key, val] of Object.entries(LEAGUE_TIER_MAP)) {
        if (leagueName.toLowerCase().includes(key.toLowerCase())) {
            return TIER_CONFIGS[val];
        }
    }
    if (numEchipe <= 12) return TIER_CONFIGS['denmark'];
    if (numEchipe <= 16) return TIER_CONFIGS['standard_12-16'];
    if (numEchipe === 18) return TIER_CONFIGS['standard_18'];
    if (numEchipe >= 32) return TIER_CONFIGS['champions_league'];
    return TIER_CONFIGS['standard_18-20'];
}

/**
 * Tier simplu (3 nivele) pentru serii — TOP/MID/LOW
 */
function getSimpleTier(position, totalTeams) {
    if (!position || !totalTeams || totalTeams === 0) return 'MID';
    const third = totalTeams / 3;
    if (position <= third) return 'TOP';
    if (position <= third * 2) return 'MID';
    return 'LOW';
}

/**
 * Backup fișier existent
 */
function backupFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    const date = new Date().toISOString().split('T')[0];
    const backupPath = filePath.replace('.json', `.backup_${date}.json`);
    // Nu suprascrie backup-ul din aceeași zi
    if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(filePath, backupPath);
        console.log(`   💾 Backup: ${path.basename(backupPath)}`);
    }
}

// ============================================================
// MODULE 1: PROCENTE HT (pattern-checker)
// ============================================================

function generateProcente(leagueGroups) {
    console.log('\n' + '═'.repeat(70));
    console.log('📊 MODUL 1: Generare PROCENTE HT (PatternChecker)');
    console.log('═'.repeat(70));

    const procenteData = {
        versiune: "2.0",
        ultima_actualizare: "",
        total_campionate_analizate: 0,
        campionate: {}
    };

    let totalAnalizate = 0;
    let totalPatterns = 0;

    for (const [groupKey, group] of Object.entries(leagueGroups)) {
        const leagueName = group.displayName;
        const meciuri = group.meciuri;
        const numEchipe = group.campionat?.numar_echipe || 20;
        const tierConfig = getTierConfig(leagueName, numEchipe);

        // Clasament per-meci (poziția la momentul fiecărui meci, nu finală)
        const perMatchPositions = getPerMatchStandings(meciuri);
        // Fallback: clasament final (pentru meciuri fără id sau din primele etape)
        const clasamentFinal = getSimulatedStandings(meciuri);
        const pozitiFinalMap = {};
        clasamentFinal.forEach(entry => { pozitiFinalMap[entry.echipa] = entry.pozitie; });

        // Inițializează tier-uri
        const tiers = {};
        tierConfig.tiers.forEach(tier => { tiers[tier] = {}; });

        const patternChecker = new PatternChecker();
        let meciuriAnalizate = 0;
        let meciuriCuClasamentMomentan = 0;

        meciuri.forEach(meci => {
            if (!meci.statistici || !meci.scor) return;
            const stats = meci.statistici;
            if (!stats.suturi_pe_poarta || stats.suturi_pe_poarta.pauza_gazda === undefined) return;

            meciuriAnalizate++;

            // Verifică dacă meciul are clasament per-meci
            const _matchId = meci.id_meci || meci.id_flashscore;
            if (_matchId && perMatchPositions.has(_matchId)) meciuriCuClasamentMomentan++;

            const matchData = {
                matchId: meci.id_meci,
                homeTeam: meci.echipa_gazda?.nume,
                awayTeam: meci.echipa_oaspete?.nume,
                leagueName: leagueName,
                scor: {
                    pauza_gazda: meci.scor.pauza_gazda || 0,
                    pauza_oaspete: meci.scor.pauza_oaspete || 0
                },
                statistici: {
                    suturi_pe_poarta: {
                        pauza_gazda: stats.suturi_pe_poarta.pauza_gazda || 0,
                        pauza_oaspete: stats.suturi_pe_poarta.pauza_oaspete || 0
                    },
                    total_suturi: {
                        pauza_gazda: (stats.total_suturi?.pauza_gazda) || 0,
                        pauza_oaspete: (stats.total_suturi?.pauza_oaspete) || 0
                    },
                    cornere: {
                        repriza_1_gazda: stats.cornere?.repriza_1_gazda || stats.cornere?.pauza_gazda || 0,
                        repriza_1_oaspete: stats.cornere?.repriza_1_oaspete || stats.cornere?.pauza_oaspete || 0
                    },
                    cartonase_galbene: {
                        pauza_gazda: stats.cartonase_galbene?.pauza_gazda || 0,
                        pauza_oaspete: stats.cartonase_galbene?.pauza_oaspete || 0
                    },
                    cartonase_rosii: {
                        pauza_gazda: stats.cartonase_rosii?.pauza_gazda || 0,
                        pauza_oaspete: stats.cartonase_rosii?.pauza_oaspete || 0
                    },
                    suturi_salvate: {
                        pauza_gazda: stats.suturi_salvate?.pauza_gazda || stats.salvari_portar?.pauza_gazda || 0,
                        pauza_oaspete: stats.suturi_salvate?.pauza_oaspete || stats.salvari_portar?.pauza_oaspete || 0
                    },
                    faulturi: {
                        pauza_gazda: stats.faulturi?.pauza_gazda || 0,
                        pauza_oaspete: stats.faulturi?.pauza_oaspete || 0
                    },
                    ofsaiduri: {
                        pauza_gazda: stats.ofsaiduri?.pauza_gazda || 0,
                        pauza_oaspete: stats.ofsaiduri?.pauza_oaspete || 0
                    },
                    xG: stats.xG ? {
                        pauza_gazda: stats.xG.pauza_gazda,
                        pauza_oaspete: stats.xG.pauza_oaspete
                    } : null,
                    posesie: stats.posesie ? {
                        pauza_gazda: stats.posesie.pauza_gazda,
                        pauza_oaspete: stats.posesie.pauza_oaspete
                    } : null
                }
            };

            // Suppress PatternChecker debug logs
            const origLog = console.log;
            const origWarn = console.warn;
            console.log = () => {};
            console.warn = () => {};
            const patterns = patternChecker.checkAllPatterns(matchData);
            console.log = origLog;
            console.warn = origWarn;

            if (patterns.length === 0) return;

            patterns.forEach(pattern => {
                let teamName = null;
                if (pattern.team === 'gazda') teamName = meci.echipa_gazda?.nume;
                else if (pattern.team === 'oaspete') teamName = meci.echipa_oaspete?.nume;

                const golR2Gazda = (meci.scor.final_gazda || 0) - (meci.scor.pauza_gazda || 0);
                const golR2Oaspete = (meci.scor.final_oaspete || 0) - (meci.scor.pauza_oaspete || 0);

                let succes = false;
                if (pattern.team === 'gazda' && golR2Gazda > 0) succes = true;
                if (pattern.team === 'oaspete' && golR2Oaspete > 0) succes = true;
                if ((pattern.team === 'meci' || !pattern.team) && (golR2Gazda > 0 || golR2Oaspete > 0)) succes = true;

                let tiersToAdd = [];
                if (pattern.team === 'meci' || !pattern.team) {
                    tiersToAdd = tierConfig.tiers;
                } else {
                    let tier = tierConfig.tiers[Math.floor(tierConfig.tiers.length / 2)];
                    // Folosește clasamentul per-meci (la momentul meciului)
                    const matchId = meci.id_meci || meci.id_flashscore;
                    const momentPositions = matchId ? perMatchPositions.get(matchId) : null;
                    if (teamName && momentPositions && momentPositions[teamName]) {
                        tier = tierConfig.getTier(momentPositions[teamName], clasamentFinal.length);
                    } else if (teamName && pozitiFinalMap[teamName]) {
                        // Fallback: clasament final (primele etape, fără istoric)
                        tier = tierConfig.getTier(pozitiFinalMap[teamName], clasamentFinal.length);
                    }
                    tiersToAdd = [tier];
                }

                for (const tier of tiersToAdd) {
                    if (!tiers[tier]) tiers[tier] = {};
                    if (!tiers[tier][pattern.name]) {
                        tiers[tier][pattern.name] = { cazuri: 0, succes: 0 };
                    }
                    tiers[tier][pattern.name].cazuri++;
                    if (succes) tiers[tier][pattern.name].succes++;
                }
            });
        });

        // Calculează procente
        Object.keys(tiers).forEach(tier => {
            Object.keys(tiers[tier]).forEach(patternId => {
                const data = tiers[tier][patternId];
                data.procent = data.cazuri > 0
                    ? Math.round((data.succes / data.cazuri) * 100 * 100) / 100
                    : 0;
            });
        });

        let patCount = 0;
        Object.values(tiers).forEach(t => { patCount += Object.keys(t).length; });

        const MIN_MATCHES_FOR_PATTERNS = 50;

        if (meciuriAnalizate >= MIN_MATCHES_FOR_PATTERNS) {
            procenteData.campionate[leagueName] = {
                nume_complet: leagueName,
                tara: group.country,
                sezon: group.sezoane.join(', '),
                numar_echipe: numEchipe,
                total_meciuri_analizate: meciuriAnalizate,
                sistem_organizare: group.campionat?.sistem_organizare || 'STANDARD',
                categorii_clasament: tierConfig.categories,
                procente_reusita: tiers
            };
            totalPatterns += patCount;
            totalAnalizate += meciuriAnalizate;
            const pctMomentan = meciuriAnalizate > 0 ? Math.round(meciuriCuClasamentMomentan / meciuriAnalizate * 100) : 0;
            console.log(`   ✅ ${leagueName}: ${meciuriAnalizate} meciuri, ${patCount} pattern×tier (clasament per-meci: ${pctMomentan}%)`);
        } else if (meciuriAnalizate > 0) {
            console.log(`   ⚠️  ${leagueName}: ${meciuriAnalizate} meciuri — sub minimul de ${MIN_MATCHES_FOR_PATTERNS}, exclus din PROCENTE`);
        }
    }

    procenteData.total_campionate_analizate = Object.keys(procenteData.campionate).length;
    procenteData.data_ultima_actualizare = new Date().toISOString();
    procenteData.data_ultima_actualizare_ro = new Date().toLocaleDateString('ro-RO', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    console.log(`\n   📊 Total: ${procenteData.total_campionate_analizate} campionate, ${totalAnalizate} meciuri, ${totalPatterns} pattern×tier`);
    return procenteData;
}

// ============================================================
// MODULE 2: STREAK PATTERNS CATALOG (S01-S22)
// ============================================================

function generateStreakCatalog(leagueGroups) {
    console.log('\n' + '═'.repeat(70));
    console.log('📊 MODUL 2: Generare STREAK PATTERNS CATALOG (S01-S22)');
    console.log('═'.repeat(70));

    const catalog = {
        _meta: {
            description: 'Probabilități serii consecutive S01-S22',
            generatedAt: new Date().toISOString(),
            source: 'RECALCULATE_ALL.js',
            usage: 'getCatalogProb() din PRE_MATCH_STREAKS.js',
            streakLengths: '3W-7W'
        },
        patterns: {}
    };

    // Inițializăm structura pentru fiecare pattern
    for (const pat of STREAK_PATTERNS) {
        catalog.patterns[pat.id] = {
            id: pat.id,
            name: `${pat.condition} → ${pat.nextCondition}`,
            category: pat.category,
            condition: pat.condition,
            nextCondition: pat.nextCondition,
            global: {},
            perLeague: {}
        };
    }

    // Colectăm date globale
    const globalData = {}; // patternId -> streakKey -> tier -> {success, total}

    for (const [groupKey, group] of Object.entries(leagueGroups)) {
        const leagueName = group.displayName;
        const meciuri = group.meciuri.filter(m =>
            m.scor && m.scor.final_gazda !== null && m.scor.final_gazda !== undefined &&
            m.echipa_gazda && m.echipa_oaspete
        );

        if (meciuri.length < 20) continue;

        // Clasament pentru tier-uri
        const clasament = getSimulatedStandings(meciuri);
        const totalTeams = clasament.length;
        const pozitiMap = {};
        clasament.forEach(entry => { pozitiMap[entry.echipa] = entry.pozitie; });

        // Colectăm echipele unice
        const teams = new Set();
        meciuri.forEach(m => {
            teams.add(m.echipa_gazda.nume);
            teams.add(m.echipa_oaspete.nume);
        });

        const leagueStats = {}; // patternId -> streakKey -> tier -> {success, total}

        for (const teamName of teams) {
            const normalizedTeam = normalizeName(teamName);
            const position = pozitiMap[teamName] || Math.ceil(totalTeams / 2);
            const tier = getSimpleTier(position, totalTeams);

            // Meciurile echipei, cronologic
            const teamMatches = meciuri.filter(m =>
                normalizeName(m.echipa_gazda.nume) === normalizedTeam ||
                normalizeName(m.echipa_oaspete.nume) === normalizedTeam
            );

            if (teamMatches.length < 5) continue;

            for (const pat of STREAK_PATTERNS) {
                let currentStreak = 0;

                for (let i = 0; i < teamMatches.length; i++) {
                    const m = teamMatches[i];
                    const isHome = normalizeName(m.echipa_gazda.nume) === normalizedTeam;
                    const val = pat.getStat(m, isHome);

                    if (val === null || val < pat.threshold) {
                        currentStreak = 0;
                        continue;
                    }

                    currentStreak++;

                    // La fiecare serie de lungime N (3-7), verifică meciul următor
                    if (currentStreak >= 3 && currentStreak <= 7 && i + 1 < teamMatches.length) {
                        const nextM = teamMatches[i + 1];
                        const nextIsHome = normalizeName(nextM.echipa_gazda.nume) === normalizedTeam;
                        const nextVal = pat.getStat(nextM, nextIsHome);

                        if (nextVal !== null) {
                            const streakKey = currentStreak + 'W';
                            const success = nextVal >= pat.nextThreshold ? 1 : 0;

                            // Per league
                            if (!leagueStats[pat.id]) leagueStats[pat.id] = {};
                            if (!leagueStats[pat.id][streakKey]) leagueStats[pat.id][streakKey] = {};
                            if (!leagueStats[pat.id][streakKey][tier]) leagueStats[pat.id][streakKey][tier] = { success: 0, total: 0 };
                            leagueStats[pat.id][streakKey][tier].total++;
                            leagueStats[pat.id][streakKey][tier].success += success;

                            // Global
                            if (!globalData[pat.id]) globalData[pat.id] = {};
                            if (!globalData[pat.id][streakKey]) globalData[pat.id][streakKey] = {};
                            if (!globalData[pat.id][streakKey][tier]) globalData[pat.id][streakKey][tier] = { success: 0, total: 0 };
                            globalData[pat.id][streakKey][tier].total++;
                            globalData[pat.id][streakKey][tier].success += success;
                        }
                    }
                }
            }
        }

        // Salvăm per league
        for (const [patId, streaks] of Object.entries(leagueStats)) {
            const perLeague = catalog.patterns[patId].perLeague;
            if (!perLeague[leagueName]) perLeague[leagueName] = {};

            for (const [streakKey, tiers] of Object.entries(streaks)) {
                if (!perLeague[leagueName][streakKey]) perLeague[leagueName][streakKey] = {};
                for (const [tier, data] of Object.entries(tiers)) {
                    perLeague[leagueName][streakKey][tier] = {
                        success: data.success,
                        total: data.total,
                        rate: data.total > 0 ? Math.round((data.success / data.total) * 1000) / 10 : 0
                    };
                }
            }
        }

        let patHits = Object.values(leagueStats).reduce((sum, s) =>
            sum + Object.values(s).reduce((s2, t) =>
                s2 + Object.values(t).reduce((s3, d) => s3 + d.total, 0), 0), 0);
        if (patHits > 0) console.log(`   ✅ ${leagueName}: ${patHits} serii detectate`);
    }

    // Salvăm global data
    for (const [patId, streaks] of Object.entries(globalData)) {
        for (const [streakKey, tiers] of Object.entries(streaks)) {
            if (!catalog.patterns[patId].global[streakKey]) catalog.patterns[patId].global[streakKey] = {};
            for (const [tier, data] of Object.entries(tiers)) {
                catalog.patterns[patId].global[streakKey][tier] = {
                    success: data.success,
                    total: data.total,
                    rate: data.total > 0 ? Math.round((data.success / data.total) * 1000) / 10 : 0
                };
            }
        }
    }

    let totalEntries = 0;
    for (const pat of Object.values(catalog.patterns)) {
        for (const streaks of Object.values(pat.global)) {
            totalEntries += Object.keys(streaks).length;
        }
    }
    console.log(`\n   📊 Total: ${totalEntries} intrări globale în catalog`);

    return catalog;
}

// ============================================================
// MODULE 3-6: STREAK PROBABILITIES (helper comun)
// ============================================================

/**
 * Calculează probabilități streak generice
 * @param {Object} leagueGroups - Grupuri de ligi
 * @param {Object} config - {
 *   name, description, threshold, nextThresholds: [{key, threshold}],
 *   streakRange: [min, max], getStatFn: (meci, isHome) => value
 * }
 */
function calculateStreakProbabilities(leagueGroups, config) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`📊 ${config.name}`);
    console.log('═'.repeat(70));

    const result = {
        _meta: {
            description: config.description,
            generatedAt: new Date().toISOString(),
            source: 'RECALCULATE_ALL.js',
            usage: config.usage || '',
            streakLengths: `${config.streakRange[0]}W-${config.streakRange[1]}W`,
            condition: `${config.threshold}+ per meci`,
            nextThresholds: config.nextThresholds.map(t => `${t.threshold}+`).join(', ')
        }
    };

    // Inițializăm structura per threshold
    for (const nt of config.nextThresholds) {
        result[nt.key] = { global: {}, perLeague: {} };
    }

    // Dacă e un singur threshold, folosim structura flat (global, perLeague la top level)
    const singleThreshold = config.nextThresholds.length === 1;
    if (singleThreshold) {
        result.global = {};
        result.perLeague = {};
        delete result[config.nextThresholds[0].key];
    }

    const globalAccum = {}; // thresholdKey -> streakKey -> tier -> {scored, total}

    for (const [groupKey, group] of Object.entries(leagueGroups)) {
        const leagueName = group.displayName;
        const meciuri = group.meciuri.filter(m =>
            m.scor && m.scor.final_gazda !== null && m.scor.final_gazda !== undefined &&
            m.echipa_gazda && m.echipa_oaspete
        );

        if (meciuri.length < 20) continue;

        const clasament = getSimulatedStandings(meciuri);
        const totalTeams = clasament.length;
        const pozitiMap = {};
        clasament.forEach(entry => { pozitiMap[entry.echipa] = entry.pozitie; });

        const teams = new Set();
        meciuri.forEach(m => {
            teams.add(m.echipa_gazda.nume);
            teams.add(m.echipa_oaspete.nume);
        });

        const leagueAccum = {}; // thresholdKey -> streakKey -> tier -> {scored, total}

        for (const teamName of teams) {
            const normalizedTeam = normalizeName(teamName);
            const position = pozitiMap[teamName] || Math.ceil(totalTeams / 2);
            const tier = getSimpleTier(position, totalTeams);

            const teamMatches = meciuri.filter(m =>
                normalizeName(m.echipa_gazda.nume) === normalizedTeam ||
                normalizeName(m.echipa_oaspete.nume) === normalizedTeam
            );

            if (teamMatches.length < 5) continue;

            let currentStreak = 0;

            for (let i = 0; i < teamMatches.length; i++) {
                const m = teamMatches[i];
                const isHome = normalizeName(m.echipa_gazda.nume) === normalizedTeam;
                const val = config.getStatFn(m, isHome);

                if (val === null || val < config.threshold) {
                    currentStreak = 0;
                    continue;
                }

                currentStreak++;

                if (currentStreak >= config.streakRange[0] && currentStreak <= config.streakRange[1] && i + 1 < teamMatches.length) {
                    const nextM = teamMatches[i + 1];
                    const nextIsHome = normalizeName(nextM.echipa_gazda.nume) === normalizedTeam;
                    const nextVal = config.getStatFn(nextM, nextIsHome);

                    if (nextVal !== null) {
                        const streakKey = currentStreak + 'W';

                        for (const nt of config.nextThresholds) {
                            const scored = nextVal >= nt.threshold ? 1 : 0;
                            const tKey = nt.key;

                            // League accumulator
                            if (!leagueAccum[tKey]) leagueAccum[tKey] = {};
                            if (!leagueAccum[tKey][streakKey]) leagueAccum[tKey][streakKey] = {};
                            if (!leagueAccum[tKey][streakKey][tier]) leagueAccum[tKey][streakKey][tier] = { scored: 0, total: 0 };
                            leagueAccum[tKey][streakKey][tier].total++;
                            leagueAccum[tKey][streakKey][tier].scored += scored;

                            // Global accumulator
                            if (!globalAccum[tKey]) globalAccum[tKey] = {};
                            if (!globalAccum[tKey][streakKey]) globalAccum[tKey][streakKey] = {};
                            if (!globalAccum[tKey][streakKey][tier]) globalAccum[tKey][streakKey][tier] = { scored: 0, total: 0 };
                            globalAccum[tKey][streakKey][tier].total++;
                            globalAccum[tKey][streakKey][tier].scored += scored;
                        }
                    }
                }
            }
        }

        // Salvăm per league
        let totalHits = 0;
        for (const [tKey, streaks] of Object.entries(leagueAccum)) {
            const target = singleThreshold ? result.perLeague : result[tKey].perLeague;
            if (!target[leagueName]) target[leagueName] = {};

            for (const [streakKey, tiers] of Object.entries(streaks)) {
                if (!target[leagueName][streakKey]) target[leagueName][streakKey] = {};
                for (const [tier, data] of Object.entries(tiers)) {
                    target[leagueName][streakKey][tier] = {
                        scored: data.scored,
                        total: data.total,
                        rate: data.total > 0 ? Math.round((data.scored / data.total) * 1000) / 10 : 0
                    };
                    totalHits += data.total;
                }
            }
        }
        if (totalHits > 0) console.log(`   ✅ ${leagueName}: ${totalHits} serii detectate`);
    }

    // Salvăm global
    for (const [tKey, streaks] of Object.entries(globalAccum)) {
        const target = singleThreshold ? result.global : result[tKey].global;

        for (const [streakKey, tiers] of Object.entries(streaks)) {
            if (!target[streakKey]) target[streakKey] = {};
            for (const [tier, data] of Object.entries(tiers)) {
                target[streakKey][tier] = {
                    scored: data.scored,
                    total: data.total,
                    rate: data.total > 0 ? Math.round((data.scored / data.total) * 1000) / 10 : 0
                };
            }
        }
    }

    return result;
}

// ============================================================
// MODULE 3: SCORING STREAK (2+ goluri → 1+ gol)
// ============================================================

function generateScoringStreak(leagueGroups) {
    return calculateStreakProbabilities(leagueGroups, {
        name: 'MODUL 3: Scoring Streak (2+ goluri → 1+ gol)',
        description: 'Probabilitatea de a marca 1+ gol după N meciuri consecutive cu 2+ goluri',
        usage: 'getScoringStreakStats() din WINNING_STREAK.js',
        threshold: 2,
        nextThresholds: [{ key: 'default', threshold: 1 }],
        streakRange: [3, 5],
        getStatFn: (m, isHome) => {
            if (!m.scor) return null;
            return isHome ? m.scor.final_gazda : m.scor.final_oaspete;
        }
    });
}

// ============================================================
// MODULE 4: GOAL STREAK (1+ gol → 1+ gol)
// ============================================================

function generateGoalStreak(leagueGroups) {
    return calculateStreakProbabilities(leagueGroups, {
        name: 'MODUL 4: Goal Streak (1+ gol → 1+ gol)',
        description: 'Probabilitatea de a marca 1+ gol după N meciuri consecutive cu 1+ gol',
        usage: 'getGoalStreakStats() din WINNING_STREAK.js',
        threshold: 1,
        nextThresholds: [{ key: 'default', threshold: 1 }],
        streakRange: [5, 10],
        getStatFn: (m, isHome) => {
            if (!m.scor) return null;
            return isHome ? m.scor.final_gazda : m.scor.final_oaspete;
        }
    });
}

// ============================================================
// MODULE 5: YELLOW CARDS 3+ STREAK
// ============================================================

function generateYellowCards3plus(leagueGroups) {
    return calculateStreakProbabilities(leagueGroups, {
        name: 'MODUL 5: Yellow Cards 3+ Streak',
        description: 'Probabilitatea de 2+/3+ cartonașe după N meciuri cu 3+ cartonașe galbene',
        usage: 'yellow_cards_streak_probabilities.json',
        threshold: 3,
        nextThresholds: [
            { key: 'threshold_3plus', threshold: 3 },
            { key: 'threshold_2plus', threshold: 2 }
        ],
        streakRange: [3, 5],
        getStatFn: (m, isHome) => {
            const yc = m.statistici && m.statistici.cartonase_galbene;
            if (!yc) return null;
            return isHome ? (yc.total_gazda ?? null) : (yc.total_oaspete ?? null);
        }
    });
}

// ============================================================
// MODULE 6: YELLOW CARDS 2+ STREAK
// ============================================================

function generateYellowCards2plus(leagueGroups) {
    return calculateStreakProbabilities(leagueGroups, {
        name: 'MODUL 6: Yellow Cards 2+ Streak',
        description: 'Probabilitatea de 1+/2+ cartonașe după N meciuri cu 2+ cartonașe galbene',
        usage: 'yellow_cards_2plus_streak_probabilities.json',
        threshold: 2,
        nextThresholds: [
            { key: 'threshold_2plus', threshold: 2 },
            { key: 'threshold_1plus', threshold: 1 }
        ],
        streakRange: [3, 7],
        getStatFn: (m, isHome) => {
            const yc = m.statistici && m.statistici.cartonase_galbene;
            if (!yc) return null;
            return isHome ? (yc.total_gazda ?? null) : (yc.total_oaspete ?? null);
        }
    });
}

// ============================================================
// SALVARE + REZUMAT COMPARATIV
// ============================================================

function getFileSize(filePath) {
    try {
        return fs.statSync(filePath).size;
    } catch (e) {
        return 0;
    }
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    return (bytes / 1024).toFixed(1) + ' KB';
}

function saveWithComparison(filePath, data, label) {
    const oldSize = getFileSize(filePath);
    const jsonStr = JSON.stringify(data, null, 2);
    const newSize = Buffer.byteLength(jsonStr, 'utf8');

    backupFile(filePath);
    fs.writeFileSync(filePath, jsonStr, 'utf8');

    const arrow = newSize >= oldSize ? '📈' : '📉';
    const diff = oldSize > 0 ? ` (${oldSize > 0 ? ((newSize / oldSize * 100) - 100).toFixed(0) : '+100'}%)` : ' (NOU)';
    console.log(`   ${arrow} ${label}: ${formatSize(oldSize)} → ${formatSize(newSize)}${diff}`);
}

// ============================================================
// MAIN
// ============================================================

async function main() {
    const startTime = Date.now();

    console.log('╔' + '═'.repeat(68) + '╗');
    console.log('║  RECALCULATE_ALL — Recalculare completă probabilități              ║');
    console.log('╚' + '═'.repeat(68) + '╝');

    // 1. Încarcă toate fișierele sezon
    const leagueGroups = loadAllSeasons();

    const totalMeciuri = Object.values(leagueGroups).reduce((s, g) => s + g.meciuri.length, 0);
    console.log(`\n📊 ${Object.keys(leagueGroups).length} ligi, ${totalMeciuri} meciuri unice`);

    // 2. Backup fișiere existente
    console.log('\n💾 Backup fișiere existente...');
    for (const fp of Object.values(OUTPUT_FILES)) {
        backupFile(fp);
    }

    // 3. Rulează cele 6 module
    const procenteData = generateProcente(leagueGroups);
    const streakCatalog = generateStreakCatalog(leagueGroups);
    const scoringStreakData = generateScoringStreak(leagueGroups);
    const goalStreakData = generateGoalStreak(leagueGroups);
    const yellowCardsData = generateYellowCards3plus(leagueGroups);
    const yellowCards2plusData = generateYellowCards2plus(leagueGroups);

    // 4. Salvează cele 6 fișiere
    console.log('\n' + '═'.repeat(70));
    console.log('💾 SALVARE FIȘIERE');
    console.log('═'.repeat(70));

    saveWithComparison(OUTPUT_FILES.procente, procenteData, 'JSON PROCENTE AUTOACTUAL');
    // Salvează și în root (compatibilitate)
    fs.writeFileSync(OUTPUT_FILES.procenteRoot, JSON.stringify(procenteData, null, 2), 'utf8');
    console.log(`   📋 Copie root: JSON PROCENTE AUTOACTUAL.json`);

    saveWithComparison(OUTPUT_FILES.streakCatalog, streakCatalog, 'streak_patterns_catalog');
    saveWithComparison(OUTPUT_FILES.scoringStreak, scoringStreakData, 'scoring_streak_probabilities');
    saveWithComparison(OUTPUT_FILES.goalStreak, goalStreakData, 'goal_streak_probabilities');
    saveWithComparison(OUTPUT_FILES.yellowCards, yellowCardsData, 'yellow_cards_streak_probabilities');
    saveWithComparison(OUTPUT_FILES.yellowCards2plus, yellowCards2plusData, 'yellow_cards_2plus_streak_probabilities');

    // 5. Rezumat
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n╔' + '═'.repeat(68) + '╗');
    console.log('║  ✅ RECALCULARE COMPLETĂ                                           ║');
    console.log('╚' + '═'.repeat(68) + '╝');
    console.log(`   ⏱  Timp: ${elapsed}s`);
    console.log(`   📂 Ligi procesate: ${Object.keys(leagueGroups).length}`);
    console.log(`   ⚽ Meciuri unice: ${totalMeciuri}`);
    console.log(`   📊 Campionate PROCENTE: ${procenteData.total_campionate_analizate}`);
    console.log(`   📋 Pattern-uri catalog: ${Object.keys(streakCatalog.patterns).length} (S01-S22)`);
    console.log(`   📁 Fișiere generate: 6`);
    console.log('');
    console.log('   Verificare rapidă:');
    console.log('   node -e "const P = require(\'./PROCENTE_LOADER\'); const l = new P(); l.load();"');
    console.log('   node -e "const d = require(\'./data/streak_patterns_catalog.json\'); console.log(Object.keys(d.patterns).length + \' pattern-uri\');"');
    console.log('');
}

// Run
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Eroare fatală:', error);
        process.exit(1);
    });
}

module.exports = { generateProcente, generateStreakCatalog, calculateStreakProbabilities };
