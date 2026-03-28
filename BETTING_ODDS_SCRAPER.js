/**
 * 💰 BETTING_ODDS_SCRAPER.js
 *
 * Extrage cote de la case de pariuri (Superbet, Netbet)
 *
 * FUNCȚIONALITATE:
 * - Caută meci pe site-uri case pariuri
 * - Extrage cote pentru pronosticuri specifice
 * - Mapare pattern → piață pariuri
 * - Cache cote pentru evitare re-scraping
 *
 * PIEȚE SUPORTATE:
 * - Total Goals (Over/Under 2.5, 3.5)
 * - Both Teams To Score (BTTS Yes/No)
 * - Team Total Goals (Over 1.5, 2.5)
 * - Corners (Total, Team)
 * - Cards (Total)
 *
 * USAGE:
 *   const odds = await getOddsForMatch(matchId, homeTeam, awayTeam, predictions);
 */

const https = require('https');

/**
 * Mapare PATTERN → PRONOSTIC SPECIFIC pentru case de pariuri
 *
 * Fiecare pattern mapează la piața EXACTĂ de pariuri pentru pronosticul făcut
 */
const PATTERN_TO_BETTING_MARKET = {
    // GOLURI ECHIPĂ - "Va marca încă un gol"
    'OVER_1_5_GOLURI': 'team_to_score_2h',        // Echipa va marca în R2
    'OVER_2_5_GOLURI': 'team_over_1_5',           // Echipa Over 1.5 goluri FT

    // GOLURI MECI - "Se va mai marca un gol"
    'OVER_2_5_GOLURI_MECI': 'match_over_2_5',     // Peste 2.5 goluri în meci
    'OVER_3_5_GOLURI_MECI': 'match_over_3_5',     // Peste 3.5 goluri în meci
    'UNDER_2_5_GOLURI_MECI': 'match_under_2_5',   // Sub 2.5 goluri în meci

    // BTTS - "Ambele echipe vor marca"
    'BTTS_GOLURI_AMBELE': 'btts_yes',             // Ambele echipe marchează
    'BTTS_NU': 'btts_no',                         // Nu marchează ambele

    // CORNERE - "Se va acorda încă un corner"
    'OVER_CORNERE_R2': 'team_corners_2h_over_2',  // Echipa Over 2 cornere R2
    'OVER_CORNERE_MECI': 'match_corners_over_9',  // Peste 9 cornere în meci

    // CARTONAȘE - "Se va acorda încă un cartonaș"
    'CARTONASE_R2': 'match_cards_2h_over_2',      // Peste 2 cartonașe R2
    'CARTONASE_MECI': 'match_cards_over_4',       // Peste 4 cartonașe în meci
};

/**
 * Mapare piețe pentru case de pariuri (MOCK odds)
 * În producție, aceste cote se vor extrage prin scraping real
 */
const BETTING_MARKETS = {
    // Goluri echipă
    'team_to_score_2h': { typical: 1.65, description: 'Echipa marchează în R2' },
    'team_over_1_5': { typical: 1.75, description: 'Echipa Over 1.5 goluri' },
    'team_over_2_5': { typical: 2.80, description: 'Echipa Over 2.5 goluri' },

    // Goluri meci
    'match_over_2_5': { typical: 1.85, description: 'Peste 2.5 goluri meci' },
    'match_over_3_5': { typical: 2.75, description: 'Peste 3.5 goluri meci' },
    'match_under_2_5': { typical: 1.95, description: 'Sub 2.5 goluri meci' },

    // BTTS
    'btts_yes': { typical: 1.70, description: 'Ambele echipe marchează' },
    'btts_no': { typical: 2.10, description: 'Nu marchează ambele' },

    // Cornere
    'team_corners_2h_over_2': { typical: 1.90, description: 'Echipa Over 2 cornere R2' },
    'match_corners_over_9': { typical: 1.80, description: 'Peste 9 cornere meci' },

    // Cartonașe
    'match_cards_2h_over_2': { typical: 1.85, description: 'Peste 2 cartonașe R2' },
    'match_cards_over_4': { typical: 1.75, description: 'Peste 4 cartonașe meci' }
};

