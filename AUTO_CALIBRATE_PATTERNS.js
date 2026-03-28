#!/usr/bin/env node
/**
 * 🎯 AUTO CALIBRATE PATTERNS - Recalculare Automată Probabilități
 *
 * BACKFILL + Analiză COMPLETĂ a meciurilor din JSON-uri și recalculare
 * probabilități pattern-uri bazate pe date istorice reale.
 *
 * WORKFLOW:
 * 1. 🔧 BACKFILL: Reconstrucție clasament istoric
 *    - Pentru fiecare campionat, simulează sezonul meci cu meci
 *    - Calculează poziția ÎNAINTE de fiecare meci
 *    - Completează tier_gazda, tier_oaspete pentru meciuri lipsă
 *    - Salvează JSON-uri actualizate
 *
 * 2. 📂 LOAD: Citește toate meciurile din data/seasons/*.json
 *
 * 3. 📊 ANALYZE: Pentru fiecare meci cu date complete (HT + R2):
 *    - Detectează pattern-uri la HT (pattern-checker.js)
 *    - Validează dacă s-au îndeplinit în R2 (RESULTS_VALIDATOR.js)
 *    - Acumulează statistici per PATTERN × TIER
 *
 * 4. 🎯 CALIBRATE: Calculează ajustări
 *    - Success rate real vs probabilitate actuală
 *    - Ajustează probabilități (dacă diferență > 10%)
 *    - Generează raport HTML + email
 *
 * USAGE:
 *   node AUTO_CALIBRATE_PATTERNS.js                  # Analiză + ajustare
 *   node AUTO_CALIBRATE_PATTERNS.js --dry-run        # Preview
 *   node AUTO_CALIBRATE_PATTERNS.js --min-samples=20 # Minim samples
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const emailService = require('./EMAIL_SERVICE');
const PatternChecker = require('./pattern-checker');
const { validatePattern } = require('./RESULTS_VALIDATOR');
const { getTierFromPosition } = require('./standings-scraper-puppeteer');

// Config
const SEASONS_DIR = path.join(__dirname, 'data', 'seasons');
const CALIBRATION_FILE = path.join(__dirname, 'pattern_calibration.json');

// Praguri ajustare
const MIN_SAMPLES_DEFAULT = 15;        // Minim samples pentru ajustare
const ADJUSTMENT_THRESHOLD = 10;       // Ajustează dacă diferență > 10%
const MAX_ADJUSTMENT_STEP = 15;        // Maxim +/- 15% per ajustare

/**
 * Parse arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    return {
        dryRun: args.includes('--dry-run'),
        minSamples: parseInt(args.find(a => a.startsWith('--min-samples='))?.split('=')[1]) || MIN_SAMPLES_DEFAULT,
        help: args.includes('--help') || args.includes('-h')
    };
}

/**
 * Show help
 */
function showHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║         🎯 AUTO CALIBRATE PATTERNS - Help                    ║
║         BACKFILL + Calibration Automat                       ║
╚══════════════════════════════════════════════════════════════╝

WORKFLOW COMPLET (4 FAZE):

  1. 🔧 BACKFILL - Reconstrucție Clasament Istoric:
     - Simulează sezonul meci cu meci pentru fiecare campionat
     - Calculează poziția în clasament ÎNAINTE de fiecare meci
     - Completează tier_gazda, tier_oaspete pentru meciuri lipsă
     - Salvează JSON-uri actualizate automat

  2. 📂 LOAD - Citește toate meciurile din data/seasons/*.json

  3. 📊 ANALYZE - Detectare și validare pattern-uri:
     - Detectează pattern-uri la HT (pattern-checker.js)
     - Validează în R2 (RESULTS_VALIDATOR.js)
     - Calculează success rate per PATTERN × TIER

  4. 🎯 CALIBRATE - Ajustează probabilități automat

USAGE:
  node AUTO_CALIBRATE_PATTERNS.js                  # Full run
  node AUTO_CALIBRATE_PATTERNS.js --dry-run        # Preview
  node AUTO_CALIBRATE_PATTERNS.js --min-samples=20 # Minim samples

CRON (MARȚI 06:00):
  0 6 * * 2 cd "/home/florian/API SMART 5" && node AUTO_CALIBRATE_PATTERNS.js >> logs/calibration.log 2>&1
`);
}

/**
 * Încarcă toate meciurile din JSON-uri
 */
