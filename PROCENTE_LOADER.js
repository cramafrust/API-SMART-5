/**
 * 📊 PROCENTE LOADER
 *
 * Încarcă procentele de reușită pentru pattern-uri din JSON PROCENTE AUTOACTUAL.json
 * Returnează probabilitatea pentru un pattern specific bazat pe:
 * - Campionat (Premier League, LaLiga, etc.)
 * - Tier echipă (TOP_1-5, MID_6-10, etc.)
 * - Pattern ID (PATTERN_1.3, PATTERN_4.5, etc.)
 */

const fs = require('fs');
const path = require('path');

class ProcenteLoader {
    constructor(jsonPath = null) {
        this.jsonPath = jsonPath || path.join(__dirname, 'data', 'procente', 'JSON PROCENTE AUTOACTUAL.json');
        this.data = null;
        this.loaded = false;
    }

    /**
     * Încarcă JSON-ul cu procente
     */
    load() {
        try {
            const rawData = fs.readFileSync(this.jsonPath, 'utf-8');
            this.data = JSON.parse(rawData);
            this.loaded = true;

            console.log(`✅ Încărcat JSON PROCENTE AUTOACTUAL`);
            console.log(`   Campionate: ${Object.keys(this.data.campionate).length}`);
            console.log(`   Data actualizare: ${this.data.data_ultima_actualizare_ro}`);

            return true;
        } catch (error) {
            console.error('❌ Eroare la încărcare JSON PROCENTE:', error.message);
            this.loaded = false;
            return false;
        }
    }

    /**
     * Normalizează numele campionatului
     */
    normalizeLeagueName(league) {
        const normalized = league.toLowerCase().trim();

        // Map-uri pentru normalizare (pointează la numele din JSON PROCENTE)
        const leagueMap = {
            'england: premier league': 'ENGLAND: Premier League',
            'premier league': 'ENGLAND: Premier League',
            'spain: laliga': 'SPAIN: LaLiga',
            'laliga': 'SPAIN: LaLiga',
            'la liga': 'SPAIN: LaLiga',
            'italy: serie a': 'ITALY: Serie A',
            'serie a': 'ITALY: Serie A',
            'germany: bundesliga': 'GERMANY: Bundesliga',
            'bundesliga': 'GERMANY: Bundesliga',
            'germany: 2. bundesliga': 'GERMANY: 2. Bundesliga',
            '2. bundesliga': 'GERMANY: 2. Bundesliga',
            '2.bundesliga': 'GERMANY: 2. Bundesliga',
            'france: ligue 1': 'FRANCE: Ligue 1',
            'ligue 1': 'FRANCE: Ligue 1',
            'portugal: liga portugal': 'PORTUGAL: Liga Portugal',
            'liga portugal': 'PORTUGAL: Liga Portugal',
            'primeira liga': 'PORTUGAL: Liga Portugal',
            'netherlands: eredivisie': 'NETHERLANDS: Eredivisie',
            'eredivisie': 'NETHERLANDS: Eredivisie',
            'austria: bundesliga': 'AUSTRIA: Bundesliga',
            'austria bundesliga': 'AUSTRIA: Bundesliga',
            'austrian bundesliga': 'AUSTRIA: Bundesliga',
            'denmark: superliga': 'DENMARK: Superliga',
            'superligaen': 'DENMARK: Superliga',
            'greece: super league': 'GREECE: Super League',
            'greek super league': 'GREECE: Super League',
            'cyprus': 'GREECE: Super League',
            'cyprus league': 'GREECE: Super League',
            'romania: superliga': 'ROMANIA: Superliga',
            'superliga romania': 'ROMANIA: Superliga',
            'turkey: super lig': 'TURKEY: Super Lig',
            'super lig': 'TURKEY: Super Lig',
            'süper lig': 'TURKEY: Super Lig',
            'turcia': 'TURKEY: Super Lig',
            'poland: ekstraklasa': 'POLAND: Ekstraklasa',
            'ekstraklasa': 'POLAND: Ekstraklasa',
            'polonia: ekstraklasa': 'POLAND: Ekstraklasa',
            'belgium: jupiler pro league': 'BELGIUM: Jupiler Pro League',
            'jupiler pro league': 'BELGIUM: Jupiler Pro League',
            'england: championship': 'ENGLAND: Championship',
            'championship': 'ENGLAND: Championship',
            'norway: eliteserien': 'NORWAY: Eliteserien',
            'eliteserien': 'NORWAY: Eliteserien',
            'scotland: premiership': 'SCOTLAND: Premiership',
            'premiership': 'SCOTLAND: Premiership',
            'switzerland: super league': 'SWITZERLAND: Super League',
            'sweden: allsvenskan': 'SWEDEN: Allsvenskan',
            'allsvenskan': 'SWEDEN: Allsvenskan',
            'serbia: mozzart bet super liga': 'SERBIA: Mozzart Bet Super Liga',
            'spain: laliga2': 'SPAIN: LaLiga2',
            'laliga2': 'SPAIN: LaLiga2',
            'usa: mls': 'USA: MLS',
            'mls': 'USA: MLS',
            'argentina: liga profesional': 'ARGENTINA: Liga Profesional - Apertura',
            // Champions League — toate fazele mapate la aceleași procente
            'europe: champions league - league phase': 'UEFA Champions League',
            'europe: champions league - play offs': 'UEFA Champions League',
            'europe: champions league - knockout round play-offs': 'UEFA Champions League',
            'europe: champions league - round of 16': 'UEFA Champions League',
            'europe: champions league - quarter-finals': 'UEFA Champions League',
            'europe: champions league - semi-finals': 'UEFA Champions League',
            'europe: champions league': 'UEFA Champions League',
            'champions league': 'UEFA Champions League',
            'uefa champions league': 'UEFA Champions League',
            // Europa League — toate fazele
            'europe: europa league - league phase': 'UEFA Europa League',
            'europe: europa league - play offs': 'UEFA Europa League',
            'europe: europa league - knockout round play-offs': 'UEFA Europa League',
            'europe: europa league': 'UEFA Europa League',
            'europa league': 'UEFA Europa League',
            'uefa europa league': 'UEFA Europa League',
            // Conference League — toate fazele
            'europe: conference league - league phase': 'UEFA Conference League',
            'europe: conference league - play offs': 'UEFA Conference League',
            'europe: conference league - knockout round play-offs': 'UEFA Conference League',
            'europe: conference league': 'UEFA Conference League',
            'conference league': 'UEFA Conference League',
            'uefa conference league': 'UEFA Conference League'
        };

        for (const [key, value] of Object.entries(leagueMap)) {
            if (normalized.includes(key)) {
                return value;
            }
        }

        return null;
    }

