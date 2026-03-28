/**
 * 📝 PATTERN DESCRIPTOR
 *
 * Transformă pattern-uri în descrieri clare și ușor de înțeles
 * Ex: PATTERN_5.7 → "Echipa a avut 7 șuturi + 5 cornere la pauză"
 */

class PatternDescriptor {
    constructor() {
        // Map pentru descrieri pattern-uri
        this.patternDescriptions = {
            // Pattern-uri 1.x - Șuturi pe poartă fără gol
            'PATTERN_1.0': (stats, team) => ({
                description: `${team} a avut ${stats.suturiPePtPauza || 3} șuturi pe poartă la pauză`,
                context: 'dar nu a marcat încă'
            }),
            'PATTERN_1.1': (stats, team) => ({
                description: `${team} a avut ${stats.suturiPePtPauza || 4} șuturi pe poartă la pauză`,
                context: 'dar nu a marcat încă'
            }),
            'PATTERN_1.2': (stats, team) => ({
                description: `${team} a avut ${stats.suturiPePtPauza || 5} șuturi pe poartă la pauză`,
                context: 'dar nu a marcat încă'
            }),
            'PATTERN_1.3': (stats, team) => ({
                description: `${team} a avut ${stats.suturiPePtPauza || 6} șuturi pe poartă la pauză`,
                context: 'dar nu a marcat încă'
            }),
            'PATTERN_1.4': (stats, team) => ({
                description: `${team} a avut ${stats.suturiPePtPauza || 7} șuturi pe poartă la pauză`,
                context: 'dar nu a marcat încă'
            }),
            'PATTERN_1.5': (stats, team) => ({
                description: `${team} a avut ${stats.suturiPePtPauza || 8} șuturi pe poartă la pauză`,
                context: 'dar nu a marcat încă'
            }),
            'PATTERN_1.6': (stats, team) => ({
                description: `${team} a avut ${stats.suturiPePtPauza || 9} șuturi pe poartă la pauză`,
                context: 'dar nu a marcat încă'
            }),

            // Pattern-uri 2.x - Total suturi (MODIFICAT: din "șuturi pe lângă" în "total suturi")
            'PATTERN_2.1': (stats, team) => ({
                description: `${team} a avut ${stats.totalSuturiPauza || 6} suturi totale la pauză`,
                context: 'dar nu a marcat încă'
            }),
            'PATTERN_2.2': (stats, team) => ({
                description: `${team} a avut ${stats.totalSuturiPauza || 7} suturi totale la pauză`,
                context: 'dar nu a marcat încă'
            }),
            'PATTERN_2.3': (stats, team) => ({
                description: `${team} a avut ${stats.totalSuturiPauza || 8} suturi totale la pauză`,
                context: 'dar nu a marcat încă'
            }),
            'PATTERN_2.4': (stats, team) => ({
                description: `${team} a avut ${stats.totalSuturiPauza || 9} suturi totale la pauză`,
                context: 'dar nu a marcat încă'
            }),
            'PATTERN_2.5': (stats, team) => ({
                description: `${team} a avut ${stats.totalSuturiPauza || 10} suturi totale la pauză`,
                context: 'dar nu a marcat încă'
            }),

            // Pattern 3.x - Total goluri
            'PATTERN_3.3': (stats, team) => ({
                description: `Cele două echipe au marcat 3 goluri la pauză`,
                context: 'meci cu multe goluri'
            }),
            'PATTERN_3.4': (stats, team) => ({
                description: `Cele două echipe au marcat 4 goluri la pauză`,
                context: 'meci spectaculos'
            }),
            'PATTERN_3.5+': (stats, team) => ({
                description: `Cele două echipe au marcat 5+ goluri la pauză`,
                context: 'meci cu foarte multe goluri'
            }),

            // Pattern 4.x - Cornere
            'PATTERN_4.5': (stats, team) => ({
                description: `${team} a avut ${stats.cornerePauza || 5} cornere la pauză`,
                context: 'fără a marca'
            }),
            'PATTERN_4.6': (stats, team) => ({
                description: `${team} a avut ${stats.cornerePauza || 6} cornere la pauză`,
                context: 'fără a marca'
            }),
            'PATTERN_4.7': (stats, team) => ({
                description: `${team} a avut ${stats.cornerePauza || 7} cornere la pauză`,
                context: 'fără a marca'
            }),
            'PATTERN_4.8': (stats, team) => ({
                description: `${team} a avut ${stats.cornerePauza || 8} cornere la pauză`,
                context: 'fără a marca'
            }),

            // Pattern 5.x - Combinație șuturi + cornere (SE VERIFICĂ SUMA!)
            'PATTERN_5.5': (stats, team) => {
                const shots = stats.suturiPePtPauza || 0;
                const corners = stats.cornerePauza || 0;
                const total = shots + corners;
                return {
                    description: `${team} a avut TOTAL ${total} ACȚIUNI OFENSIVE (${shots} șuturi + ${corners} cornere) la pauză`,
                    context: 'dar nu a marcat încă'
                };
            },
            'PATTERN_5.6': (stats, team) => {
                const shots = stats.suturiPePtPauza || 0;
                const corners = stats.cornerePauza || 0;
                const total = shots + corners;
                return {
                    description: `${team} a avut TOTAL ${total} ACȚIUNI OFENSIVE (${shots} șuturi + ${corners} cornere) la pauză`,
                    context: 'dar nu a marcat încă'
                };
            },
            'PATTERN_5.7': (stats, team) => {
                const shots = stats.suturiPePtPauza || 0;
                const corners = stats.cornerePauza || 0;
                const total = shots + corners;
                return {
                    description: `${team} a avut TOTAL ${total} ACȚIUNI OFENSIVE (${shots} șuturi + ${corners} cornere) la pauză`,
                    context: 'dar nu a marcat încă'
                };
            },
            'PATTERN_5.8': (stats, team) => {
                const shots = stats.suturiPePtPauza || 0;
                const corners = stats.cornerePauza || 0;
                const total = shots + corners;
                return {
                    description: `${team} a avut TOTAL ${total} ACȚIUNI OFENSIVE (${shots} șuturi + ${corners} cornere) la pauză`,
                    context: 'dar nu a marcat încă'
                };
            },

            // Pattern 6.x - Continuitate cornere
            'PATTERN_6.3': (stats, team) => ({
                description: `${team} a avut 3 cornere și are 3 șuturi pe poartă la pauză`,
                context: 'atacuri eficiente'
            }),
            'PATTERN_6.4': (stats, team) => ({
                description: `${team} a avut 3 cornere și are 4 șuturi pe poartă la pauză`,
                context: 'atacuri eficiente'
            }),
            'PATTERN_6.5': (stats, team) => ({
                description: `${team} a avut 2 cornere și are 4 șuturi pe poartă la pauză`,
                context: 'atacuri eficiente'
            }),
            'PATTERN_6.6': (stats, team) => ({
                description: `${team} a avut 2 cornere și are 3 șuturi pe poartă la pauză`,
                context: 'atacuri eficiente'
            }),
            'PATTERN_6.7': (stats, team) => ({
                description: `${team} a avut 4 cornere și are 2 șuturi pe poartă la pauză`,
                context: 'atacuri eficiente'
            }),
            'PATTERN_6.8': (stats, team) => ({
                description: `${team} a avut 4 cornere și are 1 șuturi pe poartă la pauză`,
                context: 'atacuri eficiente'
            }),

            // Pattern 7.x.y - Cornere + salvări
            'PATTERN_7.2.1': (stats, team) => ({
                description: `${team} a avut ${stats.cornerePauza || 2} cornere, iar portarul adversar a făcut ${stats.adversarSalvariPauza || 1} salvare`,
                context: 'șanse clare ratate'
            }),
            'PATTERN_7.5.3': (stats, team) => ({
                description: `${team} a avut ${stats.cornerePauza || 5} cornere, iar portarul adversar a făcut ${stats.adversarSalvariPauza || 3} salvări`,
                context: 'șanse clare ratate'
            }),

            // Pattern 8.x.y.z - Combinație cornere + salvări + șuturi
            'PATTERN_8.5.3': (stats, team) => ({
                description: `${team} a avut ${stats.suturiPePtPauza || 5} șuturi, ${stats.cornerePauza || 5} cornere și portarul adversar a făcut ${stats.adversarSalvariPauza || 3} salvări`,
                context: 'dominare totală'
            }),
            'PATTERN_8.2.1': (stats, team) => ({
                description: `${team} a avut ${stats.suturiPePtPauza || 2} șuturi, ${stats.cornerePauza || 2} cornere și portarul adversar a făcut ${stats.adversarSalvariPauza || 1} salvare`,
                context: 'presiune constantă'
            }),

            // Pattern 9.x - Cartonașe galbene
            'PATTERN_9.3': (stats, team) => ({
                description: `3 cartonașe galbene la pauză → va mai fi încă UN CARTONAȘE în R2`,
                context: 'meci intens, faulturi frecvente → probabilitate cartonas suplimentar'
            }),
            'PATTERN_9.4': (stats, team) => ({
                description: `4 cartonașe galbene la pauză → va mai fi încă UN CARTONAȘE în R2`,
                context: 'meci foarte intens → probabilitate ridicată cartonas suplimentar'
            }),
            'PATTERN_9.5': (stats, team) => ({
                description: `5 cartonașe galbene la pauză → va mai fi încă UN CARTONAȘE în R2`,
                context: 'meci extrem de intens → probabilitate foarte ridicată cartonas suplimentar'
            }),
            'PATTERN_9.6': (stats, team) => ({
                description: `6 cartonașe galbene la pauză → va mai fi încă UN CARTONAȘE în R2`,
                context: 'meci cu multe faulturi → aproape sigur încă un cartonas'
            }),
            'PATTERN_9.7': (stats, team) => ({
                description: `7+ cartonașe galbene la pauză → va mai fi încă UN CARTONAȘE în R2`,
                context: 'meci foarte dur → foarte probabil încă un cartonas (sau chiar roșu)'
            }),

            // Pattern 0.0 - Cărtonaș roșu adversar
            'PATTERN_0.0': (stats, team) => ({
                description: `${team} joacă împotriva unei echipe cu cărtonaș roșu`,
                context: 'superioritate numerică'
            })
        };
    }

