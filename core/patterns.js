/**
 * core/patterns.js — Detectare pattern-uri + calcul probabilități
 *
 * Unifică: pattern-checker.js + logica din STATS_MONITOR (threshold + penalties)
 *
 * USAGE:
 *   const patterns = require('./core/patterns');
 *   const detected = patterns.detect(matchData);              // detectare
 *   const filtered = patterns.filter(detected, league, tier); // filtrare pe threshold
 *   const prob = patterns.getProbability(league, tier, 'PATTERN_21'); // probabilitate
 */

const path = require('path');
const config = require('./config');

// Refolosim modulele existente (nu le rescriem, doar le wrapper-uim)
const PatternChecker = require(path.join(config.paths.base, 'pattern-checker'));
const ProcenteLoader = require(path.join(config.paths.base, 'PROCENTE_LOADER'));

const checker = new PatternChecker();
const procenteLoader = new ProcenteLoader();
procenteLoader.load();

// ═══════════════════════════════════════
// DETECTARE
// ═══════════════════════════════════════

/**
 * Detectează toate pattern-urile dintr-un meci
 * @param {Object} matchData - { scor, statistici }
 * @returns {Array} - [{ name, team, stats }]
 */
function detect(matchData) {
    return checker.checkAllPatterns(matchData);
}

// ═══════════════════════════════════════
// PROBABILITĂȚI
// ═══════════════════════════════════════

/**
 * Obține probabilitatea unui pattern pentru o ligă + tier
 */
function getProbability(league, tier, patternId) {
    return procenteLoader.getPatternProbabilityWithFallback(league, tier, patternId);
}

/**
 * Reîncarcă procentele (după recalculare)
 */
function reloadProbabilities() {
    procenteLoader.load();
}

// ═══════════════════════════════════════
// THRESHOLD — calcul prag efectiv
// ═══════════════════════════════════════

/**
 * Calculează pragul efectiv pentru un pattern
 * Include: prag ligă + penalizare xG + penalizare tier
 *
 * @param {string} league - Numele ligii
 * @param {number|null} xgTeam - xG echipei (null = indisponibil)
 * @param {string} teamTier - Tier-ul echipei
 * @param {string} opponentTier - Tier-ul adversarului
 * @returns {{ threshold, baseThreshold, xgPenalty, tierPenalty }}
 */
function getEffectiveThreshold(league, xgTeam, teamTier, opponentTier) {
    const baseThreshold = config.thresholds.getMinimum(league);

    // xG penalty: +10% dacă xG > 0 și < 0.5 (xG=0 = indisponibil)
    const xgPenalty = (xgTeam !== null && xgTeam > 0 && xgTeam < 0.5)
        ? config.thresholds.xgPenalty : 0;

    // Tier penalty
    const tierPenalty = opponentTier
        ? config.thresholds.getTierPenalty(teamTier, opponentTier)
        : 0;

    return {
        threshold: baseThreshold + xgPenalty + tierPenalty,
        baseThreshold,
        xgPenalty,
        tierPenalty,
    };
}

/**
 * Filtrează pattern-urile detectate — păstrează doar cele peste threshold
 *
 * @param {Array} detectedPatterns - Pattern-uri detectate
 * @param {string} league - Liga
 * @param {Object} options - { homeTier, awayTier, xgHome, xgAway }
 * @returns {{ valid: Array, tracking: Array }} — valid = trec threshold, tracking = toate
 */
function filter(detectedPatterns, league, options = {}) {
    const { homeTier, awayTier, xgHome, xgAway } = options;

    const valid = [];
    const tracking = [];

    for (const pattern of detectedPatterns) {
        // Determin tier-ul echipei și adversarului
        let teamTier, opponentTier, xgTeam;

        if (pattern.team === 'gazda') {
            teamTier = homeTier;
            opponentTier = awayTier;
            xgTeam = xgHome;
        } else if (pattern.team === 'oaspete') {
            teamTier = awayTier;
            opponentTier = homeTier;
            xgTeam = xgAway;
        } else {
            // Pattern meci — fără penalty tier
            teamTier = homeTier;
            opponentTier = null;
            xgTeam = (xgHome !== null && xgAway !== null) ? xgHome + xgAway : null;
        }

        // Obține probabilitatea
        const tier = pattern.team === 'gazda' ? homeTier : (pattern.team === 'oaspete' ? awayTier : homeTier);
        const prob = getProbability(league, tier, pattern.name);

        if (!prob) continue;

        const patternWithProb = { ...pattern, probability: prob.procent, tier, isEstimate: prob.isEstimate };
        tracking.push(patternWithProb);

        // Threshold
        const { threshold } = getEffectiveThreshold(league, xgTeam, teamTier, opponentTier);

        if (prob.procent >= threshold) {
            valid.push(patternWithProb);
        }
    }

    return { valid, tracking };
}