    /**
     * Detectează tier-ul echipei bazat pe poziția în clasament și JSON
     * @param {number} position - Poziția în clasament
     * @param {number} totalTeams - Total echipe în campionat
     * @param {string} leagueName - Numele campionatului (opțional, pentru logică specifică)
     * @returns {string} - Tier-ul echipei (TOP_1-5, MID_6-10, etc.)
     */
    detectTierFromPosition(position, totalTeams = 20, leagueName = null) {
        // Dacă avem numele campionatului și JSON este încărcat, detectăm tier-ul din JSON
        if (leagueName && this.loaded) {
            const normalizedLeague = this.normalizeLeagueName(leagueName);

            if (normalizedLeague && this.data.campionate[normalizedLeague]) {
                const categories = this.data.campionate[normalizedLeague].categorii_clasament;

                if (categories) {
                    // Găsește tier-ul potrivit bazat pe poziție
                    for (const category of categories) {
                        const [min, max] = category.pozitii.split('-').map(Number);
                        if (position >= min && position <= max) {
                            return category.nume;
                        }
                    }
                }
            }
        }

        // Fallback: Champions League (36 echipe)
        if (totalTeams === 36 || (leagueName && leagueName.toLowerCase().includes('champions'))) {
            if (position >= 1 && position <= 8) return 'TOP_1-8';
            if (position >= 9 && position <= 24) return 'MID_9-24';
            if (position >= 25) return 'BOTTOM_25-36';
            return 'MID_9-24';
        }

        // Fallback: Championship (24 echipe)
        if (totalTeams === 24) {
            if (position >= 1 && position <= 6) return 'TOP_1-6';
            if (position >= 7 && position <= 15) return 'MID_7-15';
            if (position >= 16 && position <= 21) return 'LOW_16-21';
            if (position >= 22) return 'BOTTOM_22-24';
            return 'MID_7-15';
        }

        // Fallback: Campionate normale (20 echipe - Premier League, La Liga, Serie A, etc.)
        if (totalTeams === 20) {
            if (position >= 1 && position <= 5) return 'TOP_1-5';
            if (position >= 6 && position <= 10) return 'MID_6-10';
            if (position >= 11 && position <= 15) return 'LOW_11-15';
            if (position >= 16) return 'BOTTOM_16-20';
            return 'MID_6-10';
        }

        // Fallback: Campionate mici (16-18 echipe - Bundesliga, Belgium, etc.)
        if (totalTeams <= 18) {
            if (position >= 1 && position <= 5) return 'TOP_1-5';
            if (position >= 6 && position <= 10) return 'MID_6-10';
            if (position >= 11 && position <= 14) return 'LOW_11-14';
            if (position >= 15) return 'BOTTOM_15-18';
            return 'MID_6-10';
        }

        return 'MID_6-10'; // Default fallback
    }