/**
 * Cache pentru cote (evită re-scraping)
 */
const oddsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minute

/**
 * Generează cote MOCK pentru un meci
 *
 * NOTĂ: Aceasta este o implementare MOCK deocamdată
 * Pentru implementare reală, trebuie:
 * 1. Puppeteer/Playwright pentru scraping dinamic
 * 2. Sau API oficial dacă există
 * 3. Autentificare dacă e necesar
 *
 * Cotele sunt generate cu variație random între case de pariuri (+/- 5-10%)
 */
function generateMockOdds(bookmaker = 'superbet') {
    const odds = {};
    const variance = bookmaker === 'superbet' ? 0.95 : 1.05; // Netbet un pic mai mare

    // Generează cote pentru toate piețele din BETTING_MARKETS
    Object.entries(BETTING_MARKETS).forEach(([market, info]) => {
        // Variație mică random pentru a simula cote diferite
        const randomVariance = 0.95 + (Math.random() * 0.15); // ±7.5%
        odds[market] = parseFloat((info.typical * variance * randomVariance).toFixed(2));
    });

    return odds;
}

/**
 * Caută meci pe Superbet
 */
async function searchMatchOnSuperbet(homeTeam, awayTeam) {
    // TODO: Implementare reală scraping
    // Deocamdată returnează cote MOCK

    // Simulare delay pentru request real
    await new Promise(resolve => setTimeout(resolve, 300));

    // Returnează cote MOCK
    return {
        available: true,
        odds: generateMockOdds('superbet')
    };
}

/**
 * Caută meci pe Netbet
 */
async function searchMatchOnNetbet(homeTeam, awayTeam) {
    // TODO: Implementare reală scraping

    await new Promise(resolve => setTimeout(resolve, 300));

    // Returnează cote MOCK
    return {
        available: true,
        odds: generateMockOdds('netbet')
    };
}

/**
 * Extrage cota SPECIFICĂ pentru un pattern
 *
 * @param {object} allOdds - Toate cotele disponibile
 * @param {string} patternName - Numele pattern-ului
 * @returns {number|null} - Cota pentru pattern sau null dacă nu există
 */
function getOddForPattern(allOdds, patternName) {
    const marketKey = PATTERN_TO_BETTING_MARKET[patternName];

    if (!marketKey) {
        return null;
    }

    return allOdds[marketKey] || null;
}

/**
 * Normalizează nume echipă pentru matching
 */
function normalizeTeamName(teamName) {
    return teamName
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
}

/**
 * Verifică dacă meciul există în cache
 */
function getFromCache(homeTeam, awayTeam) {
    const key = `${normalizeTeamName(homeTeam)}_${normalizeTeamName(awayTeam)}`;
    const cached = oddsCache.get(key);

    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        console.log(`   ✅ Cote găsite în cache (${Math.round((Date.now() - cached.timestamp) / 1000)}s vechime)`);
        return cached.data;
    }

    return null;
}

/**
 * Salvează cote în cache
 */
function saveToCache(homeTeam, awayTeam, data) {
    const key = `${normalizeTeamName(homeTeam)}_${normalizeTeamName(awayTeam)}`;
    oddsCache.set(key, {
        timestamp: Date.now(),
        data: data
    });
}

/**
 * Extrage cotele pentru un meci specific
 *
 * @param {string} homeTeam - Echipa gazdă
 * @param {string} awayTeam - Echipa oaspete
 * @param {array} predictions - Lista de pronosticuri pentru care căutăm cote
 * @returns {object} - { superbet: {...}, netbet: {...} }
 */