    /**
     * Generează descriere pattern generic (fallback)
     */
    generateGenericDescription(patternId, team) {
        // Extrage numere din pattern ID
        const numbers = patternId.match(/\d+/g);

        if (patternId.startsWith('PATTERN_1.')) {
            return {
                description: `${team} a avut ${numbers[1] || 3}+ șuturi pe poartă la pauză`,
                context: 'fără a marca'
            };
        } else if (patternId.startsWith('PATTERN_4.')) {
            return {
                description: `${team} a avut ${numbers[1] || 5}+ cornere la pauză`,
                context: 'fără a marca'
            };
        }

        return {
            description: `Pattern ${patternId}`,
            context: ''
        };
    }

    /**
     * Obține descriere completă pentru un pattern
     */
    getDescription(patternId, team, stats = {}) {
        const descriptionFunc = this.patternDescriptions[patternId];

        if (descriptionFunc) {
            return descriptionFunc(stats, team);
        }

        // Fallback pentru pattern-uri necunoscute
        return this.generateGenericDescription(patternId, team);
    }

    /**
     * Generează predicție text bazat pe probabilitate
     */
    getPredictionText(probability) {
        if (probability >= 95) {
            return `există ${probability}% șanse să marcheze în repriza 2`;
        } else if (probability >= 85) {
            return `există ${probability}% șanse să marcheze în repriza 2`;
        } else if (probability >= 75) {
            return `există ${probability}% șanse să marcheze cel puțin 1 gol în repriza 2`;
        } else if (probability >= 65) {
            return `există ${probability}% șanse să marcheze în repriza 2`;
        } else {
            return `există ${probability}% șanse să marcheze în repriza 2`;
        }
    }

