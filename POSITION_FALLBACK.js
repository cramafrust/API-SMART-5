/**
 * POSITION_FALLBACK - Caută poziția/tier-ul unei echipe în datele istorice
 *
 * Folosit când scraping-ul clasamentului live eșuează.
 * Caută în sezoanele salvate cel mai recent meci al echipei
 * și returnează poziția/tier-ul de acolo.
 */

const fs = require('fs');
const path = require('path');

const SEASONS_DIR = path.join(__dirname, 'data', 'seasons');

// Cache pentru a nu citi fișierele de fiecare dată
let cache = {};
let cacheTimestamp = 0;
const CACHE_TTL = 3600000; // 1 oră

/**
 * Normalizează numele echipei pentru comparare
 */
function normalizeName(name) {
    if (!name) return '';
    let n = name.toLowerCase().trim().replace(/\s+/g, ' ');
    // Elimină prefixe/sufixe comune
    const prefixes = ['fc ', 'fk ', 'cs ', 'csm ', 'fcv ', 'fcs ', 'afc ', 'sc ', 'as ', 'ac ', 'cf '];
    for (const p of prefixes) {
        if (n.startsWith(p)) n = n.substring(p.length);
    }
    const suffixes = [' fc', ' fk', ' cs'];
    for (const s of suffixes) {
        if (n.endsWith(s)) n = n.substring(0, n.length - s.length);
    }
    return n.trim();
}

/**
 * Normalizează numele ligii pentru a găsi fișierele potrivite
 */
function leagueToFilePattern(leagueName) {
    if (!leagueName) return null;
    const l = leagueName.toLowerCase();

    if (l.includes('premier league')) return 'PremierLeague';
    if (l.includes('la liga') && !l.includes('2')) return 'LaLiga';
    if (l.includes('serie a') && l.includes('italy')) return 'SerieA';
    if (l.includes('serie a') && !l.includes('brazil')) return 'SerieA';
    if (l.includes('bundesliga') && !l.includes('2.') && !l.includes('austria')) return 'Bundesliga';
    if (l.includes('ligue 1')) return 'Ligue1';
    if (l.includes('eredivisie')) return 'Eredivisie';
    if (l.includes('championship')) return 'ENGLANDChampionship';
    if (l.includes('champions league')) return 'ChampionsLeague';
    if (l.includes('europa league')) return 'EuropaLeague';
    if (l.includes('conference league')) return 'ConferenceLeague';
    if (l.includes('superliga') && l.includes('roman')) return 'ROMANIASuperliga';
    if (l.includes('super lig') && l.includes('turk')) return 'TURKEYSuperLig';
    if (l.includes('primeira liga') || l.includes('liga portugal')) return 'PrimeiraLiga';
    if (l.includes('super league') && l.includes('swiss')) return 'SWITZERLANDSuperLeague';
    if (l.includes('super league') && l.includes('greece')) return 'GREECESuperLeague';
    if (l.includes('ekstraklasa')) return 'POLANDEkstraklasa';
    if (l.includes('2. bundesliga')) return 'GERMANY2Bundesliga';
    if (l.includes('la liga 2') || l.includes('laliga2')) return 'SPAINLaLiga2';
    if (l.includes('allsvenskan')) return 'SWEDENAllsvenskan';
    if (l.includes('eliteserien')) return 'Eliteserien';
    if (l.includes('jupiler')) return 'BELGIUMJupilerProLeague';
    if (l.includes('mozzart') || l.includes('serbia')) return 'SERBIAMozzartBetSuperLiga';
    if (l.includes('bundesliga') && l.includes('austria')) return 'AUSTRIABundesliga';
    if (l.includes('superliga') && l.includes('denmark')) return 'Superliga';
    if (l.includes('mls')) return 'USAMLS';

    return null;
}

/**
 * Caută poziția/tier-ul unei echipe în datele istorice
 *
 * @param {string} leagueName - Numele ligii (ex: "ENGLAND: Premier League")
 * @param {string} teamName - Numele echipei (ex: "Tottenham")
 * @returns {Object|null} - { position, tier, totalTeams, source }
 */
function getPositionFromHistory(leagueName, teamName) {
    const filePattern = leagueToFilePattern(leagueName);
    if (!filePattern) return null;

    const normalizedTeam = normalizeName(teamName);
    const cacheKey = `${filePattern}:${normalizedTeam}`;

    // Check cache
    if (cache[cacheKey] && (Date.now() - cacheTimestamp) < CACHE_TTL) {
        return cache[cacheKey];
    }

    try {
        // Găsește fișierele sezonului curent (cel mai recent mai întâi)
        const files = fs.readdirSync(SEASONS_DIR)
            .filter(f => f.includes(filePattern) && f.endsWith('.json') &&
                !f.includes('BACKUP') && !f.includes('OLD_FORMAT') && !f.includes('pre-'))
            .sort()
            .reverse(); // Cel mai recent sezon mai întâi

        for (const f of files) {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(SEASONS_DIR, f), 'utf8'));
                const meciuri = data.meciuri || [];

                // Parcurgem meciurile de la cele mai recente
                for (let i = meciuri.length - 1; i >= 0; i--) {
                    const m = meciuri[i];
                    if (!m.echipa_gazda || !m.echipa_oaspete) continue;

                    let position = null;
                    let tier = null;

                    // Verifică dacă echipa e gazdă
                    if (normalizeName(m.echipa_gazda.nume) === normalizedTeam ||
                        normalizeName(m.echipa_gazda.nume_complet) === normalizedTeam ||
                        (m.echipa_gazda.nume && normalizedTeam.includes(normalizeName(m.echipa_gazda.nume))) ||
                        (m.echipa_gazda.nume && normalizeName(m.echipa_gazda.nume).includes(normalizedTeam))) {
                        position = m.echipa_gazda.pozitie_clasament_inainte;
                        tier = m.tier_gazda;
                    }
                    // Verifică dacă echipa e oaspete
                    else if (normalizeName(m.echipa_oaspete.nume) === normalizedTeam ||
                             normalizeName(m.echipa_oaspete.nume_complet) === normalizedTeam ||
                             (m.echipa_oaspete.nume && normalizedTeam.includes(normalizeName(m.echipa_oaspete.nume))) ||
                             (m.echipa_oaspete.nume && normalizeName(m.echipa_oaspete.nume).includes(normalizedTeam))) {
                        position = m.echipa_oaspete.pozitie_clasament_inainte;
                        tier = m.tier_oaspete;
                    }

                    if (tier) {
                        const result = {
                            position: position,
                            tier: tier,
                            totalTeams: data.liga ? data.liga.numar_echipe : null,
                            source: `historical:${f}`,
                            matchDate: m.data_ora ? m.data_ora.data : null
                        };

                        // Salvează în cache
                        cache[cacheKey] = result;
                        cacheTimestamp = Date.now();

                        return result;
                    }
                }
            } catch (e) {
                // Fișier corupt, skip
                continue;
            }
        }
    } catch (e) {
        console.error(`   ⚠️  Eroare POSITION_FALLBACK: ${e.message}`);
    }

    return null;
}

/**
 * Curăță cache-ul
 */
function clearCache() {
    cache = {};
    cacheTimestamp = 0;
}

module.exports = { getPositionFromHistory, clearCache };
