#!/usr/bin/env node
/**
 * API SMART 5 - UNIVERSAL PROCENTE GENERATOR
 *
 * Generează automat procente pentru TOATE campionatele cu date disponibile
 * Procesează fișiere din API SMART 4 și salvează în API SMART 5
 */

const fs = require('fs');
const path = require('path');
const PatternChecker = require('./pattern-checker');

// Paths
const SMART4_DIR = path.join(__dirname, '..', 'API SMART 4');
const SMART5_SEASONS_DIR = path.join(__dirname, 'data', 'seasons');
const PROCENTE_PATH = path.join(__dirname, 'JSON PROCENTE AUTOACTUAL.json');

// Configurare tier-uri pentru fiecare tip de campionat
const TIER_CONFIGS = {
    // Big 5 + Campionate standard (18-20 echipe)
    'standard_18-20': {
        numEchipe: 20,
        tiers: ['TOP_1-5', 'MID_6-10', 'LOW_11-15', 'BOTTOM_16-20'],
        getTier: (pos, total) => {
            if (pos >= 1 && pos <= 5) return 'TOP_1-5';
            if (pos >= 6 && pos <= 10) return 'MID_6-10';
            if (pos >= 11 && pos <= 15) return 'LOW_11-15';
            if (pos >= 16) return 'BOTTOM_16-20';
            return 'MID_6-10';
        },
        categories: [
            { nume: "TOP_1-5", pozitii: "1-5", description: "Primele 5 echipe din clasament" },
            { nume: "MID_6-10", pozitii: "6-10", description: "Echipe de la poziția 6 la 10" },
            { nume: "LOW_11-15", pozitii: "11-15", description: "Echipe de la poziția 11 la 15" },
            { nume: "BOTTOM_16-20", pozitii: "16-20", description: "Ultimele echipe (16-20)" }
        ]
    },

    // Austria, Portugal (18 echipe)
    'standard_18': {
        numEchipe: 18,
        tiers: ['TOP_1-5', 'MID_6-10', 'LOW_11-15', 'BOTTOM_16-18'],
        getTier: (pos, total) => {
            if (pos >= 1 && pos <= 5) return 'TOP_1-5';
            if (pos >= 6 && pos <= 10) return 'MID_6-10';
            if (pos >= 11 && pos <= 15) return 'LOW_11-15';
            if (pos >= 16) return 'BOTTOM_16-18';
            return 'MID_6-10';
        },
        categories: [
            { nume: "TOP_1-5", pozitii: "1-5", description: "Primele 5 echipe din clasament" },
            { nume: "MID_6-10", pozitii: "6-10", description: "Echipe de la poziția 6 la 10" },
            { nume: "LOW_11-15", pozitii: "11-15", description: "Echipe de la poziția 11 la 15" },
            { nume: "BOTTOM_16-18", pozitii: "16-18", description: "Ultimele 3 echipe" }
        ]
    },

    // Danemarca, Belgia, etc (12-16 echipe)
    'standard_12-16': {
        numEchipe: 16,
        tiers: ['TOP_1-4', 'MID_5-8', 'LOW_9-12', 'BOTTOM_13-16'],
        getTier: (pos, total) => {
            const quarterSize = Math.ceil(total / 4);
            if (pos >= 1 && pos <= quarterSize) return 'TOP_1-4';
            if (pos >= quarterSize + 1 && pos <= quarterSize * 2) return 'MID_5-8';
            if (pos >= quarterSize * 2 + 1 && pos <= quarterSize * 3) return 'LOW_9-12';
            return 'BOTTOM_13-16';
        },
        categories: [
            { nume: "TOP_1-4", pozitii: "1-4", description: "Primele echipe" },
            { nume: "MID_5-8", pozitii: "5-8", description: "Echipe de mijloc superior" },
            { nume: "LOW_9-12", pozitii: "9-12", description: "Echipe de mijloc inferior" },
            { nume: "BOTTOM_13-16", pozitii: "13-16", description: "Ultimele echipe" }
        ]
    },

    // Danemarca (12 echipe)
    'denmark': {
        numEchipe: 12,
        tiers: ['TOP_1-3', 'MID_4-6', 'LOW_7-9', 'BOTTOM_10-12'],
        getTier: (pos, total) => {
            if (pos >= 1 && pos <= 3) return 'TOP_1-3';
            if (pos >= 4 && pos <= 6) return 'MID_4-6';
            if (pos >= 7 && pos <= 9) return 'LOW_7-9';
            if (pos >= 10) return 'BOTTOM_10-12';
            return 'MID_4-6';
        },
        categories: [
            { nume: "TOP_1-3", pozitii: "1-3", description: "Primele 3 echipe" },
            { nume: "MID_4-6", pozitii: "4-6", description: "Echipe de la poziția 4 la 6" },
            { nume: "LOW_7-9", pozitii: "7-9", description: "Echipe de la poziția 7 la 9" },
            { nume: "BOTTOM_10-12", pozitii: "10-12", description: "Ultimele 3 echipe" }
        ]
    },

    // Champions League (36 echipe - format nou)
    'champions_league': {
        numEchipe: 36,
        tiers: ['TOP_1-8', 'MID_9-24', 'BOTTOM_25-36'],
        getTier: (pos, total) => {
            if (pos >= 1 && pos <= 8) return 'TOP_1-8';
            if (pos >= 9 && pos <= 24) return 'MID_9-24';
            if (pos >= 25) return 'BOTTOM_25-36';
            return 'MID_9-24';
        },
        categories: [
            { nume: "TOP_1-8", pozitii: "1-8", description: "Direct în optimi" },
            { nume: "MID_9-24", pozitii: "9-24", description: "Play-off pentru optimi" },
            { nume: "BOTTOM_25-36", pozitii: "25-36", description: "Eliminate" }
        ]
    }
};