    /**
     * Formatează mesaj complet pentru email/notificare (VERSIUNE SCURTĂ - legacy)
     */
    formatFullMessage(patternId, team, probability, stats = {}) {
        const desc = this.getDescription(patternId, team, stats);
        const prediction = this.getPredictionText(probability);

        let message = desc.description;
        if (desc.context) {
            message += ` (${desc.context})`;
        }
        message += ` - ${prediction}`;

        return message;
    }

    /**
     * Generează mesaj EXPLICIT pentru notificare (format nou, ușor de înțeles)
     * Exemplu: "ARSENAL A AVUT 7 ȘUTURI PE POARTĂ PÂNĂ LA PAUZĂ ȘI NU A MARCAT,
     *           IAR ÎN 92% DIN CAZURILE CÂND AM ÎNREGISTRAT ACESTE SITUAȚII,
     *           ECHIPA ÎN CAUZĂ A MARCAT UN GOL DUPĂ PAUZĂ."
     */
    formatExplicitMessage(patternId, team, probability, stats = {}) {
        const teamUpper = team.toUpperCase();
        const prob = Math.round(probability);

        // PATTERN 1.x - Șuturi pe poartă fără gol
        if (patternId.startsWith('PATTERN_1.')) {
            const shots = stats.suturiPePtPauza || parseInt(patternId.split('.')[1]) + 3;
            return `${teamUpper} A AVUT ${shots} ȘUTURI PE POARTĂ PÂNĂ LA PAUZĂ ȘI NU A MARCAT, IAR ÎN ${prob}% DIN CAZURILE CÂND AM ÎNREGISTRAT ACESTE SITUAȚII, ECHIPA ÎN CAUZĂ A MARCAT UN GOL DUPĂ PAUZĂ.`;
        }

        // PATTERN 2.x - Total suturi (MODIFICAT din "șuturi pe lângă")
        if (patternId.startsWith('PATTERN_2.')) {
            const totalShots = stats.totalSuturiPauza || parseInt(patternId.split('.')[1]) + 5;
            const shotsOnTarget = stats.suturiPePtPauza || 0;
            const missedShots = totalShots - shotsOnTarget;
            return `${teamUpper} A AVUT ${totalShots} SUTURI TOTALE LA PAUZĂ (${shotsOnTarget} PE POARTĂ, ${missedShots} PE LÂNGĂ) ȘI NU A MARCAT ÎNCĂ, IAR ÎN ${prob}% DIN CAZURILE CÂND AM ÎNREGISTRAT ACEASTĂ SITUAȚIE, ECHIPA ÎN CAUZĂ A MARCAT ÎN REPRIZA A DOUA.`;
        }

        // PATTERN 3.x - Total goluri
        if (patternId === 'PATTERN_3.3') {
            return `CELE DOUĂ ECHIPE AU MARCAT 3 GOLURI LA PAUZĂ, IAR ÎN ${prob}% DIN CAZURILE CÂND AM ÎNREGISTRAT ASTFEL DE MECIURI CU MULTE GOLURI, S-A MARCAT CEL PUȚIN UN GOL ȘI ÎN REPRIZA A DOUA.`;
        }
        if (patternId === 'PATTERN_3.4') {
            return `CELE DOUĂ ECHIPE AU MARCAT 4 GOLURI LA PAUZĂ, IAR ÎN ${prob}% DIN CAZURILE CÂND AM ÎNREGISTRAT MECIURI ATÂT DE SPECTACULOASE, S-A MARCAT CEL PUȚIN UN GOL ȘI ÎN REPRIZA A DOUA.`;
        }
        if (patternId === 'PATTERN_3.5+') {
            return `CELE DOUĂ ECHIPE AU MARCAT 5+ GOLURI LA PAUZĂ, IAR ÎN ${prob}% DIN CAZURILE CÂND AM ÎNREGISTRAT MECIURI CU ATÂT DE MULTE GOLURI, S-A MARCAT CEL PUȚIN UN GOL ȘI ÎN REPRIZA A DOUA.`;
        }

        // PATTERN 4.x - Cornere fără gol
        if (patternId.startsWith('PATTERN_4.')) {
            const corners = stats.cornerePauza || parseInt(patternId.split('.')[1]);
            return `${teamUpper} A AVUT ${corners} CORNERE PÂNĂ LA PAUZĂ FĂRĂ A MARCA, IAR ÎN ${prob}% DIN CAZURILE CÂND AM ÎNREGISTRAT ACEASTĂ PRESIUNE CONSTANTĂ, ECHIPA ÎN CAUZĂ A MARCAT UN GOL DUPĂ PAUZĂ.`;
        }

        // PATTERN 5.x - Combinație șuturi + cornere (SE VERIFICĂ SUMA!)
        if (patternId.startsWith('PATTERN_5.')) {
            const shots = stats.suturiPePtPauza || 0;
            const corners = stats.cornerePauza || 0;
            const total = shots + corners;
            const minRequired = parseInt(patternId.split('.')[1]);
            return `${teamUpper} A AVUT UN TOTAL DE ${total} ACȚIUNI OFENSIVE (${shots} ȘUTURI PE POARTĂ + ${corners} CORNERE) PÂNĂ LA PAUZĂ ȘI NU A MARCAT ÎNCĂ, IAR ÎN ${prob}% DIN CAZURILE CÂND AM ÎNREGISTRAT ACEASTĂ SITUAȚIE (MINIMUM ${minRequired} ACȚIUNI), ECHIPA ÎN CAUZĂ A MARCAT UN GOL DUPĂ PAUZĂ.`;
        }

        // PATTERN 6.x - Continuitate cornere
        if (patternId.startsWith('PATTERN_6.')) {
            const corners = stats.cornerePauza || 0;
            const shots = stats.suturiPePtPauza || 0;
            return `${teamUpper} A AVUT ${corners} CORNERE ȘI ${shots} ȘUTURI PE POARTĂ LA PAUZĂ, IAR ÎN ${prob}% DIN CAZURILE CÂND AM ÎNREGISTRAT ASTFEL DE ATACURI EFICIENTE, ECHIPA ÎN CAUZĂ A MAI AVUT MINIM 2 CORNERE ÎN REPRIZA A DOUA.`;
        }

        // PATTERN 7.x.y - Cornere + salvări portar
        if (patternId.startsWith('PATTERN_7.')) {
            const corners = stats.cornerePauza || 3;
            const saves = stats.adversarSalvariPauza || 1;
            return `${teamUpper} A AVUT ${corners} CORNERE, IAR PORTARUL ADVERSAR A FĂCUT ${saves} ${saves === 1 ? 'SALVARE' : 'SALVĂRI'} PÂNĂ LA PAUZĂ, IAR ÎN ${prob}% DIN CAZURILE CÂND AM ÎNREGISTRAT ACESTE ȘANSE CLARE RATATE, ECHIPA ÎN CAUZĂ A MARCAT UN GOL DUPĂ PAUZĂ.`;
        }

        // PATTERN 8.x.y.z - Combinație șuturi + cornere + salvări
        if (patternId.startsWith('PATTERN_8.')) {
            const shots = stats.suturiPePtPauza || 3;
            const corners = stats.cornerePauza || 3;
            const saves = stats.adversarSalvariPauza || 1;
            return `${teamUpper} A AVUT ${shots} ȘUTURI PE POARTĂ, ${corners} CORNERE, IAR PORTARUL ADVERSAR A FĂCUT ${saves} ${saves === 1 ? 'SALVARE' : 'SALVĂRI'} PÂNĂ LA PAUZĂ, IAR ÎN ${prob}% DIN CAZURILE CÂND AM ÎNREGISTRAT ACEASTĂ DOMINARE TOTALĂ, ECHIPA ÎN CAUZĂ A MARCAT UN GOL DUPĂ PAUZĂ.`;
        }

        // PATTERN 9.x - Cartonașe galbene
        if (patternId.startsWith('PATTERN_9.')) {
            const cards = parseInt(patternId.split('.')[1]) || 3;
            return `ÎN ACEST MECI AU FOST DISTRIBUITE ${cards}${cards >= 7 ? '+' : ''} CARTONAȘE GALBENE PÂNĂ LA PAUZĂ, IAR ÎN ${prob}% DIN CAZURILE CÂND AM ÎNREGISTRAT ASTFEL DE MECIURI INTENSE, S-A DAT CEL PUȚIN UN CARTONAȘ SUPLIMENTAR ÎN REPRIZA A DOUA.`;
        }

        // PATTERN 0.0 - Cărtonaș roșu adversar
        if (patternId === 'PATTERN_0.0') {
            return `${teamUpper} JOACĂ ÎMPOTRIVA UNEI ECHIPE CU CĂRTONAȘ ROȘU (SUPERIORITATE NUMERICĂ), IAR ÎN ${prob}% DIN CAZURILE CÂND AM ÎNREGISTRAT ACEASTĂ SITUAȚIE, ECHIPA ÎN CAUZĂ A MARCAT UN GOL DUPĂ PAUZĂ.`;
        }

        // PATTERN 14 - Conduce norocos
        if (patternId === 'PATTERN_14') {
            const oppShots = stats.adversarSuturiPePtPauza || 4;
            return `${teamUpper} CONDUCE, DAR ADVERSARUL A AVUT ${oppShots} ȘUTURI PE POARTĂ FĂRĂ GOL. ÎN ${prob}% DIN CAZURI, ADVERSARUL A MARCAT ÎN REPRIZA A DOUA.`;
        }

        // PATTERN 16 - Ofsaiduri + presiune
        if (patternId === 'PATTERN_16') {
            const offsides = stats.ofsaiduriPauza || 3;
            const shots = stats.suturiPePtPauza || 2;
            return `${teamUpper} A AVUT ${offsides} OFSAIDURI ȘI ${shots} ȘUTURI PE POARTĂ LA PAUZĂ FĂRĂ GOL. ÎN ${prob}% DIN CAZURI, ECHIPA A MARCAT ÎN REPRIZA A DOUA.`;
        }

        // PATTERN 17 - Salvări gardian adversar
        if (patternId === 'PATTERN_17') {
            const saves = stats.adversarSalvariPauza || 4;
            return `${teamUpper} NU A MARCAT, DAR PORTARUL ADVERSAR A FĂCUT ${saves} SALVĂRI LA PAUZĂ. ÎN ${prob}% DIN CAZURI, ECHIPA A MARCAT ÎN REPRIZA A DOUA.`;
        }

        // PATTERN 18 - Dominare totală
        if (patternId === 'PATTERN_18') {
            const poss = stats.posesiePauza || 65;
            const corners = stats.cornerePauza || 4;
            return `${teamUpper} A DOMINAT TOTAL: ${poss}% POSESIE, ${corners} CORNERE (ADVERSAR ≤1), DAR 0 GOLURI. ÎN ${prob}% DIN CAZURI, ECHIPA A MARCAT ÎN REPRIZA A DOUA.`;
        }

        // PATTERN 19 - Meci deschis
        if (patternId === 'PATTERN_19') {
            return `MECI DESCHIS CU SCOR EGAL ȘI ${stats.totalSuturiPePtPauza || 6}+ ȘUTURI PE POARTĂ COMBINATE. ÎN ${prob}% DIN CAZURI, S-A MARCAT CEL PUȚIN UN GOL ÎN REPRIZA A DOUA.`;
        }

        // PATTERN 20 - Cornere disproporționate
        if (patternId === 'PATTERN_20') {
            const corners = stats.cornerePauza || 5;
            return `${teamUpper} A AVUT ${corners} CORNERE VS ≤1 ADVERSAR LA PAUZĂ. ÎN ${prob}% DIN CAZURI, MECIUL A AVUT PESTE 8.5 CORNERE TOTAL.`;
        }

        // Fallback (pentru pattern-uri necunoscute)
        return `${teamUpper} A ÎNDEPLINIT PATTERN-UL ${patternId}, IAR ÎN ${prob}% DIN CAZURILE CÂND AM ÎNREGISTRAT ACEASTĂ SITUAȚIE, ECHIPA ÎN CAUZĂ A MARCAT UN GOL DUPĂ PAUZĂ.`;
    }
}

// Export singleton instance (nu clasa)
module.exports = new PatternDescriptor();

// Test
if (require.main === module) {
    console.log('🧪 TEST PATTERN DESCRIPTOR\n');

    const descriptor = new PatternDescriptor();

    // Test pattern-uri
    const tests = [
        { id: 'PATTERN_1.2', team: 'Arsenal', prob: 100, stats: { suturiPePtPauza: 5 } },
        { id: 'PATTERN_4.6', team: 'Arsenal', prob: 90, stats: { cornerePauza: 6 } },
        { id: 'PATTERN_5.7', team: 'Arsenal', prob: 84.62, stats: { suturiPePtPauza: 4, cornerePauza: 4 } },
        { id: 'PATTERN_7.5.3', team: 'Arsenal', prob: 100, stats: { cornerePauza: 5, adversarSalvariPauza: 3 } },
        { id: 'PATTERN_9.4', team: 'Meci', prob: 90.91 }
    ];

    tests.forEach(test => {
        console.log(`\n${test.id} (${test.prob}%):`);
        const message = descriptor.formatFullMessage(test.id, test.team, test.prob, test.stats);
        console.log(`   ${message}`);
    });

    console.log('\n✅ Test finalizat!\n');
}
