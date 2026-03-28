/**
 * API SMART 5 - Pattern Checker
 *
 * Verifică toate pattern-urile pe datele de halftime
 * Pattern-uri 0-9: bazate pe suturi, cornere, salvări, cartonașe
 * Pattern-uri 10-13: bazate pe xG, posesie, combinații
 */

class PatternChecker {
    constructor() {
        this.patternsFound = [];
    }

    /**
     * Verifică TOATE pattern-urile pentru un meci la HT
     * @param {Object} matchData - Date meci cu scor + statistici HT
     * @returns {Array} - Pattern-uri găsite
     */
    checkAllPatterns(matchData) {
        const patterns = [];

        const { scor, statistici } = matchData;

        // Verificare STRICTĂ: dacă scorul sau statisticile lipsesc, returnăm array gol
        // Fix pentru pattern-uri 7 și 8 care se declanșau incorect când API-ul nu furniza scorul
        if (!scor || !statistici) {
            console.warn('⚠️  Scor sau statistici lipsă, skip verificare pattern-uri');
            return patterns;
        }

        // DEBUG: Log scor complet pentru a verifica pattern-urile 7 și 8
        console.log(`[DEBUG] Scor HT: ${scor.pauza_gazda}-${scor.pauza_oaspete} | Gazda: ${scor.pauza_gazda} goluri | Oaspete: ${scor.pauza_oaspete} goluri`);

        // Extrage date pentru fiecare echipă
        const homeStats = {
            golPauza: scor.pauza_gazda,
            suturiPePtPauza: statistici.suturi_pe_poarta.pauza_gazda,
            totalSuturiPauza: statistici.total_suturi.pauza_gazda,
            cornerePauza: statistici.cornere.repriza_1_gazda,
            adversarCartRosuPauza: statistici.cartonase_rosii.pauza_oaspete,
            adversarSalvariPauza: statistici.suturi_salvate ? statistici.suturi_salvate.pauza_oaspete : (statistici.salvari_portar ? statistici.salvari_portar.pauza_oaspete : 0),
            xgPauza: statistici.xG ? statistici.xG.pauza_gazda : null,
            posesiePauza: statistici.posesie ? statistici.posesie.pauza_gazda : null,
            // Date adversar (pt pattern-uri noi)
            adversarGolPauza: scor.pauza_oaspete,
            adversarSuturiPePtPauza: statistici.suturi_pe_poarta.pauza_oaspete,
            adversarCornerePauza: statistici.cornere.repriza_1_oaspete,
            ofsaiduriPauza: statistici.ofsaiduri ? statistici.ofsaiduri.pauza_gazda : 0
        };

        const awayStats = {
            golPauza: scor.pauza_oaspete,
            suturiPePtPauza: statistici.suturi_pe_poarta.pauza_oaspete,
            totalSuturiPauza: statistici.total_suturi.pauza_oaspete,
            cornerePauza: statistici.cornere.repriza_1_oaspete,
            adversarCartRosuPauza: statistici.cartonase_rosii.pauza_gazda,
            adversarSalvariPauza: statistici.suturi_salvate ? statistici.suturi_salvate.pauza_gazda : (statistici.salvari_portar ? statistici.salvari_portar.pauza_gazda : 0),
            xgPauza: statistici.xG ? statistici.xG.pauza_oaspete : null,
            posesiePauza: statistici.posesie ? statistici.posesie.pauza_oaspete : null,
            // Date adversar (pt pattern-uri noi)
            adversarGolPauza: scor.pauza_gazda,
            adversarSuturiPePtPauza: statistici.suturi_pe_poarta.pauza_gazda,
            adversarCornerePauza: statistici.cornere.repriza_1_gazda,
            ofsaiduriPauza: statistici.ofsaiduri ? statistici.ofsaiduri.pauza_oaspete : 0
        };

        // Pattern-uri pentru GAZDA
        const homePatterns = this.checkTeamPatterns(homeStats, 'gazda');
        patterns.push(...homePatterns);

        // Pattern-uri pentru OASPETE
        const awayPatterns = this.checkTeamPatterns(awayStats, 'oaspete');
        patterns.push(...awayPatterns);

        // Pattern-uri la nivel de MECI
        const matchPatterns = this.checkMatchPatterns({
            totalGoluriPauza: scor.pauza_gazda + scor.pauza_oaspete,
            totalCartGalbenePauza: statistici.cartonase_galbene.pauza_gazda + statistici.cartonase_galbene.pauza_oaspete,
            totalSuturiPePtPauza: statistici.suturi_pe_poarta.pauza_gazda + statistici.suturi_pe_poarta.pauza_oaspete,
            totalCornerePauza: statistici.cornere.repriza_1_gazda + statistici.cornere.repriza_1_oaspete,
            goluriPauzaGazda: scor.pauza_gazda,
            goluriPauzaOaspete: scor.pauza_oaspete
        });
        patterns.push(...matchPatterns);

        return patterns;
    }