    /**
     * Obține procentul de reușită pentru un pattern
     *
     * @param {string} leagueName - Numele campionatului (ex: "Premier League")
     * @param {string} tier - Tier-ul echipei (ex: "TOP_1-5")
     * @param {string} patternId - ID-ul pattern-ului (ex: "PATTERN_1.3")
     * @returns {Object|null} - { procent, cazuri, succes } sau null dacă nu există
     */
    getPatternProbability(leagueName, tier, patternId) {
        if (!this.loaded) {
            console.warn('⚠️  JSON PROCENTE nu este încărcat. Rulați .load() mai întâi.');
            return null;
        }

        // Normalizează numele campionatului
        const normalizedLeague = this.normalizeLeagueName(leagueName);

        if (!normalizedLeague) {
            console.warn(`⚠️  Campionat necunoscut: ${leagueName}`);
            return null;
        }

        // Verifică dacă campionatul există în JSON
        const leagueData = this.data.campionate[normalizedLeague];

        if (!leagueData) {
            console.warn(`⚠️  Campionat ${normalizedLeague} nu există în JSON PROCENTE`);
            return null;
        }

        // Verifică dacă tier-ul există
        const tierData = leagueData.procente_reusita[tier];

        if (!tierData) {
            console.warn(`⚠️  Tier ${tier} nu există pentru ${normalizedLeague}`);
            return null;
        }

        // Verifică dacă pattern-ul există
        const patternData = tierData[patternId];

        if (!patternData) {
            // Pattern-ul nu există pentru acest tier/campionat
            return null;
        }

        return {
            procent: patternData.procent,
            cazuri: patternData.cazuri,
            succes: patternData.succes,
            league: normalizedLeague,
            tier: tier,
            patternId: patternId
        };
    }

    /**
     * Obține procentul cu fallback (dacă nu există pentru campionat, încearcă altul similar)
     *
     * @param {string} leagueName - Numele campionatului
     * @param {string} tier - Tier-ul echipei
     * @param {string} patternId - ID-ul pattern-ului
     * @returns {Object|null} - Date cu procent + flag isEstimate
     */
    getPatternProbabilityWithFallback(leagueName, tier, patternId) {
        // 1. Încearcă mai întâi campionatul original + tier-ul exact
        const result = this.getPatternProbability(leagueName, tier, patternId);

        if (result) {
            return {
                ...result,
                isEstimate: false,
                originalLeague: leagueName,
                leagueUsedForData: result.league
            };
        }

        // 2. Încearcă tier-uri adiacente din ACELAȘI campionat
        const tierOrder = ['TOP_1-5', 'MID_6-10', 'LOW_11-15', 'BOTTOM_16-20',
                          'TOP_1-6', 'MID_7-15', 'LOW_16-21', 'BOTTOM_22-24',
                          'TOP_1-8', 'MID_9-24', 'BOTTOM_25-36',
                          'BOTTOM_16-18', 'LOW_11-14', 'BOTTOM_15-18'];
        const normalizedLeague = this.normalizeLeagueName(leagueName);
        const leagueData = normalizedLeague ? this.data.campionate[normalizedLeague] : null;

        if (leagueData && leagueData.procente_reusita) {
            const availableTiers = Object.keys(leagueData.procente_reusita);
            for (const altTier of availableTiers) {
                if (altTier === tier) continue;
                const altResult = this.getPatternProbability(leagueName, altTier, patternId);
                if (altResult) {
                    console.log(`   ℹ️  Folosesc tier ${altTier} în loc de ${tier} pentru ${patternId} în ${leagueName}`);
                    return {
                        ...altResult,
                        isEstimate: true,
                        originalLeague: leagueName,
                        leagueUsedForData: altResult.league,
                        tierUsed: altTier,
                        tierRequested: tier
                    };
                }
            }
        }

        // 3. Fallback: încearcă campionate similare (big 5 leagues)
        const fallbackLeagues = ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1'];

        for (const fallbackLeague of fallbackLeagues) {
            const fallbackResult = this.getPatternProbability(fallbackLeague, tier, patternId);

            if (fallbackResult) {
                console.log(`   ⚠️  Folosesc date estimate de la ${fallbackLeague} pentru ${leagueName}`);
                return {
                    ...fallbackResult,
                    isEstimate: true,
                    originalLeague: leagueName,
                    leagueUsedForData: fallbackResult.league
                };
            }
        }

        // Nu am găsit niciun rezultat
        console.warn(`❌ Nu am găsit procente pentru ${patternId} în ${leagueName} (tier: ${tier})`);
        return null;
    }