// ═══════════════════════════════════════
// INFO PATTERN-URI
// ═══════════════════════════════════════

/**
 * Lista tuturor familiilor de pattern-uri cu descriere
 */
const PATTERN_INFO = {
    'PATTERN_0': { desc: 'Adversar roșu + șut pe poartă', type: 'echipa' },
    'PATTERN_1': { desc: 'X+ șuturi pe poartă, 0 goluri HT', type: 'echipa' },
    'PATTERN_2': { desc: 'X+ total șuturi, 0 goluri HT', type: 'echipa' },
    'PATTERN_3': { desc: 'Total 3/4/5+ goluri la HT', type: 'meci' },
    'PATTERN_4': { desc: 'X+ cornere, 0 goluri HT', type: 'echipa' },
    'PATTERN_5': { desc: 'X+ (șuturi+cornere), 0 goluri HT', type: 'echipa' },
    'PATTERN_6': { desc: 'Cornere + șuturi combinat, 0 goluri', type: 'echipa' },
    'PATTERN_7': { desc: 'Cornere + salvări adversar, 0 goluri', type: 'echipa' },
    'PATTERN_8': { desc: 'Cornere + salvări + șuturi, 0 goluri', type: 'echipa' },
    'PATTERN_9': { desc: 'Total 3-7+ cartonașe galbene HT', type: 'meci' },
    'PATTERN_10': { desc: 'xG ridicat, 0 goluri HT', type: 'echipa' },
    'PATTERN_11': { desc: 'Posesie dominantă, 0 goluri HT', type: 'echipa' },
    'PATTERN_12': { desc: 'xG + posesie combinat, 0 goluri', type: 'echipa' },
    'PATTERN_13': { desc: 'Posesie + șuturi, 0 goluri', type: 'echipa' },
    'PATTERN_14': { desc: 'Conduce norocos (adversar domină)', type: 'echipa' },
    'PATTERN_16': { desc: 'Ofsaiduri + presiune ofensivă', type: 'echipa' },
    'PATTERN_17': { desc: 'Salvări adversar ≥4, 0 goluri', type: 'echipa' },
    'PATTERN_18': { desc: 'Dominare totală (posesie+cornere)', type: 'echipa' },
    'PATTERN_19': { desc: 'Egal ≥1-1, total șuturi poartă ≥6', type: 'meci', rate: '80.6%' },
    'PATTERN_20': { desc: 'Cornere disproporționate (≥5 vs ≤1)', type: 'echipa' },
    'PATTERN_21': { desc: 'Egal ≥1-1, total șuturi poartă ≥10', type: 'meci', rate: '92.2%' },
    'PATTERN_22': { desc: 'Exact 1 gol HT + total șuturi poartă ≥6', type: 'meci', rate: '82.1%' },
    'PATTERN_23': { desc: '≥2 goluri HT + total șuturi poartă ≥8', type: 'meci', rate: '83.7%' },
    'PATTERN_24': { desc: 'Total cornere ≥8', type: 'meci', rate: '81.2%' },
    'PATTERN_25': { desc: 'Scor 2-0 sau 0-2 (dominanță clară)', type: 'meci', rate: '81.2%' },
};

function getPatternInfo(patternName) {
    const family = patternName.replace(/\.\d+.*$/, '').replace(/\+$/, '');
    return PATTERN_INFO[family] || { desc: 'Pattern necunoscut', type: 'unknown' };
}

module.exports = {
    detect,
    filter,
    getProbability,
    getEffectiveThreshold,
    reloadProbabilities,
    getPatternInfo,
    PATTERN_INFO,
};