// Mapping campionat → config
const LEAGUE_TIER_MAP = {
    'Premier League': 'standard_18-20',
    'La Liga': 'standard_18-20',
    'Serie A': 'standard_18-20',
    'Bundesliga': 'standard_18-20',
    'Ligue 1': 'standard_18-20',
    'Eredivisie': 'standard_18-20',
    'Primeira Liga': 'standard_18',
    'Austria Bundesliga': 'standard_18',
    'Superliga': 'denmark',
    'Champions League': 'champions_league',
    'Europa League': 'champions_league',
    'Conference League': 'champions_league'
};

/**
 * Determină configurația de tier-uri pentru un campionat
 */
function getTierConfig(leagueName, numEchipe) {
    // Check mapping explicit
    if (LEAGUE_TIER_MAP[leagueName]) {
        return TIER_CONFIGS[LEAGUE_TIER_MAP[leagueName]];
    }

    // Fallback pe număr echipe
    if (numEchipe <= 12) return TIER_CONFIGS['denmark'];
    if (numEchipe <= 16) return TIER_CONFIGS['standard_12-16'];
    if (numEchipe === 18) return TIER_CONFIGS['standard_18'];
    if (numEchipe >= 32) return TIER_CONFIGS['champions_league'];

    return TIER_CONFIGS['standard_18-20'];
}

/**
 * Calculează clasament din meciuri
 */
function getSimulatedStandings(meciuri) {
    const standings = {};

    meciuri.forEach(meci => {
        if (!meci.scor || meci.scor.final_gazda === undefined) return;

        const gazda = meci.echipa_gazda.nume;
        const oaspete = meci.echipa_oaspete.nume;

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
            puncte: entry[1].puncte
        }));
}

/**
 * Procesează un campionat și calculează procente
 */