    /**
     * Atașează procente la o listă de pattern-uri găsite
     *
     * @param {Array} patterns - Array de pattern-uri cu { name, team, stats }
     * @param {string} leagueName - Numele campionatului
     * @param {string} tier - Tier-ul echipei
     * @returns {Array} - Pattern-uri cu procente atașate
     */
    attachProbabilitiesToPatterns(patterns, leagueName, tier) {
        if (!this.loaded) {
            console.warn('⚠️  JSON PROCENTE nu este încărcat');
            return patterns;
        }

        const enrichedPatterns = [];

        patterns.forEach(pattern => {
            const probability = this.getPatternProbabilityWithFallback(leagueName, tier, pattern.name);

            if (probability) {
                enrichedPatterns.push({
                    ...pattern,
                    probability: probability.procent,
                    sampleSize: probability.cazuri,
                    successCount: probability.succes,
                    isEstimate: probability.isEstimate,
                    originalLeague: probability.originalLeague,
                    leagueUsedForData: probability.leagueUsedForData
                });
            } else {
                // Nu am găsit procente pentru acest pattern, sărim peste el
                console.log(`   ⚪ Sărit pattern ${pattern.name} (lipsă date procente)`);
            }
        });

        return enrichedPatterns;
    }

    /**
     * Afișează toate campionatele disponibile
     */
    getAvailableLeagues() {
        if (!this.loaded) {
            console.warn('⚠️  JSON PROCENTE nu este încărcat');
            return [];
        }

        return Object.keys(this.data.campionate);
    }

    /**
     * Afișează toate tier-urile disponibile pentru un campionat
     */
    getAvailableTiers(leagueName) {
        if (!this.loaded) {
            console.warn('⚠️  JSON PROCENTE nu este încărcat');
            return [];
        }

        const normalizedLeague = this.normalizeLeagueName(leagueName);
        const leagueData = this.data.campionate[normalizedLeague];

        if (!leagueData) {
            return [];
        }

        return Object.keys(leagueData.procente_reusita);
    }

    /**
     * Afișează toate pattern-urile disponibile pentru un campionat și tier
     */
    getAvailablePatterns(leagueName, tier) {
        if (!this.loaded) {
            console.warn('⚠️  JSON PROCENTE nu este încărcat');
            return [];
        }

        const normalizedLeague = this.normalizeLeagueName(leagueName);
        const leagueData = this.data.campionate[normalizedLeague];

        if (!leagueData) {
            return [];
        }

        const tierData = leagueData.procente_reusita[tier];

        if (!tierData) {
            return [];
        }

        return Object.keys(tierData);
    }
}

module.exports = ProcenteLoader;

// Test dacă rulăm direct scriptul
if (require.main === module) {
    console.log('🧪 TEST PROCENTE LOADER\n');

    const loader = new ProcenteLoader();

    // Încarcă JSON-ul
    if (!loader.load()) {
        console.error('❌ Nu am putut încărca JSON-ul');
        process.exit(1);
    }

    console.log('\n📋 Campionate disponibile:');
    loader.getAvailableLeagues().forEach(league => {
        console.log(`   • ${league}`);
    });

    // Test: obține procent pentru un pattern
    console.log('\n🧪 Test: Premier League, TOP_1-5, PATTERN_1.3');
    const result1 = loader.getPatternProbability('Premier League', 'TOP_1-5', 'PATTERN_1.3');
    if (result1) {
        console.log(`   ✅ Probabilitate: ${result1.procent}% (${result1.cazuri} cazuri, ${result1.succes} succese)`);
    } else {
        console.log('   ❌ Nu există date');
    }

    // Test: obține procent cu fallback
    console.log('\n🧪 Test: Liga Necunoscută, TOP_1-5, PATTERN_1.3 (cu fallback)');
    const result2 = loader.getPatternProbabilityWithFallback('Liga Necunoscută', 'TOP_1-5', 'PATTERN_1.3');
    if (result2) {
        console.log(`   ✅ Probabilitate: ${result2.procent}% (${result2.isEstimate ? 'ESTIMATE' : 'VERIFICAT'})`);
        console.log(`   📊 Date de la: ${result2.leagueUsedForData}`);
    } else {
        console.log('   ❌ Nu există date nici cu fallback');
    }

    // Test: atașează procente la pattern-uri
    console.log('\n🧪 Test: Atașare procente la pattern-uri');
    const mockPatterns = [
        { name: 'PATTERN_1.3', team: 'gazda' },
        { name: 'PATTERN_4.5', team: 'gazda' },
        { name: 'PATTERN_9.3', team: 'meci' }
    ];

    const enriched = loader.attachProbabilitiesToPatterns(mockPatterns, 'Premier League', 'TOP_1-5');
    console.log(`   📥 Input: ${mockPatterns.length} pattern-uri`);
    console.log(`   📤 Output: ${enriched.length} pattern-uri cu procente`);

    enriched.forEach(p => {
        console.log(`   • ${p.name} → ${p.probability}% (${p.sampleSize} cazuri)`);
    });

    console.log('\n✅ Test finalizat!\n');
}