    /**
     * Verifică pattern-uri pentru o echipă (gazda SAU oaspete)
     */
    checkTeamPatterns(stats, tipEchipa) {
        const patterns = [];

        const {
            golPauza,
            suturiPePtPauza,
            totalSuturiPauza,
            cornerePauza,
            adversarCartRosuPauza,
            adversarSalvariPauza,
            xgPauza,
            posesiePauza
        } = stats;

        // PATTERN 0.0 - Adversar cu cărtonaș roșu
        if (golPauza === 0 && suturiPePtPauza >= 1 && adversarCartRosuPauza >= 1) {
            patterns.push({ name: 'PATTERN_0.0', team: tipEchipa, stats });
        }

        // PATTERN 1.x - Șuturi pe poartă, 0 goluri HT
        if (golPauza === 0) {
            const limitePattern1 = [
                { name: 'PATTERN_1.0', min: 3 },
                { name: 'PATTERN_1.1', min: 4 },
                { name: 'PATTERN_1.2', min: 5 },
                { name: 'PATTERN_1.3', min: 6 },
                { name: 'PATTERN_1.4', min: 7 },
                { name: 'PATTERN_1.5', min: 8 },
                { name: 'PATTERN_1.6', min: 9 }
            ];

            limitePattern1.forEach(p => {
                if (suturiPePtPauza >= p.min) {
                    patterns.push({ name: p.name, team: tipEchipa, stats });
                }
            });
        }

        // PATTERN 2.x - Total suturi (modificat din "șuturi pe lângă")
        if (golPauza === 0 && totalSuturiPauza !== null && suturiPePtPauza !== null) {
            // Calculăm suturiPeLanga pentru statistici (dar NU-L MAI FOLOSIM la verificare!)
            const suturiPeLanga = totalSuturiPauza - suturiPePtPauza;

            const limitePattern2 = [
                { name: 'PATTERN_2.1', min: 6 },
                { name: 'PATTERN_2.2', min: 7 },
                { name: 'PATTERN_2.3', min: 8 },
                { name: 'PATTERN_2.4', min: 9 },
                { name: 'PATTERN_2.5', min: 10 }
            ];

            limitePattern2.forEach(p => {
                // MODIFICAT: Verificăm totalSuturiPauza în loc de suturiPeLanga
                if (totalSuturiPauza >= p.min) {
                    patterns.push({ name: p.name, team: tipEchipa, stats: { ...stats, suturiPeLanga, totalSuturiPauza } });
                }
            });
        }

        // PATTERN 4.x - Cornere, 0 goluri HT
        if (golPauza === 0) {
            const limitePattern4 = [
                { name: 'PATTERN_4.5', min: 5 },
                { name: 'PATTERN_4.6', min: 6 },
                { name: 'PATTERN_4.7', min: 7 },
                { name: 'PATTERN_4.8', min: 8 }
            ];

            limitePattern4.forEach(p => {
                if (cornerePauza >= p.min) {
                    patterns.push({ name: p.name, team: tipEchipa, stats });
                }
            });
        }

        // PATTERN 5.x - Combinație șuturi + cornere (FĂRĂ GOL!)
        // Detectăm DOAR când echipa NU a marcat (golPauza === 0)
        if (golPauza === 0) {
            const limitePattern5 = [
                { name: 'PATTERN_5.5', min: 5 },
                { name: 'PATTERN_5.6', min: 6 },
                { name: 'PATTERN_5.7', min: 7 },
                { name: 'PATTERN_5.8', min: 8 }
            ];

            limitePattern5.forEach(p => {
                if (suturiPePtPauza + cornerePauza >= p.min) {
                    patterns.push({ name: p.name, team: tipEchipa, stats });
                }
            });
        }

        // PATTERN 6.x - Cornere + Șuturi (continuitate atacuri → predicție: încă 2 cornere în R2)
        // Detectăm pe baza cornerelor și șuturilor (NU golurilor!)
        // Ex: PATTERN_6.4 = 3 cornere + 4 șuturi la pauză → va mai avea 2 cornere în R2
        if (golPauza === 0) {  // NU a marcat încă
            const pattern6Configs = [
                { name: 'PATTERN_6.3', corners: 3, shots: 3 },
                { name: 'PATTERN_6.4', corners: 3, shots: 4 },
                { name: 'PATTERN_6.5', corners: 2, shots: 4 },
                { name: 'PATTERN_6.6', corners: 2, shots: 3 },
                { name: 'PATTERN_6.7', corners: 4, shots: 2 },
                { name: 'PATTERN_6.8', corners: 4, shots: 1 }
            ];

            pattern6Configs.forEach(p => {
                if (cornerePauza >= p.corners && suturiPePtPauza >= p.shots) {
                    patterns.push({ name: p.name, team: tipEchipa, stats });
                }
            });
        }

        // PATTERN 7.x.y - Cornere + salvări adversar
        // DEBUG: Log pentru a verifica dacă golPauza este efectiv 0
        console.log(`[DEBUG] Pattern 7 check pentru ${tipEchipa}: golPauza=${golPauza} (tip: ${typeof golPauza})`);

        if (golPauza === 0) {
            const pattern7Configs = [
                { name: 'PATTERN_7.2.1', cornere: 2, salvari: 1 },
                { name: 'PATTERN_7.2.2', cornere: 2, salvari: 2 },
                { name: 'PATTERN_7.2.3', cornere: 2, salvari: 3 },
                { name: 'PATTERN_7.3.1', cornere: 3, salvari: 1 },
                { name: 'PATTERN_7.3.2', cornere: 3, salvari: 2 },
                { name: 'PATTERN_7.3.3', cornere: 3, salvari: 3 },
                { name: 'PATTERN_7.4.1', cornere: 4, salvari: 1 },
                { name: 'PATTERN_7.4.2', cornere: 4, salvari: 2 },
                { name: 'PATTERN_7.4.3', cornere: 4, salvari: 3 },
                { name: 'PATTERN_7.5.1', cornere: 5, salvari: 1 },
                { name: 'PATTERN_7.5.2', cornere: 5, salvari: 2 },
                { name: 'PATTERN_7.5.3', cornere: 5, salvari: 3 }
            ];

            pattern7Configs.forEach(p => {
                if (cornerePauza >= p.cornere && adversarSalvariPauza >= p.salvari) {
                    console.log(`[DEBUG] ✅ Pattern ${p.name} DECLANȘAT pentru ${tipEchipa}: golPauza=${golPauza}, cornere=${cornerePauza}, salvări adversar=${adversarSalvariPauza}`);
                    patterns.push({ name: p.name, team: tipEchipa, stats });
                }
            });
        }

        // PATTERN 8.x.y.z - Cornere + salvări + suturi
        // DEBUG: Log pentru a verifica dacă golPauza este efectiv 0
        console.log(`[DEBUG] Pattern 8 check pentru ${tipEchipa}: golPauza=${golPauza} (tip: ${typeof golPauza})`);

        if (golPauza === 0) {
            const pattern8Configs = [
                { name: 'PATTERN_8.2.1', cornere: 2, salvari: 1, suturi: 2 },
                { name: 'PATTERN_8.3.1', cornere: 3, salvari: 1, suturi: 2 },
                { name: 'PATTERN_8.4.1', cornere: 4, salvari: 1, suturi: 2 },
                { name: 'PATTERN_8.5.1', cornere: 5, salvari: 1, suturi: 2 },
                { name: 'PATTERN_8.2.2', cornere: 2, salvari: 2, suturi: 2 },
                { name: 'PATTERN_8.3.2', cornere: 3, salvari: 2, suturi: 2 },
                { name: 'PATTERN_8.4.2', cornere: 4, salvari: 2, suturi: 2 },
                { name: 'PATTERN_8.5.2', cornere: 5, salvari: 2, suturi: 2 },
                { name: 'PATTERN_8.2.3', cornere: 2, salvari: 3, suturi: 2 },
                { name: 'PATTERN_8.3.3', cornere: 3, salvari: 3, suturi: 2 },
                { name: 'PATTERN_8.4.3', cornere: 4, salvari: 3, suturi: 2 },
                { name: 'PATTERN_8.5.3', cornere: 5, salvari: 3, suturi: 2 },
                { name: 'PATTERN_8.2.1.3', cornere: 2, salvari: 1, suturi: 3 },
                { name: 'PATTERN_8.3.1.3', cornere: 3, salvari: 1, suturi: 3 },
                { name: 'PATTERN_8.4.1.3', cornere: 4, salvari: 1, suturi: 3 },
                { name: 'PATTERN_8.5.1.3', cornere: 5, salvari: 1, suturi: 3 },
                { name: 'PATTERN_8.2.2.3', cornere: 2, salvari: 2, suturi: 3 },
                { name: 'PATTERN_8.3.2.3', cornere: 3, salvari: 2, suturi: 3 },
                { name: 'PATTERN_8.4.2.3', cornere: 4, salvari: 2, suturi: 3 },
                { name: 'PATTERN_8.5.2.3', cornere: 5, salvari: 2, suturi: 3 },
                { name: 'PATTERN_8.2.3.3', cornere: 2, salvari: 3, suturi: 3 },
                { name: 'PATTERN_8.3.3.3', cornere: 3, salvari: 3, suturi: 3 },
                { name: 'PATTERN_8.4.3.3', cornere: 4, salvari: 3, suturi: 3 },
                { name: 'PATTERN_8.5.3.3', cornere: 5, salvari: 3, suturi: 3 }
            ];

            pattern8Configs.forEach(p => {
                if (cornerePauza >= p.cornere && adversarSalvariPauza >= p.salvari && suturiPePtPauza >= p.suturi) {
                    console.log(`[DEBUG] ✅ Pattern ${p.name} DECLANȘAT pentru ${tipEchipa}: golPauza=${golPauza}, cornere=${cornerePauza}, salvări adversar=${adversarSalvariPauza}, șuturi=${suturiPePtPauza}`);
                    patterns.push({ name: p.name, team: tipEchipa, stats });
                }
            });
        }

        // PATTERN 20 - Cornere disproporționate
        // Condiții: echipa ≥5 cornere, adversar ≤1 corner
        // Predicție: over 8.5 cornere total meci
        if (cornerePauza >= 5 && stats.adversarCornerePauza <= 1) {
            patterns.push({ name: 'PATTERN_20', team: tipEchipa, stats });
        }

        // PATTERN 14 - Conduce norocos (adversarul domină dar nu a marcat)
        // Condiții: echipa conduce (≥1 gol), adversarul 0 goluri, adversarul ≥4 șuturi pe poartă
        // Predicție: adversarul va marca în R2
        if (golPauza >= 1 && stats.adversarGolPauza === 0 && stats.adversarSuturiPePtPauza >= 4) {
            patterns.push({ name: 'PATTERN_14', team: tipEchipa, stats });
        }

        // PATTERN 16 - Ofsaiduri + presiune ofensivă
        // Condiții: 0 goluri, ≥3 ofsaiduri, ≥2 șuturi pe poartă
        // Predicție: echipa va marca în R2
        if (golPauza === 0 && stats.ofsaiduriPauza >= 3 && suturiPePtPauza >= 2) {
            patterns.push({ name: 'PATTERN_16', team: tipEchipa, stats });
        }

        // PATTERN 17 - Salvări gardian adversar multe
        // Condiții: 0 goluri, gardianul adversar ≥4 salvări
        // Predicție: echipa va marca în R2
        if (golPauza === 0 && adversarSalvariPauza >= 4) {
            patterns.push({ name: 'PATTERN_17', team: tipEchipa, stats });
        }

        // PATTERN 18 - Dominare totală (posesie + cornere)
        // Condiții: 0 goluri, posesie ≥65%, ≥4 cornere, adversar ≤1 corner
        // Predicție: echipa va marca în R2
        if (golPauza === 0 && posesiePauza !== null && posesiePauza >= 65 &&
            cornerePauza >= 4 && stats.adversarCornerePauza <= 1) {
            patterns.push({ name: 'PATTERN_18', team: tipEchipa, stats });
        }

        // PATTERN 10.x - xG fără gol (Expected Goals ridicat dar 0 goluri la pauză)
        if (golPauza === 0 && xgPauza !== null && xgPauza !== undefined) {
            if (xgPauza >= 0.80) patterns.push({ name: 'PATTERN_10.1', team: tipEchipa, stats });
            if (xgPauza >= 1.20) patterns.push({ name: 'PATTERN_10.2', team: tipEchipa, stats });
            if (xgPauza >= 1.50) patterns.push({ name: 'PATTERN_10.3', team: tipEchipa, stats });
        }

        // PATTERN 11.x - Posesie dominantă fără gol
        if (golPauza === 0 && posesiePauza !== null && posesiePauza !== undefined && posesiePauza > 0) {
            if (posesiePauza >= 65) patterns.push({ name: 'PATTERN_11.1', team: tipEchipa, stats });
            if (posesiePauza >= 70) patterns.push({ name: 'PATTERN_11.2', team: tipEchipa, stats });
            if (posesiePauza >= 75) patterns.push({ name: 'PATTERN_11.3', team: tipEchipa, stats });
        }

        // PATTERN 12.x - xG + Posesie combinat (dominanță completă fără gol)
        if (golPauza === 0 && xgPauza !== null && xgPauza !== undefined && posesiePauza !== null && posesiePauza !== undefined && posesiePauza > 0) {
            if (xgPauza >= 0.60 && posesiePauza >= 60) patterns.push({ name: 'PATTERN_12.1', team: tipEchipa, stats });
            if (xgPauza >= 0.80 && posesiePauza >= 65) patterns.push({ name: 'PATTERN_12.2', team: tipEchipa, stats });
            if (xgPauza >= 1.00 && posesiePauza >= 60) patterns.push({ name: 'PATTERN_12.3', team: tipEchipa, stats });
        }

        // PATTERN 13.x - Posesie + Șuturi pe poartă (dominanță cu finalizare fără gol)
        if (golPauza === 0 && posesiePauza !== null && posesiePauza !== undefined && posesiePauza > 0) {
            if (posesiePauza >= 60 && suturiPePtPauza >= 3) patterns.push({ name: 'PATTERN_13.1', team: tipEchipa, stats });
            if (posesiePauza >= 65 && suturiPePtPauza >= 3) patterns.push({ name: 'PATTERN_13.2', team: tipEchipa, stats });
            if (posesiePauza >= 60 && suturiPePtPauza >= 4) patterns.push({ name: 'PATTERN_13.3', team: tipEchipa, stats });
            if (posesiePauza >= 65 && suturiPePtPauza >= 4) patterns.push({ name: 'PATTERN_13.4', team: tipEchipa, stats });
        }

        return patterns;
    }

