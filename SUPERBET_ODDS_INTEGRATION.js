/**
 * SUPERBET ODDS INTEGRATION
 *
 * Wrapper pentru modulul SUPERBET_LIVE_ODDS
 * Compatibil cu interfața BettingOdds folosită în email-notifier.js
 */

const path = require('path');
const SuperbetLiveOdds = require(path.join(__dirname, '../superbet-analyzer/SUPERBET_LIVE_ODDS'));

class SuperbetOddsIntegration {
    constructor() {
        this.oddsExtractor = new SuperbetLiveOdds();
    }

    /**
     * Obține cote pentru un meci (compatibil cu BettingOdds.getOddsForMatch)
     *
     * @param {string} homeTeam - Echipa gazdă
     * @param {string} awayTeam - Echipa oaspete
     * @param {Array} patterns - Pattern-uri detectate
     * @returns {Object} - Cote în formatul așteptat de email-notifier
     */
    async getOddsForMatch(homeTeam, awayTeam, patterns) {
        try {
            const result = await this.oddsExtractor.getOddsForPatterns(homeTeam, awayTeam, patterns);

            if (!result || !result.available) {
                return {
                    available: false,
                    superbet: null,
                    netbet: null
                };
            }

            // Convertește formatul pentru compatibilitate cu email-notifier
            const superbetOdds = {};

            // Procesează fiecare cotă relevantă
            Object.entries(result.relevantOdds).forEach(([key, value]) => {
                // Simplifică cheia pentru a fi compatibilă cu pattern-ul
                const simpleKey = key.replace(/_inca_un_gol|_inca_2_cornere|_inca_un_cartonas|_echipa_marcheaza|_gg/g, '');

                superbetOdds[simpleKey] = {
                    odd: value.odd,
                    description: value.description,
                    currentValue: value.currentValue
                };
            });

            return {
                available: true,
                superbet: {
                    raw: superbetOdds,
                    currentStats: result.currentStats,
                    eventId: result.eventId,
                    allOdds: result.allOdds,
                    relevantOdds: result.relevantOdds
                },
                netbet: null // Nu avem Netbet momentan
            };

        } catch (error) {
            console.error(`   ❌ Eroare integrare Superbet: ${error.message}`);
            return {
                available: false,
                superbet: null,
                netbet: null
            };
        }
    }
}

module.exports = new SuperbetOddsIntegration();