function loadMatchesFromSeasons() {
    console.log(`\n📂 Citire meciuri din: ${SEASONS_DIR}`);

    if (!fs.existsSync(SEASONS_DIR)) {
        console.error(`❌ Directorul ${SEASONS_DIR} nu există!`);
        return [];
    }

    const files = glob.sync(path.join(SEASONS_DIR, 'complete_FULL_SEASON_*.json'));
    console.log(`📁 Fișiere găsite: ${files.length}`);

    const allMatches = [];
    let filesProcessed = 0;

    files.forEach(file => {
        try {
            const content = fs.readFileSync(file, 'utf8');
            const data = JSON.parse(content);
            const matches = data.meciuri || [];

            // Filtrează doar meciurile cu date complete (HT + R2)
            const completeMatches = matches.filter(m =>
                m.scor && typeof m.scor.pauza_gazda === 'number' &&
                m.statistici && m.statistici.cornere &&
                typeof m.statistici.cornere.repriza_2_gazda === 'number' &&
                typeof m.statistici.cornere.repriza_2_oaspete === 'number'
            );

            if (completeMatches.length > 0) {
                allMatches.push(...completeMatches);
                filesProcessed++;
                console.log(`   ✅ ${path.basename(file)}: ${completeMatches.length} meciuri complete`);
            }
        } catch (error) {
            console.error(`   ⚠️  ${path.basename(file)}: ${error.message}`);
        }
    });

    console.log(`\n📊 Total: ${allMatches.length} meciuri complete din ${filesProcessed} fișiere`);
    return allMatches;
}

/**
 * ============================================
 * 🔧 BACKFILL: Reconstrucție Clasament Istoric
 * ============================================
 */

/**
 * Calculează poziția unei echipe în clasament
 */
function calculatePosition(standings, teamName) {
    const entries = Object.entries(standings);

    // Sortare clasament: puncte DESC, golaveraj DESC, goluri marcate DESC
    entries.sort((a, b) => {
        const [nameA, statsA] = a;
        const [nameB, statsB] = b;

        // 1. Puncte
        if (statsA.puncte !== statsB.puncte) return statsB.puncte - statsA.puncte;

        // 2. Golaveraj
        const golaverajA = statsA.goluri_marcate - statsA.goluri_primite;
        const golaverajB = statsB.goluri_marcate - statsB.goluri_primite;
        if (golaverajA !== golaverajB) return golaverajB - golaverajA;

        // 3. Goluri marcate
        if (statsA.goluri_marcate !== statsB.goluri_marcate) {
            return statsB.goluri_marcate - statsA.goluri_marcate;
        }

        // 4. Alfabetic (fallback)
        return nameA.localeCompare(nameB);
    });

    const position = entries.findIndex(([name]) => name === teamName) + 1;
    return position || null;
}

/**
 * Actualizează clasamentul cu rezultatul unui meci
 */
function updateStandings(standings, homeTeam, awayTeam, homeScore, awayScore) {
    // Inițializează echipele dacă nu există
    if (!standings[homeTeam]) {
        standings[homeTeam] = {
            meciuri: 0, victorii: 0, egaluri: 0, infrangeri: 0,
            puncte: 0, goluri_marcate: 0, goluri_primite: 0
        };
    }
    if (!standings[awayTeam]) {
        standings[awayTeam] = {
            meciuri: 0, victorii: 0, egaluri: 0, infrangeri: 0,
            puncte: 0, goluri_marcate: 0, goluri_primite: 0
        };
    }

    // Actualizează statistici
    standings[homeTeam].meciuri++;
    standings[awayTeam].meciuri++;

    standings[homeTeam].goluri_marcate += homeScore;
    standings[homeTeam].goluri_primite += awayScore;
    standings[awayTeam].goluri_marcate += awayScore;
    standings[awayTeam].goluri_primite += homeScore;

    if (homeScore > awayScore) {
        // Victorie gazdă
        standings[homeTeam].victorii++;
        standings[homeTeam].puncte += 3;
        standings[awayTeam].infrangeri++;
    } else if (homeScore < awayScore) {
        // Victorie oaspeți
        standings[awayTeam].victorii++;
        standings[awayTeam].puncte += 3;
        standings[homeTeam].infrangeri++;
    } else {
        // Egal
        standings[homeTeam].egaluri++;
        standings[homeTeam].puncte += 1;
        standings[awayTeam].egaluri++;
        standings[awayTeam].puncte += 1;
    }
}