function processLeague(leagueData, leagueName, countryName) {
    console.log(`\n🔍 Procesare: ${leagueName}`);

    const meciuri = leagueData.meciuri;
    const numEchipe = leagueData.campionat.numar_echipe || 20;

    // Determină config tier-uri
    const tierConfig = getTierConfig(leagueName, numEchipe);
    console.log(`   Configurație: ${tierConfig.tiers.join(', ')}`);

    // Calculează clasament
    const clasament = getSimulatedStandings(meciuri);
    console.log(`   Clasament: ${clasament.length} echipe`);

    // Creează mapping echipă → poziție
    const pozitiMap = {};
    clasament.forEach(entry => {
        pozitiMap[entry.echipa] = entry.pozitie;
    });

    // Inițializează tier-uri
    const tiers = {};
    tierConfig.tiers.forEach(tier => {
        tiers[tier] = {};
    });

    const patternChecker = new PatternChecker();
    let meciuriAnalizate = 0;
    let meciuriFaraHT = 0;

    // Procesează meciuri
    meciuri.forEach(meci => {
        if (!meci.statistici || !meci.scor) {
            meciuriFaraHT++;
            return;
        }

        const stats = meci.statistici;
        const hasHalfData = stats.suturi_pe_poarta &&
                           stats.suturi_pe_poarta.pauza_gazda !== undefined;

        if (!hasHalfData) {
            meciuriFaraHT++;
            return;
        }

        meciuriAnalizate++;

        // Construim matchData
        const matchData = {
            matchId: meci.id_meci,
            homeTeam: meci.echipa_gazda.nume,
            awayTeam: meci.echipa_oaspete.nume,
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
                    pauza_gazda: stats.total_suturi.pauza_gazda || 0,
                    pauza_oaspete: stats.total_suturi.pauza_oaspete || 0
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

        // Verifică pattern-uri
        const patterns = patternChecker.checkAllPatterns(matchData);

        if (patterns.length === 0) return;

        // Procesează pattern-uri găsite
        patterns.forEach(pattern => {
            let teamName = null;
            if (pattern.team === 'gazda') teamName = meci.echipa_gazda.nume;
            else if (pattern.team === 'oaspete') teamName = meci.echipa_oaspete.nume;

            // Verifică succes (gol în R2)
            const golR2Gazda = (meci.scor.final_gazda || 0) - (meci.scor.pauza_gazda || 0);
            const golR2Oaspete = (meci.scor.final_oaspete || 0) - (meci.scor.pauza_oaspete || 0);

            let succes = false;
            if (pattern.team === 'gazda' && golR2Gazda > 0) succes = true;
            if (pattern.team === 'oaspete' && golR2Oaspete > 0) succes = true;
            if ((pattern.team === 'meci' || !pattern.team) && (golR2Gazda > 0 || golR2Oaspete > 0)) succes = true;

            // Pattern-uri de meci → adaugă în TOATE tier-urile
            // Pattern-uri de echipă → adaugă doar în tier-ul echipei
            let tiersToAdd = [];
            if (pattern.team === 'meci' || !pattern.team) {
                // Pattern la nivel de meci — înregistrăm în toate tier-urile
                tiersToAdd = tierConfig.tiers;
            } else {
                // Pattern la nivel de echipă
                let tier = tierConfig.tiers[Math.floor(tierConfig.tiers.length / 2)]; // default: mijloc
                if (teamName && pozitiMap[teamName]) {
                    tier = tierConfig.getTier(pozitiMap[teamName], clasament.length);
                }
                tiersToAdd = [tier];
            }

            for (const tier of tiersToAdd) {
                // Adaugă în statistici
                if (!tiers[tier][pattern.name]) {
                    tiers[tier][pattern.name] = {
                        cazuri: 0,
                        succes: 0
                    };
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

    console.log(`   ✅ Analizate: ${meciuriAnalizate} meciuri`);
    console.log(`   ⚠️  Fără date HT: ${meciuriFaraHT} meciuri`);

    // Afișează câteva pattern-uri găsite
    let totalPatterns = 0;
    Object.values(tiers).forEach(tierData => {
        totalPatterns += Object.keys(tierData).length;
    });
    console.log(`   📊 Pattern-uri găsite: ${totalPatterns}`);

    return {
        nume_complet: leagueData.campionat.nume_complet || leagueName,
        tara: countryName,
        sezon: leagueData.campionat.sezon || '2024-2025',
        numar_echipe: numEchipe,
        total_meciuri_analizate: meciuriAnalizate,
        sistem_organizare: leagueData.campionat.sistem_organizare || 'STANDARD',
        categorii_clasament: tierConfig.categories,
        procente_reusita: tiers
    };
}

/**
 * Main execution
 */
async function main() {
    console.log('═'.repeat(80));
    console.log('🔢 API SMART 5 - GENERATOR UNIVERSAL PROCENTE');
    console.log('═'.repeat(80));

    // Citește fișierele din AMBELE surse: data/seasons (prioritar, are xG/posesie) + API SMART 4
    const smart5Files = fs.existsSync(SMART5_SEASONS_DIR)
        ? fs.readdirSync(SMART5_SEASONS_DIR)
            .filter(f => f.endsWith('.json') && !f.includes('BACKUP') && !f.includes('CORRUPT'))
            .map(f => ({ file: f, dir: SMART5_SEASONS_DIR, source: 'SMART5' }))
        : [];

    const smart4Files = fs.existsSync(SMART4_DIR)
        ? fs.readdirSync(SMART4_DIR)
            .filter(f => f.endsWith('.json'))
            .filter(f => f.includes('JSON-') || f.includes('complete_FULL_SEASON'))
            .filter(f => !f.includes('PROGRESS_') && !f.includes('.backup'))
            .map(f => ({ file: f, dir: SMART4_DIR, source: 'SMART4' }))
        : [];

    // SMART5 primele (au prioritate), apoi SMART4
    const allFiles = [...smart5Files, ...smart4Files];
    console.log(`\n📂 Găsite ${smart5Files.length} fișiere SMART5 + ${smart4Files.length} fișiere SMART4 = ${allFiles.length} total\n`);

    // Creează JSON PROCENTE nou (pornim de la zero la fiecare regenerare)
    let procenteData = {
        versiune: "2.0",
        ultima_actualizare: "",
        total_campionate_analizate: 0,
        campionate: {}
    };
    console.log('📝 Generare JSON PROCENTE de la zero\n');

    let errors = 0;

    // FAZA 1: Grupăm toate fișierele pe campionat (combinăm sezoanele)
    // Normalizăm numele campionatului ca să combinăm Premier League din toate sezoanele
    const leagueGroups = {}; // key: normalized name -> { files: [], campionat: {}, meciuri: [] }

    const normalizeForGrouping = (name) => {
        // Scoatem anul/sezonul din nume și standardizăm
        return name
            .replace(/\s*\d{4}(-\d{4})?\s*/g, '') // scoate 2024-2025, 2024 etc.
            .replace(/\s*-\s*$/, '')                // trailing dash
            .trim();
    };

    for (const entry of allFiles) {
        try {
            const filePath = path.join(entry.dir, entry.file);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

            if (!data.meciuri || data.meciuri.length === 0) continue;

            const leagueName = data.campionat?.nume_complet || data.campionat?.nume || 'Unknown';
            const groupKey = normalizeForGrouping(leagueName);

            if (!leagueGroups[groupKey]) {
                leagueGroups[groupKey] = {
                    displayName: leagueName,
                    country: data.campionat?.tara || 'Unknown',
                    campionat: data.campionat,
                    meciuri: [],
                    files: [],
                    sezoane: []
                };
            }

            // SMART5 suprascrie displayName (format "COUNTRY: League")
            if (entry.source === 'SMART5') {
                leagueGroups[groupKey].displayName = leagueName;
                leagueGroups[groupKey].country = data.campionat?.tara || leagueGroups[groupKey].country;
                leagueGroups[groupKey].campionat = data.campionat;
            }

            // Adaugă meciurile (evită duplicate pe baza id_meci)
            const existingIds = new Set(leagueGroups[groupKey].meciuri.map(m => m.id_meci || m.id_flashscore));
            let added = 0;
            for (const m of data.meciuri) {
                const id = m.id_meci || m.id_flashscore;
                if (id && !existingIds.has(id)) {
                    leagueGroups[groupKey].meciuri.push(m);
                    existingIds.add(id);
                    added++;
                } else if (!id) {
                    leagueGroups[groupKey].meciuri.push(m);
                    added++;
                }
            }

            leagueGroups[groupKey].files.push(entry.file);
            const sezon = data.campionat?.sezon || 'unknown';
            if (!leagueGroups[groupKey].sezoane.includes(sezon)) {
                leagueGroups[groupKey].sezoane.push(sezon);
            }

            console.log(`   📥 ${entry.file} (${entry.source}): +${added} meciuri → ${groupKey}`);

        } catch (error) {
            console.error(`❌ Eroare la citire ${entry.file}:`, error.message);
            errors++;
        }
    }

    console.log(`\n📊 Grupate ${Object.keys(leagueGroups).length} campionate din ${allFiles.length} fișiere\n`);

    // FAZA 2: Procesăm fiecare grup
    let processed = 0;
    let skipped = 0;

    for (const [groupKey, group] of Object.entries(leagueGroups)) {
        try {
            const leagueName = group.displayName;
            const combinedData = {
                campionat: {
                    ...group.campionat,
                    sezon: group.sezoane.join(', ')
                },
                meciuri: group.meciuri
            };

            console.log(`\n📂 ${leagueName}: ${group.meciuri.length} meciuri din ${group.files.length} fișiere (sezoane: ${group.sezoane.join(', ')})`);

            const result = processLeague(combinedData, leagueName, group.country);
            procenteData.campionate[leagueName] = result;
            processed++;

        } catch (error) {
            console.error(`❌ Eroare la procesare ${groupKey}:`, error.message);
            errors++;
        }
    }

    // Actualizează metadata
    procenteData.total_campionate_analizate = Object.keys(procenteData.campionate).length;
    procenteData.data_ultima_actualizare = new Date().toISOString();
    procenteData.data_ultima_actualizare_ro = new Date().toLocaleDateString('ro-RO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    // Salvează în ambele locații
    fs.writeFileSync(PROCENTE_PATH, JSON.stringify(procenteData, null, 2), 'utf8');

    const altPath = path.join(__dirname, 'data', 'procente', 'JSON PROCENTE AUTOACTUAL.json');
    if (fs.existsSync(path.dirname(altPath))) {
        fs.writeFileSync(altPath, JSON.stringify(procenteData, null, 2), 'utf8');
    }

    console.log('\n' + '═'.repeat(80));
    console.log('✅ FINALIZAT!');
    console.log('═'.repeat(80));
    console.log(`📊 Campionate procesate: ${processed}`);
    console.log(`⏭️  Campionate sărite: ${skipped}`);
    console.log(`❌ Erori: ${errors}`);
    console.log(`📈 Total campionate în JSON PROCENTE: ${procenteData.total_campionate_analizate}`);
    console.log(`📅 Ultima actualizare: ${procenteData.data_ultima_actualizare_ro}`);
    console.log(`\n💾 Salvat în: ${PROCENTE_PATH}`);
    console.log('');
}

// Run
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Eroare fatală:', error);
        process.exit(1);
    });
}

module.exports = { processLeague, getTierConfig };