    /**
     * Verifică pattern-uri la nivel de MECI
     */
    checkMatchPatterns(stats) {
        const patterns = [];

        const { totalGoluriPauza, totalCartGalbenePauza } = stats;

        // PATTERN 3.x - Total goluri
        if (totalGoluriPauza === 3) {
            patterns.push({ name: 'PATTERN_3.3', team: 'meci', stats });
        }
        if (totalGoluriPauza === 4) {
            patterns.push({ name: 'PATTERN_3.4', team: 'meci', stats });
        }
        if (totalGoluriPauza >= 5) {
            patterns.push({ name: 'PATTERN_3.5+', team: 'meci', stats });
        }

        // PATTERN 19 - Meci deschis (egal + multe șuturi ambele echipe)
        // Condiții: scor egal ≥1-1, total șuturi pe poartă ≥6
        // Predicție: cel puțin 1 gol în R2
        if (stats.goluriPauzaGazda >= 1 && stats.goluriPauzaOaspete >= 1 &&
            stats.goluriPauzaGazda === stats.goluriPauzaOaspete &&
            stats.totalSuturiPePtPauza >= 6) {
            patterns.push({ name: 'PATTERN_19', team: 'meci', stats });
        }

        // PATTERN 20 - Cornere disproporționate (predicție over 8.5 cornere total)
        // Se verifică pentru ambele "direcții" — nu contează cine domină
        // Checked via team patterns (P20 la team level cu adversarCornerePauza)

        // PATTERN 21 - Meci deschis extrem (egal ≥1-1 & 10+ șuturi pe poartă)
        // Condiții: scor egal ≥1-1 (ambele au marcat), total șuturi pe poartă ≥10
        // Predicție: cel puțin 1 gol în R2 (meci)
        // Rata: 92.2% din 77 meciuri | Extensie P19 (≥6 șuturi) cu prag mai strict
        if (stats.goluriPauzaGazda >= 1 && stats.goluriPauzaOaspete >= 1 &&
            stats.goluriPauzaGazda === stats.goluriPauzaOaspete &&
            stats.totalSuturiPePtPauza >= 10) {
            patterns.push({ name: 'PATTERN_21', team: 'meci', stats });
        }

        // PATTERN 22 - HT 1 gol & presiune ofensivă (1-0/0-1 & 6+ șuturi pe poartă)
        // Condiții: total goluri la pauză = exact 1, total șuturi pe poartă ≥6
        // Predicție: cel puțin 1 gol în R2 (meci)
        // Rata: 82.1% din 2098 meciuri | Bundesliga 86.6%, 2.Bundesliga 89.7%
        if (totalGoluriPauza === 1 && stats.totalSuturiPePtPauza >= 6) {
            patterns.push({ name: 'PATTERN_22', team: 'meci', stats });
        }

        // PATTERN 23 - Meci cu goluri & șuturi (2+ goluri & 8+ șuturi pe poartă)
        // Condiții: total goluri la pauză ≥2, total șuturi pe poartă ≥8
        // Predicție: cel puțin 1 gol în R2 (meci)
        // Rata: 83.7% din 1546 meciuri | Bundesliga 85.2%, Turkey 86.7%
        if (totalGoluriPauza >= 2 && stats.totalSuturiPePtPauza >= 8) {
            patterns.push({ name: 'PATTERN_23', team: 'meci', stats });
        }

        // PATTERN 24 - Multe cornere (8+ cornere total la HT)
        // Condiții: total cornere ≥8 (suma ambelor echipe)
        // Predicție: cel puțin 1 gol în R2 (meci)
        // Rata: 81.2% din 3989 meciuri | Eredivisie 88.4%, PL 84.5%
        if (stats.totalCornerePauza >= 8) {
            patterns.push({ name: 'PATTERN_24', team: 'meci', stats });
        }

        // PATTERN 25 - Dominanță clară (HT 2-0 sau 0-2)
        // Condiții: o echipă are 2 goluri, cealaltă 0
        // Predicție: cel puțin 1 gol în R2 (meci — nu per echipă)
        // Rata: 81.2% din 4317 meciuri | Nu se poate prezice CINE marchează
        if ((stats.goluriPauzaGazda === 2 && stats.goluriPauzaOaspete === 0) ||
            (stats.goluriPauzaGazda === 0 && stats.goluriPauzaOaspete === 2)) {
            patterns.push({ name: 'PATTERN_25', team: 'meci', stats });
        }

        // PATTERN 9.x - Cartonașe galbene
        if (totalCartGalbenePauza === 3) {
            patterns.push({ name: 'PATTERN_9.3', team: 'meci', stats });
        }
        if (totalCartGalbenePauza === 4) {
            patterns.push({ name: 'PATTERN_9.4', team: 'meci', stats });
        }
        if (totalCartGalbenePauza === 5) {
            patterns.push({ name: 'PATTERN_9.5', team: 'meci', stats });
        }
        if (totalCartGalbenePauza === 6) {
            patterns.push({ name: 'PATTERN_9.6', team: 'meci', stats });
        }
        if (totalCartGalbenePauza >= 7) {
            patterns.push({ name: 'PATTERN_9.7', team: 'meci', stats });
        }

        return patterns;
    }
}

module.exports = PatternChecker;