/**
 * Reconstruiește clasamentul istoric pentru un campionat
 * și completează tier_gazda, tier_oaspete pentru fiecare meci
 */
function reconstructStandingsForChampionship(matches, campionat) {
    console.log(`\n   📊 Reconstruire clasament: ${campionat}`);
    console.log(`   Meciuri: ${matches.length}`);

    // Sortare cronologică (parsează timestamp sau dată)
    matches.sort((a, b) => {
        const tsA = a.timestamp || new Date(a.data_ora?.data || 0).getTime();
        const tsB = b.timestamp || new Date(b.data_ora?.data || 0).getTime();
        return tsA - tsB;
    });

    const standings = {};
    let updatedCount = 0;

    // Simulează sezonul meci cu meci
    for (const match of matches) {
        const homeTeam = match.echipa_gazda?.nume;
        const awayTeam = match.echipa_oaspete?.nume;

        if (!homeTeam || !awayTeam) continue;

        // Inițializează echipele în clasament dacă nu există
        if (!standings[homeTeam]) {
            standings[homeTeam] = {
                meciuri: 0, victorii: 0, egaluri: 0, infrangeri: 0,
                puncte: 0, goluri_marcate: 0, goluri_primite: 0
            };
        }
        if (!standings[awayTeam]) {
            standings[awayTeam] = {
                meciuri: 0, victorii: 0, egaluri: 0, infrangeri: 0,
                puncte: 0, goluri_marcate: 0, goluri_primite: 0
            };
        }

        // Calculează poziția ÎNAINTE de meci (doar dacă echipa a jucat deja)
        let homePos = null;
        let awayPos = null;

        if (standings[homeTeam].meciuri > 0) {
            homePos = calculatePosition(standings, homeTeam);
        }
        if (standings[awayTeam].meciuri > 0) {
            awayPos = calculatePosition(standings, awayTeam);
        }

        // Calculează TIER doar dacă echipa are poziție (nu la primul meci)
        const totalTeams = Object.keys(standings).length;

        if (homePos && (!match.tier_gazda || match.tier_gazda === null)) {
            match.tier_gazda = getTierFromPosition(homePos, totalTeams, campionat);
            match.pozitie_clasament_gazda = homePos;
            updatedCount++;
        }

        if (awayPos && (!match.tier_oaspete || match.tier_oaspete === null)) {
            match.tier_oaspete = getTierFromPosition(awayPos, totalTeams, campionat);
            match.pozitie_clasament_oaspete = awayPos;
            updatedCount++;
        }

        // Actualizează clasamentul cu rezultatul meciului
        const homeScore = match.scor?.final_gazda || 0;
        const awayScore = match.scor?.final_oaspete || 0;

        updateStandings(standings, homeTeam, awayTeam, homeScore, awayScore);
    }

    console.log(`   ✅ Actualizat: ${updatedCount} TIER-uri`);
    return updatedCount;
}

/**
 * BACKFILL: Completează TIER-uri lipsă pentru toate campionatele
 */