async function getOddsForMatch(homeTeam, awayTeam, predictions = []) {
    console.log(`\n💰 EXTRAGERE COTE PARIURI\n`);
    console.log('='.repeat(60));
    console.log(`⚽ Meci: ${homeTeam} vs ${awayTeam}`);
    console.log(`📊 Pronosticuri cerute: ${predictions.length}`);

    // Verifică cache
    const cached = getFromCache(homeTeam, awayTeam);
    if (cached) {
        return cached;
    }

    try {
        // Extrage cote de la ambele case
        const [superbetData, netbetData] = await Promise.all([
            searchMatchOnSuperbet(homeTeam, awayTeam),
            searchMatchOnNetbet(homeTeam, awayTeam)
        ]);

        const result = {
            homeTeam: homeTeam,
            awayTeam: awayTeam,
            timestamp: new Date().toISOString(),
            superbet: superbetData.available ? superbetData.odds : null,
            netbet: netbetData.available ? netbetData.odds : null,
            available: superbetData.available || netbetData.available
        };

        // Salvează în cache
        saveToCache(homeTeam, awayTeam, result);

        console.log(`✅ Cote extrase cu succes`);
        console.log(`   Superbet: ${superbetData.available ? 'Disponibil' : 'Indisponibil'}`);
        console.log(`   Netbet: ${netbetData.available ? 'Disponibil' : 'Indisponibil'}`);
        console.log('='.repeat(60));

        return result;

    } catch (error) {
        console.error(`❌ Eroare la extragere cote: ${error.message}`);
        console.log('='.repeat(60));

        return {
            homeTeam: homeTeam,
            awayTeam: awayTeam,
            timestamp: new Date().toISOString(),
            superbet: null,
            netbet: null,
            available: false,
            error: error.message
        };
    }
}

/**
 * Extrage DOAR cotele pentru pronosticurile specifice
 */
function extractRelevantOdds(allOdds, predictions) {
    const relevant = {
        superbet: {},
        netbet: {}
    };

    predictions.forEach(pred => {
        const marketKey = pred.prediction?.bet?.toLowerCase().replace(/\s+/g, '_');

        if (allOdds.superbet && allOdds.superbet[marketKey]) {
            relevant.superbet[pred.patternName] = allOdds.superbet[marketKey];
        }

        if (allOdds.netbet && allOdds.netbet[marketKey]) {
            relevant.netbet[pred.patternName] = allOdds.netbet[marketKey];
        }
    });

    return relevant;
}

/**
 * Afișează cotele într-un format frumos
 */
function displayOdds(odds) {
    console.log(`\n💰 COTE PARIURI\n`);
    console.log('='.repeat(60));

    if (!odds.available) {
        console.log('❌ Cote indisponibile');
        console.log('='.repeat(60));
        return;
    }

    console.log(`⚽ ${odds.homeTeam} vs ${odds.awayTeam}`);
    console.log(`⏰ ${odds.timestamp}\n`);

    if (odds.superbet) {
        console.log('🎰 SUPERBET:');
        Object.entries(odds.superbet).forEach(([market, odd]) => {
            console.log(`   ${market}: ${odd}`);
        });
        console.log('');
    }

    if (odds.netbet) {
        console.log('🎰 NETBET:');
        Object.entries(odds.netbet).forEach(([market, odd]) => {
            console.log(`   ${market}: ${odd}`);
        });
    }

    console.log('='.repeat(60));
}

// Export
module.exports = {
    getOddsForMatch,
    extractRelevantOdds,
    displayOdds,
    searchMatchOnSuperbet,
    searchMatchOnNetbet
};

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log(`
📖 USAGE:

   node BETTING_ODDS_SCRAPER.js <homeTeam> <awayTeam>

📝 EXEMPLU:

   node BETTING_ODDS_SCRAPER.js "Liverpool" "Chelsea"
   node BETTING_ODDS_SCRAPER.js "Real Madrid" "Barcelona"

⚠️  NOTĂ: Deocamdată returnează cote MOCK.
   Pentru cote REALE, trebuie implementat scraping cu Puppeteer.
`);
        process.exit(0);
    }

    const homeTeam = args[0];
    const awayTeam = args[1];

    (async () => {
        try {
            const odds = await getOddsForMatch(homeTeam, awayTeam);
            displayOdds(odds);

        } catch (error) {
            console.error(`\n❌ EROARE: ${error.message}\n`);
            process.exit(1);
        }
    })();
}
