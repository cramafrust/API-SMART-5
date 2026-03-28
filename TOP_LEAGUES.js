/**
 * TOP 30 CAMPIONATE din lume (whitelist)
 * DOAR acestea vor primi notificări
 */

const TOP_LEAGUES = [
    // ⭐ LIGI CU DATE STATISTICE (din JSON PROCENTE) - PRIORITATE MAXIMĂ
    'premier league',           // Anglia - JSON ✅
    'la liga',                  // Spania - JSON ✅
    'laliga',                   // Spania (varianta) - JSON ✅
    'serie a',                  // Italia - JSON ✅
    'bundesliga',               // Germania - JSON ✅
    '2. bundesliga',            // Germania liga 2 - JSON ✅ (CERUT explicit)
    'ligue 1',                  // Franța - JSON ✅
    'eredivisie',               // Olanda - JSON ✅
    'primeira liga',            // Portugalia - JSON ✅
    'liga portugal',            // Portugalia (varianta) - JSON ✅
    'austrian bundesliga',      // Austria - JSON ✅
    'austria bundesliga',       // Austria (varianta) - JSON ✅
    'superliga',                // România/Danemarca - JSON ✅
    'cyprus league',            // Cipru - JSON ✅
    'cyprus first division',    // Cipru (varianta) - JSON ✅

    // Top Ligi Europene
    'championship',             // Anglia liga 2 (EXCEPȚIE - e competitivă)
    'scottish premiership',     // Scoția

    // Top 20
    'super lig',                // Turcia
    'primeira liga',            // Brazilia
    'brasileirao',              // Brazilia (varianta)
    'serie a',                  // Brazilia (se numește la fel ca Italia)
    'superliga',                // Argentina
    'liga profesional',         // Argentina
    'primera division',         // Argentina
    'mls',                      // USA (major league)
    'eredivisie',               // Belgia
    'jupiler pro league',       // Belgia
    'pro league',               // Belgia (varianta)

    // Top 30
    'super league',             // Elveția
    'austrian bundesliga',      // Austria
    'superliga',                // Danemarca
    'superligaen',              // Danemarca (varianta)
    'eliteserien',              // Norvegia
    'allsvenskan',              // Suedia
    'ekstraklasa',              // Polonia
    'super liga',               // Serbia
    'first league',             // Croația
    'greek super league',       // Grecia
    'super league 1',           // Grecia (varianta)

    // Competiții internaționale (DOAR UEFA - AFC exclusă în blacklist)
    'champions league',          // UEFA Champions League (Europa) - AFC blocată în blacklist!
    'europa league',
    'conference league',
    'copa libertadores',
    'copa sudamericana',
    'world cup',
    'euro',
    'copa america'
];

/**
 * Verifică dacă o ligă este în top 30 (ULTRA STRICT - țară + ligă)
 * @param {string} leagueName - Numele complet "COUNTRY: League Name"
 * @returns {boolean} - True dacă e în top 30
 */
function isTopLeague(leagueName) {
    if (!leagueName) return false;

    const normalized = leagueName.toLowerCase();

    // BLOCARE EXPLICITĂ: Ligi secundare, tineret, rezerve, ASIA
    const blacklist = [
        'u21', 'u19', 'u18', 'u17',
        'under ',
        'youth',
        'reserve',
        ' ii',
        ' b ',
        'women',
        ' w ',
        'next pro',
        'usl ',
        'serie c',
        'serie d',
        'premier league 2',  // Liga U21 Anglia
        'liga portugal 2',   // Liga 2 Portugalia (nu e top)
        'challenger pro league',  // Belgia divizia 2 (inferioară)
        'paulista a2',        // Brazilia Paulista liga 2
        'paulista a3',        // Brazilia Paulista liga 3
        'paulista a4',        // Brazilia Paulista liga 4 (amatori)
        'super league 2',     // Grecia liga 2
        'laliga2',            // Spania liga 2
        'la liga 2',          // Spania liga 2 (varianta)

        // 🚫 COMPETIȚII DIN ASIA (EXCLUSE EXPLICIT)
        'afc champions league',       // Liga Campionilor din Asia
        'afc champions league 2',     // Liga Campionilor din Asia (nivelul 2)
        'afc champions league elite', // Varianta Elite
        'gulf club champions',        // Liga din Golf
        'afc cup',                    // Cupa AFC
        'asean club championship',    // Campionatul Cluburilor ASEAN
        'afc ',                        // Orice competiție AFC
        'asia: '                       // Orice competiție din Asia
    ];

    // Verificare blacklist
    for (const blocked of blacklist) {
        if (normalized.includes(blocked)) {
            return false;
        }
    }

    // ULTRA STRICT - perechi (țară + ligă) validate
    const validPairs = [
        // Top 5 ligi
        { country: 'england', league: 'premier league' },
        { country: 'england', league: 'championship' },
        { country: 'spain', league: 'laliga' },
        { country: 'spain', league: 'la liga' },
        { country: 'italy', league: 'serie a' },
        { country: 'germany', league: 'bundesliga' },
        { country: 'france', league: 'ligue 1' },

        // Ligi TOP validate
        { country: 'netherlands', league: 'eredivisie' },
        { country: 'portugal', league: 'liga portugal' },
        { country: 'portugal', league: 'primeira liga' },
        { country: 'turkey', league: 'super lig' },
        { country: 'belgium', league: 'jupiler pro league' },
        { country: 'belgium', league: 'pro league' },
        { country: 'scotland', league: 'premiership' },
        { country: 'austria', league: 'bundesliga' },
        { country: 'denmark', league: 'superliga' },
        { country: 'sweden', league: 'allsvenskan' },
        { country: 'norway', league: 'eliteserien' },
        { country: 'poland', league: 'ekstraklasa' },
        { country: 'romania', league: 'superliga' },
        { country: 'serbia', league: 'super liga' },
        { country: 'croatia', league: 'first' },
        { country: 'greece', league: 'super league' },
        { country: 'switzerland', league: 'super league' },

        // Sud America - Campionate naționale
        { country: 'brazil', league: 'serie a' },
        { country: 'brazil', league: 'brasileirao' },
        { country: 'brazil', league: 'primeira liga' },
        { country: 'brazil', league: 'paulista' },           // Campionatul statului São Paulo
        { country: 'argentina', league: 'primera division' },
        { country: 'argentina', league: 'liga profesional' },
        { country: 'argentina', league: 'superliga' },

        // Competiții internaționale (DOAR EUROPA și SUD AMERICA)
        { country: 'europe', league: 'champions league' },  // UEFA Champions League (Europa)
        { country: 'europe', league: 'europa league' },
        { country: 'europe', league: 'conference league' },
        { country: 'south america', league: 'copa libertadores' },
        { country: 'south america', league: 'copa sudamericana' },

        // USA
        { country: 'usa', league: 'mls' }
    ];

    // Verificare perechi validate
    for (const pair of validPairs) {
        if (normalized.includes(pair.country) && normalized.includes(pair.league)) {
            return true;
        }
    }

    return false;
}

module.exports = {
    TOP_LEAGUES,
    isTopLeague
};