async function backfillMissingTiers() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                                                              ║');
    console.log('║         🔧 BACKFILL: Completare TIER-uri Lipsă               ║');
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    if (!fs.existsSync(SEASONS_DIR)) {
        console.error(`❌ Directorul ${SEASONS_DIR} nu există!`);
        return;
    }

    const files = glob.sync(path.join(SEASONS_DIR, 'complete_FULL_SEASON_*.json'))
        .filter(f => !f.includes('BACKUP') && !f.includes('ORIGINAL') && !f.includes('OLD_FORMAT'));

    console.log(`📁 Fișiere găsite: ${files.length}\n`);
    console.log('='.repeat(60));

    let totalFiles = 0;
    let totalUpdated = 0;
    let filesModified = 0;

    for (const file of files) {
        try {
            const content = fs.readFileSync(file, 'utf8');
            const data = JSON.parse(content);
            const matches = data.meciuri || [];

            if (matches.length === 0) continue;

            totalFiles++;

            // Extrage numele campionatului corect
            const campionatName = data.campionat?.nume_complet ||
                                  data.campionat?.nume ||
                                  data.campionat ||
                                  path.basename(file, '.json').substring(20);

            // Verifică câte meciuri au TIER lipsă
            const missingTiers = matches.filter(m =>
                !m.tier_gazda || !m.tier_oaspete ||
                m.tier_gazda === null || m.tier_oaspete === null
            ).length;

            if (missingTiers === 0) {
                console.log(`⏭️  ${campionatName}: TIER complet (${matches.length} meciuri)`);
                continue;
            }

            console.log(`\n🔄 ${campionatName}: ${missingTiers}/${matches.length} TIER lipsă`);

            // Reconstruiește clasament și completează TIER-uri
            const updated = reconstructStandingsForChampionship(matches, campionatName);

            if (updated > 0) {
                // Salvează JSON actualizat
                fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
                filesModified++;
                totalUpdated += updated;
                console.log(`   💾 Salvat: ${path.basename(file)}`);
            }

        } catch (error) {
            console.error(`   ⚠️  ${path.basename(file)}: ${error.message}`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 REZULTATE BACKFILL:\n`);
    console.log(`   Fișiere procesate: ${totalFiles}`);
    console.log(`   Fișiere modificate: ${filesModified}`);
    console.log(`   TIER-uri completate: ${totalUpdated}`);
    console.log('\n✅ Backfill complet!\n');
}

/**
 * Analizează meciuri și calculează statistici per pattern × tier
 */
function analyzeMatches(matches) {
    console.log(`\n🔍 Analiză pattern-uri pe ${matches.length} meciuri...`);
    console.log('='.repeat(60));

    const patternChecker = new PatternChecker();
    const stats = {};
    let totalPatternsDetected = 0;
    let totalValidated = 0;

    matches.forEach((match, idx) => {
        if ((idx + 1) % 100 === 0) {
            console.log(`   Procesare: ${idx + 1}/${matches.length} meciuri...`);
        }

        try {
            // Transform statistici din format JSON în format pattern-checker
            const transformedStats = {
                suturi_pe_poarta: {
                    pauza_gazda: match.statistici.suturi_pe_poarta?.pauza_gazda || 0,
                    pauza_oaspete: match.statistici.suturi_pe_poarta?.pauza_oaspete || 0
                },
                total_suturi: {
                    pauza_gazda: match.statistici.total_suturi?.pauza_gazda || 0,
                    pauza_oaspete: match.statistici.total_suturi?.pauza_oaspete || 0
                },
                cornere: {
                    repriza_1_gazda: match.statistici.cornere?.pauza_gazda || 0,
                    repriza_1_oaspete: match.statistici.cornere?.pauza_oaspete || 0
                },
                cartonase_galbene: {
                    pauza_gazda: match.statistici.cartonase_galbene?.pauza_gazda || 0,
                    pauza_oaspete: match.statistici.cartonase_galbene?.pauza_oaspete || 0
                },
                cartonase_rosii: {
                    pauza_gazda: match.statistici.cartonase_rosii?.pauza_gazda || 0,
                    pauza_oaspete: match.statistici.cartonase_rosii?.pauza_oaspete || 0
                },
                suturi_salvate: {
                    pauza_gazda: match.statistici.salvari_portar?.pauza_gazda || 0,
                    pauza_oaspete: match.statistici.salvari_portar?.pauza_oaspete || 0
                },
                xG: match.statistici.xG ? {
                    pauza_gazda: match.statistici.xG.pauza_gazda,
                    pauza_oaspete: match.statistici.xG.pauza_oaspete
                } : null,
                posesie: match.statistici.posesie ? {
                    pauza_gazda: match.statistici.posesie.pauza_gazda,
                    pauza_oaspete: match.statistici.posesie.pauza_oaspete
                } : null
            };

            // Pregătește date pentru pattern-checker
            const matchData = {
                matchId: match.id_meci || match.id_flashscore,
                homeTeam: match.echipa_gazda?.nume || 'Unknown',
                awayTeam: match.echipa_oaspete?.nume || 'Unknown',
                scor: {
                    pauza_gazda: match.scor.pauza_gazda,
                    pauza_oaspete: match.scor.pauza_oaspete
                },
                statistici: transformedStats
            };

            // Detectează pattern-uri la HT
            const patterns = patternChecker.checkAllPatterns(matchData);

            if (patterns.length === 0) return;

            totalPatternsDetected += patterns.length;

            // Pentru fiecare pattern detectat
            patterns.forEach(pattern => {
                const patternKey = pattern.name;

                // Determină TIER (folosește tier_gazda ca referință)
                let tier = 'UNKNOWN';
                if (match.tier_gazda && match.tier_oaspete) {
                    if (match.tier_gazda === 'TOP' || match.tier_oaspete === 'TOP') {
                        tier = 'TOP';
                    } else if (match.tier_gazda === 'MID' || match.tier_oaspete === 'MID') {
                        tier = 'MID';
                    } else {
                        tier = 'BOTTOM';
                    }
                }

                // Inițializează structura
                if (!stats[patternKey]) {
                    stats[patternKey] = {};
                }
                if (!stats[patternKey][tier]) {
                    stats[patternKey][tier] = {
                        total: 0,
                        completed: 0,
                        failed: 0,
                        currentProbability: pattern.probability || 0
                    };
                }

                stats[patternKey][tier].total++;

                // Pregătește date pentru validare în format corect pentru RESULTS_VALIDATOR
                const validationMatchData = {
                    match: {
                        homeTeam: match.echipa_gazda?.nume || 'Unknown',
                        awayTeam: match.echipa_oaspete?.nume || 'Unknown'
                    },
                    halftime: {
                        score: {
                            home: match.scor.pauza_gazda,
                            away: match.scor.pauza_oaspete
                        }
                    },
                    fulltime: {
                        score: {
                            home: match.scor.final_gazda || 0,
                            away: match.scor.final_oaspete || 0
                        }
                    },
                    secondhalf: match.statistici
                };

                // Adaptează pattern pentru validator (patternName în loc de name)
                const validationPattern = {
                    patternName: pattern.name,
                    team: pattern.team || 'gazda',
                    teamName: pattern.teamName || match.echipa_gazda?.nume || 'Unknown'
                };

                const validation = validatePattern(validationPattern, validationMatchData);

                if (validation.success) {
                    stats[patternKey][tier].completed++;
                } else {
                    stats[patternKey][tier].failed++;
                }

                totalValidated++;
            });

        } catch (error) {
            // Skip meciuri cu erori
        }
    });

    console.log(`\n📊 Analiză completă:`);
    console.log(`   Patterns detectate: ${totalPatternsDetected}`);
    console.log(`   Validări procesate: ${totalValidated}`);

    return stats;
}

// Funcția convertStats NU mai e necesară - folosim direct match.statistici

/**
 * Calculează ajustare recomandată
 */
function calculateAdjustments(stats, minSamples) {
    const results = [];

    Object.entries(stats).forEach(([patternName, tierData]) => {
        Object.entries(tierData).forEach(([tier, data]) => {
            if (data.total < minSamples) return;

            const successRate = Math.round((data.completed / data.total) * 100);
            const difference = successRate - data.currentProbability;
            const needsAdjustment = Math.abs(difference) >= ADJUSTMENT_THRESHOLD;

            let newProbability = data.currentProbability;
            let adjustment = 0;

            if (needsAdjustment) {
                adjustment = Math.min(Math.max(difference, -MAX_ADJUSTMENT_STEP), MAX_ADJUSTMENT_STEP);
                newProbability = Math.max(50, Math.min(100, data.currentProbability + adjustment));
            }

            results.push({
                pattern: patternName,
                tier,
                samples: data.total,
                completed: data.completed,
                failed: data.failed,
                successRate,
                currentProbability: data.currentProbability,
                difference,
                needsAdjustment,
                adjustment: Math.round(adjustment),
                newProbability: Math.round(newProbability),
                confidence: data.total >= 50 ? 'HIGH' : data.total >= minSamples ? 'MEDIUM' : 'LOW'
            });
        });
    });

    // Sortează după samples (descrescător)
    results.sort((a, b) => b.samples - a.samples);

    return results;
}

/**
 * Generează raport HTML
 */
function generateHTMLReport(analysis, options) {
    const needsAdjustment = analysis.filter(a => a.needsAdjustment);
    const stable = analysis.filter(a => !a.needsAdjustment && a.samples >= options.minSamples);
    const insufficient = analysis.filter(a => a.samples < options.minSamples);

    const adjustmentsHTML = needsAdjustment.map(a => {
        const arrow = a.adjustment > 0 ? '📈' : '📉';
        const color = a.adjustment > 0 ? '#27ae60' : '#e74c3c';

        return `
            <tr>
                <td><strong>${a.pattern}</strong></td>
                <td style="text-align: center;"><span class="badge badge-${a.tier.toLowerCase()}">${a.tier}</span></td>
                <td style="text-align: center;">${a.samples}</td>
                <td style="text-align: center;">${a.successRate}%</td>
                <td style="text-align: center;">${a.currentProbability}%</td>
                <td style="text-align: center; color: ${color}; font-weight: bold;">
                    ${arrow} ${a.adjustment > 0 ? '+' : ''}${a.adjustment}%
                </td>
                <td style="text-align: center; font-weight: bold; color: ${color};">${a.newProbability}%</td>
            </tr>
        `;
    }).join('');

    const stableHTML = stable.slice(0, 15).map(a => `
        <tr>
            <td><strong>${a.pattern}</strong></td>
            <td style="text-align: center;"><span class="badge badge-${a.tier.toLowerCase()}">${a.tier}</span></td>
            <td style="text-align: center;">${a.samples}</td>
            <td style="text-align: center;">${a.successRate}%</td>
            <td style="text-align: center;">${a.currentProbability}%</td>
            <td style="text-align: center; color: #95a5a6;">${a.difference > 0 ? '+' : ''}${a.difference}%</td>
        </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Pattern Calibration Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
        h1 { color: #2c3e50; text-align: center; margin-bottom: 10px; }
        .subtitle { text-align: center; color: #7f8c8d; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 30px 0; }
        .summary-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card.warning { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
        .summary-card.success { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
        .summary-card.info { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); }
        .summary-value { font-size: 36px; font-weight: bold; margin: 10px 0; }
        .summary-label { font-size: 14px; opacity: 0.9; }
        h2 { color: #34495e; border-bottom: 3px solid #3498db; padding-bottom: 10px; margin-top: 40px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #34495e; color: white; padding: 15px; text-align: left; }
        td { padding: 12px; border-bottom: 1px solid #ecf0f1; }
        tr:hover { background: #f8f9fa; }
        .badge { display: inline-block; padding: 5px 10px; border-radius: 5px; font-size: 11px; font-weight: bold; color: white; }
        .badge-top { background: #27ae60; }
        .badge-mid { background: #f39c12; }
        .badge-bottom { background: #e74c3c; }
        .badge-unknown { background: #95a5a6; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #ecf0f1; color: #7f8c8d; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎯 Pattern Calibration Report - Date Istorice</h1>
        <div class="subtitle">${new Date().toLocaleDateString('ro-RO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>

        <div class="summary">
            <div class="summary-card">
                <div class="summary-value">${analysis.length}</div>
                <div class="summary-label">Pattern × Tier Analizate</div>
            </div>
            <div class="summary-card warning">
                <div class="summary-value">${needsAdjustment.length}</div>
                <div class="summary-label">Necesită Ajustare</div>
            </div>
            <div class="summary-card success">
                <div class="summary-value">${stable.length}</div>
                <div class="summary-label">Stabile</div>
            </div>
            <div class="summary-card info">
                <div class="summary-value">${insufficient.length}</div>
                <div class="summary-label">Date Insuficiente</div>
            </div>
        </div>

        ${needsAdjustment.length > 0 ? `
        <h2>🔧 Ajustări Recomandate (${needsAdjustment.length})</h2>
        <table>
            <thead>
                <tr>
                    <th>Pattern</th>
                    <th>Tier</th>
                    <th>Samples</th>
                    <th>Success Rate Real</th>
                    <th>Probabilitate Actuală</th>
                    <th>Ajustare</th>
                    <th>Probabilitate Nouă</th>
                </tr>
            </thead>
            <tbody>
                ${adjustmentsHTML}
            </tbody>
        </table>
        ` : ''}

        ${stable.length > 0 ? `
        <h2>✅ Patterns Stabile - Top 15 (${stable.length} total)</h2>
        <table>
            <thead>
                <tr>
                    <th>Pattern</th>
                    <th>Tier</th>
                    <th>Samples</th>
                    <th>Success Rate</th>
                    <th>Probabilitate</th>
                    <th>Diferență</th>
                </tr>
            </thead>
            <tbody>
                ${stableHTML}
            </tbody>
        </table>
        ` : ''}

        <div class="footer">
            <p>🤖 Generat automat de API SMART 5 - Pattern Calibration (Date Istorice)</p>
            <p>📊 Minim samples: ${options.minSamples} | Prag ajustare: ${ADJUSTMENT_THRESHOLD}% | Max step: ±${MAX_ADJUSTMENT_STEP}%</p>
            <p>⏰ ${new Date().toLocaleString('ro-RO')}</p>
        </div>
    </div>
</body>
</html>
    `;
}

/**
 * Salvează calibration history
 */
function saveCalibrationHistory(analysis, dryRun) {
    if (dryRun) return;

    const needsAdjustment = analysis.filter(a => a.needsAdjustment);
    if (needsAdjustment.length === 0) return;

    let history = { version: '1.0', lastCalibration: null, calibrations: [], patterns: {} };

    try {
        if (fs.existsSync(CALIBRATION_FILE)) {
            history = JSON.parse(fs.readFileSync(CALIBRATION_FILE, 'utf8'));
        }
    } catch (error) {
        console.log(`⚠️  Eroare citire istoric: ${error.message}`);
    }

    const calibration = {
        date: new Date().toISOString(),
        adjustments: needsAdjustment.map(a => ({
            pattern: a.pattern,
            tier: a.tier,
            samples: a.samples,
            successRate: a.successRate,
            oldProbability: a.currentProbability,
            newProbability: a.newProbability,
            adjustment: a.adjustment
        }))
    };

    history.lastCalibration = new Date().toISOString();
    history.calibrations.unshift(calibration);

    // Keep last 12 calibrations
    if (history.calibrations.length > 12) {
        history.calibrations = history.calibrations.slice(0, 12);
    }

    try {
        fs.writeFileSync(CALIBRATION_FILE, JSON.stringify(history, null, 2), 'utf8');
        console.log(`✅ Istoric salvat: ${CALIBRATION_FILE}`);
    } catch (error) {
        console.error(`❌ Eroare salvare: ${error.message}`);
    }
}

/**
 * Trimite raport prin email
 */
async function sendEmailReport(htmlReport) {
    try {
        const config = require('./NOTIFICATION_CONFIG');

        if (!config.notifications.sendEmail) {
            console.log('⏭️  Email dezactivat în config');
            return;
        }

        const result = await emailService.send({
            from: '"🎯 API SMART 5 - Calibration" <smartyield365@gmail.com>',
            subject: `🎯 Pattern Calibration Report - ${new Date().toLocaleDateString('ro-RO')}`,
            html: htmlReport
        });

        if (result.success) {
            console.log(`✅ Email raport trimis: ${result.messageId}`);
        } else {
            console.error(`❌ Email nu a fost trimis: ${result.error}`);
        }

    } catch (error) {
        console.error(`❌ Eroare trimitere email: ${error.message}`);
    }
}

/**
 * Main
 */
async function main() {
    const options = parseArgs();

    if (options.help) {
        showHelp();
        process.exit(0);
    }

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                                                              ║');
    console.log('║         🎯 AUTO CALIBRATE PATTERNS                           ║');
    console.log('║         BACKFILL + Analiză Date Istorice Complete           ║');
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    console.log(`⏰ ${new Date().toLocaleString('ro-RO')}`);
    console.log(`🔧 Mod: ${options.dryRun ? 'DRY RUN (preview)' : 'AJUSTARE ACTIVĂ'}`);
    console.log(`📊 Minim samples: ${options.minSamples}`);
    console.log('='.repeat(60));

    const startTime = Date.now();

    // 🔧 FAZĂ 1: BACKFILL - Completează TIER-uri lipsă
    console.log('\n[FAZĂ 1/4] 🔧 BACKFILL: Reconstrucție clasament istoric...\n');
    await backfillMissingTiers();

    // 📂 FAZĂ 2: Încarcă meciuri
    console.log('\n[FAZĂ 2/4] 📂 LOAD: Citire meciuri din JSON...\n');
    const matches = loadMatchesFromSeasons();
    if (matches.length === 0) {
        console.log('\n⚠️  Nu există meciuri în JSON-uri!\n');
        process.exit(0);
    }

    // 📊 FAZĂ 3: Analizează pattern-uri
    console.log('\n[FAZĂ 3/4] 📊 ANALYZE: Detectare și validare pattern-uri...\n');
    const stats = analyzeMatches(matches);

    // 🎯 FAZĂ 4: Calculează ajustări și generează rapoarte
    console.log('\n[FAZĂ 4/4] 🎯 CALIBRATE: Calcul ajustări și rapoarte...\n');
    const analysis = calculateAdjustments(stats, options.minSamples);

    // Afișează rezultate
    const needsAdjustment = analysis.filter(a => a.needsAdjustment);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`\n📋 REZULTATE:\n`);
    console.log(`   Pattern × Tier analizate: ${analysis.length}`);
    console.log(`   Necesită ajustare: ${needsAdjustment.length}`);
    console.log(`   Stabile: ${analysis.filter(a => !a.needsAdjustment && a.samples >= options.minSamples).length}`);

    if (needsAdjustment.length > 0) {
        console.log(`\n🔧 TOP Ajustări recomandate:\n`);
        needsAdjustment.slice(0, 10).forEach(a => {
            const arrow = a.adjustment > 0 ? '📈' : '📉';
            console.log(`   ${arrow} ${a.pattern} [${a.tier}]`);
            console.log(`      ${a.samples} samples | Success: ${a.successRate}% | Actual: ${a.currentProbability}%`);
            console.log(`      Ajustare: ${a.adjustment > 0 ? '+' : ''}${a.adjustment}% → Nou: ${a.newProbability}%`);
        });
    }

    // 5. Generează raport
    const htmlReport = generateHTMLReport(analysis, options);
    const reportPath = path.join(__dirname, `pattern-calibration-${Date.now()}.html`);
    fs.writeFileSync(reportPath, htmlReport, 'utf8');
    console.log(`\n📄 Raport salvat: ${path.basename(reportPath)}`);

    // 6. Trimite email
    await sendEmailReport(htmlReport);

    // 7. Salvează istoric
    saveCalibrationHistory(analysis, options.dryRun);

    if (!options.dryRun && needsAdjustment.length > 0) {
        console.log(`\n✅ Ajustări salvate în ${CALIBRATION_FILE}`);
        console.log(`\n⚠️  IMPORTANT: Actualizează manual probabilitățile în pattern definitions!`);
    } else if (options.dryRun) {
        console.log(`\n🔍 DRY RUN: Nicio ajustare salvată (doar preview)`);
    } else {
        console.log(`\n✅ Toate pattern-urile sunt stabile (diferență < ${ADJUSTMENT_THRESHOLD}%)`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n⏱️  Durată: ${duration}s`);
    console.log('='.repeat(60));
    console.log('\n✅ Calibrare completă!\n');
}

// Run
if (require.main === module) {
    main().catch(error => {
        console.error('\n❌ EROARE FATALĂ:', error.message);
        console.error(error.stack);
        process.exit(1);
    });
}

module.exports = { main };
