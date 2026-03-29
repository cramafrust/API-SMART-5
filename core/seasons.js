/**
 * core/seasons.js — Gestiune fișiere sezon
 *
 * Wrapper curat peste CHAMPIONSHIP_JSON_MANAGER.
 * Adaugă suport pentru noua structură de directoare (data/seasons/{sezon}/{Liga}.json)
 * cu fallback pe structura veche (data/seasons/complete_FULL_SEASON_{Liga}_{sezon}.json).
 *
 * USAGE:
 *   const seasons = require('./core/seasons');
 *   seasons.saveMatch(matchData);
 *   const data = seasons.loadSeason('PremierLeague', '2025-2026');
 *   const all = seasons.loadAllSeasons('2025-2026');
 *   const files = seasons.listSeasonFiles();
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const config = require('./config');

// Refolosim funcțiile existente din CHAMPIONSHIP_JSON_MANAGER
const championshipManager = require(path.join(config.paths.base, 'CHAMPIONSHIP_JSON_MANAGER'));

// ═══════════════════════════════════════
// CITIRE
// ═══════════════════════════════════════

/**
 * Încarcă datele unui sezon pentru o ligă
 * Caută mai întâi în noua structură, apoi fallback pe veche
 */
function loadSeason(league, season) {
    // 1. Caută noua structură: data/seasons/2025-2026/PremierLeague.json
    const newPath = config.paths.getSeasonFile(league, season);
    if (fs.existsSync(newPath)) {
        try {
            return JSON.parse(fs.readFileSync(newPath, 'utf8'));
        } catch (e) {
            console.error(`❌ Eroare citire ${newPath}: ${e.message}`);
        }
    }

    // 2. Fallback pe structura veche (symlink): data/seasons/complete_FULL_SEASON_{Liga}_{sezon}.json
    const oldPath = config.paths.oldSeasonFile(league, season);
    if (fs.existsSync(oldPath)) {
        try {
            return JSON.parse(fs.readFileSync(oldPath, 'utf8'));
        } catch (e) {
            console.error(`❌ Eroare citire ${oldPath}: ${e.message}`);
        }
    }

    return null;
}

/**
 * Încarcă toate sezoanele (opțional filtrat pe un sezon specific)
 * Returnează: { 'PremierLeague': { meciuri: [...] }, 'Bundesliga': {...}, ... }
 */
function loadAllSeasons(season) {
    const result = {};

    // Caută mai întâi în noua structură
    if (season) {
        const dir = config.paths.getSeasonDir(season);
        if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
            for (const file of files) {
                try {
                    const league = file.replace('.json', '');
                    result[league] = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
                } catch {}
            }
        }
    }

    // Fallback/completare cu structura veche
    const pattern = season
        ? path.join(config.paths.seasons, `complete_FULL_SEASON_*_${season}.json`)
        : path.join(config.paths.seasons, 'complete_FULL_SEASON_*.json');

    const oldFiles = glob.sync(pattern);
    for (const file of oldFiles) {
        const match = path.basename(file).match(/^complete_FULL_SEASON_(.+?)_(\d{4}-\d{4})\.json$/);
        if (!match) continue;
        const league = match[1];
        if (result[league]) continue; // Deja încărcat din noua structură

        try {
            result[league] = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch {}
    }

    return result;
}

/**
 * Listează toate fișierele season disponibile
 * Returnează: [{ league, season, path, matchCount }]
 */
function listSeasonFiles() {
    const files = [];

    // Noua structură
    if (fs.existsSync(config.paths.seasons)) {
        const seasonDirs = fs.readdirSync(config.paths.seasons).filter(d => {
            const full = path.join(config.paths.seasons, d);
            return fs.statSync(full).isDirectory() && /^\d{4}-\d{4}$/.test(d);
        });

        for (const season of seasonDirs) {
            const dir = path.join(config.paths.seasons, season);
            const jsonFiles = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
            for (const file of jsonFiles) {
                const filePath = path.join(dir, file);
                try {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    files.push({
                        league: file.replace('.json', ''),
                        season,
                        path: filePath,
                        matchCount: data.meciuri?.length || 0,
                    });
                } catch {
                    files.push({ league: file.replace('.json', ''), season, path: filePath, matchCount: 0 });
                }
            }
        }
    }

    return files;
}

/**
 * Calculează statistici globale
 */
function getGlobalStats() {
    const files = listSeasonFiles();
    const seasons = [...new Set(files.map(f => f.season))];
    const leagues = [...new Set(files.map(f => f.league))];
    const totalMatches = files.reduce((sum, f) => sum + f.matchCount, 0);

    return {
        totalFiles: files.length,
        totalSeasons: seasons.length,
        totalLeagues: leagues.length,
        totalMatches,
        seasons: seasons.sort(),
        leagues: leagues.sort(),
    };
}

// ═══════════════════════════════════════
// SCRIERE — delegare la CHAMPIONSHIP_JSON_MANAGER
// ═══════════════════════════════════════

/**
 * Salvează datele unui meci
 * Delegare la CHAMPIONSHIP_JSON_MANAGER (care gestionează conversie, deduplicare, backup)
 */
function saveMatch(matchData) {
    return championshipManager.saveMatchData(matchData);
}

/**
 * Salvează mai multe meciuri (batch)
 */
function saveMultipleMatches(matchesData) {
    return championshipManager.saveMultipleMatches(matchesData);
}

module.exports = {
    loadSeason,
    loadAllSeasons,
    listSeasonFiles,
    getGlobalStats,
    saveMatch,
    saveMultipleMatches,
};
