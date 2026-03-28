/**
 * BACKFILL_LEAGUE_CONFIG.js
 *
 * Registru campionate pentru completare automata meciuri lipsa
 *
 * Fiecare campionat contine:
 * - name: Numele canonic (format "COUNTRY: League")
 * - country/league: Slugs URL FlashScore
 * - seasons: Array de sezoane cu:
 *   - id: "2024-2025" etc.
 *   - urlSuffix: null (sezon curent) sau "2023-2024" (sezon vechi)
 *   - seasonFile: Sufixul din numele fisierului JSON existent
 *   - expectedMatches: Numar estimat meciuri complete in sezon
 * - priority: 1 (top 5), 2 (restul), 3 (cupe)
 *
 * Pattern URL:
 * - Sezon curent: https://www.flashscore.com/football/{country}/{league}/results/
 * - Sezon vechi:  https://www.flashscore.com/football/{country}/{league}-{urlSuffix}/results/
 */

const BACKFILL_LEAGUES = [

    // ═══════════════════════════════════════════════
    // PRIORITY 1: Top 5 ligi europene
    // ═══════════════════════════════════════════════

    {
        name: 'ENGLAND: Premier League',
        country: 'england',
        league: 'premier-league',
        seasons: [
            { id: '2025-2026', urlSuffix: null, seasonFile: 'PremierLeague_2025-2026', expectedMatches: 380 },
            { id: '2024-2025', urlSuffix: '2024-2025', seasonFile: 'PremierLeague_2024-2025', expectedMatches: 380 },
            { id: '2023-2024', urlSuffix: '2023-2024', seasonFile: 'PremierLeague_2023-2024', expectedMatches: 380 },
            { id: '2022-2023', urlSuffix: '2022-2023', seasonFile: 'PremierLeague_2022-2023', expectedMatches: 380 },
            { id: '2021-2022', urlSuffix: '2021-2022', seasonFile: 'PremierLeague_2021-2022', expectedMatches: 380 }
        ],
        priority: 1
    },
    {
        name: 'SPAIN: LaLiga',
        country: 'spain',
        league: 'laliga',
        seasons: [
            { id: '2025-2026', urlSuffix: null, seasonFile: 'LaLiga_2025-2026', expectedMatches: 380 },
            { id: '2024-2025', urlSuffix: '2024-2025', seasonFile: 'LaLiga_2024-2025', expectedMatches: 380 },
            { id: '2023-2024', urlSuffix: '2023-2024', seasonFile: 'LaLiga_2023-2024', expectedMatches: 380 },
            { id: '2022-2023', urlSuffix: '2022-2023', seasonFile: 'LaLiga_2022-2023', expectedMatches: 380 },
            { id: '2021-2022', urlSuffix: '2021-2022', seasonFile: 'LaLiga_2021-2022', expectedMatches: 380 }
        ],
        priority: 1
    },
    {
        name: 'GERMANY: Bundesliga',
        country: 'germany',
        league: 'bundesliga',
        seasons: [
            { id: '2025-2026', urlSuffix: null, seasonFile: 'Bundesliga_2025-2026', expectedMatches: 306 },
            { id: '2024-2025', urlSuffix: '2024-2025', seasonFile: 'Bundesliga_2024-2025', expectedMatches: 306 },
            { id: '2023-2024', urlSuffix: '2023-2024', seasonFile: 'Bundesliga_2023-2024', expectedMatches: 306 },
            { id: '2022-2023', urlSuffix: '2022-2023', seasonFile: 'Bundesliga_2022-2023', expectedMatches: 306 },
            { id: '2021-2022', urlSuffix: '2021-2022', seasonFile: 'Bundesliga_2021-2022', expectedMatches: 306 }
        ],
        priority: 1
    },
    {
        name: 'ITALY: Serie A',
        country: 'italy',
        league: 'serie-a',
        seasons: [
            { id: '2025-2026', urlSuffix: null, seasonFile: 'SerieA_2025-2026', expectedMatches: 380 },
            { id: '2024-2025', urlSuffix: '2024-2025', seasonFile: 'SerieA_2024-2025', expectedMatches: 380 },
            { id: '2023-2024', urlSuffix: '2023-2024', seasonFile: 'SerieA_2023-2024', expectedMatches: 380 },
            { id: '2022-2023', urlSuffix: '2022-2023', seasonFile: 'SerieA_2022-2023', expectedMatches: 380 },
            { id: '2021-2022', urlSuffix: '2021-2022', seasonFile: 'SerieA_2021-2022', expectedMatches: 380 }
        ],
        priority: 1
    },
    {
        name: 'FRANCE: Ligue 1',
        country: 'france',
        league: 'ligue-1',
        seasons: [
            { id: '2025-2026', urlSuffix: null, seasonFile: 'Ligue1_2025-2026', expectedMatches: 306 },
            { id: '2024-2025', urlSuffix: '2024-2025', seasonFile: 'Ligue1_2024-2025', expectedMatches: 306 },
            { id: '2023-2024', urlSuffix: '2023-2024', seasonFile: 'Ligue1_2023-2024', expectedMatches: 380 },
            { id: '2022-2023', urlSuffix: '2022-2023', seasonFile: 'Ligue1_2022-2023', expectedMatches: 380 },
            { id: '2021-2022', urlSuffix: '2021-2022', seasonFile: 'Ligue1_2021-2022', expectedMatches: 380 }
        ],
        priority: 1
    },

    // ═══════════════════════════════════════════════
    // PRIORITY 2: Ligi europene importante
    // ═══════════════════════════════════════════════

    {
        name: 'NETHERLANDS: Eredivisie',
        country: 'netherlands',
        league: 'eredivisie',
        seasons: [
            { id: '2025-2026', urlSuffix: null, seasonFile: 'Eredivisie_2025-2026', expectedMatches: 306 },
            { id: '2024-2025', urlSuffix: '2024-2025', seasonFile: 'Eredivisie_2024-2025', expectedMatches: 306 },
            { id: '2023-2024', urlSuffix: '2023-2024', seasonFile: 'Eredivisie_2023-2024', expectedMatches: 306 },
            { id: '2022-2023', urlSuffix: '2022-2023', seasonFile: 'Eredivisie_2022-2023', expectedMatches: 306 },
            { id: '2021-2022', urlSuffix: '2021-2022', seasonFile: 'Eredivisie_2021-2022', expectedMatches: 306 }
        ],
        priority: 2
    },
    {
        name: 'PORTUGAL: Liga Portugal',
        country: 'portugal',
        league: 'liga-portugal',
        seasons: [
            { id: '2025-2026', urlSuffix: null, seasonFile: 'PrimeiraLiga_2025-2026', expectedMatches: 306 },
            { id: '2024-2025', urlSuffix: '2024-2025', seasonFile: 'PrimeiraLiga_2024-2025', expectedMatches: 306 },
            { id: '2023-2024', urlSuffix: '2023-2024', seasonFile: 'PrimeiraLiga_2023-2024', expectedMatches: 306 },
            { id: '2022-2023', urlSuffix: '2022-2023', seasonFile: 'PrimeiraLiga_2022-2023', expectedMatches: 306 },
            { id: '2021-2022', urlSuffix: '2021-2022', seasonFile: 'PrimeiraLiga_2021-2022', expectedMatches: 306 }
        ],
        priority: 2
    },
    {
        name: 'BELGIUM: Regular Season',
        country: 'belgium',
        league: 'jupiler-pro-league',
        seasons: [
            { id: '2025-2026', urlSuffix: null, seasonFile: 'BELGIUMJupilerProLeague_2025-2026', expectedMatches: 240 },
            { id: '2024-2025', urlSuffix: '2024-2025', seasonFile: 'BELGIUMRegularSeason_2024-2025', expectedMatches: 240 },
            { id: '2023-2024', urlSuffix: '2023-2024', seasonFile: 'BELGIUMRegularSeason_2023-2024', expectedMatches: 240 },
            { id: '2022-2023', urlSuffix: '2022-2023', seasonFile: 'BELGIUMRegularSeason_2022-2023', expectedMatches: 240 },
            { id: '2021-2022', urlSuffix: '2021-2022', seasonFile: 'BELGIUMRegularSeason_2021-2022', expectedMatches: 240 }
        ],
        priority: 2
    },
    {
        name: 'TURKEY: Super Lig',
        country: 'turkey',
        league: 'super-lig',
        seasons: [
            { id: '2025-2026', urlSuffix: null, seasonFile: 'TURKEYSuperLig_2025-2026', expectedMatches: 306 },
            { id: '2024-2025', urlSuffix: '2024-2025', seasonFile: 'TURKEYSuperLig_2024-2025', expectedMatches: 306 },
            { id: '2023-2024', urlSuffix: '2023-2024', seasonFile: 'TURKEYSuperLig_2023-2024', expectedMatches: 306 },
            { id: '2022-2023', urlSuffix: '2022-2023', seasonFile: 'TURKEYSuperLig_2022-2023', expectedMatches: 306 },
            { id: '2021-2022', urlSuffix: '2021-2022', seasonFile: 'TURKEYSuperLig_2021-2022', expectedMatches: 306 }
        ],
        priority: 2
    },
    {
        name: 'SCOTLAND: Premiership',
        country: 'scotland',
        league: 'premiership',
        seasons: [
            { id: '2025-2026', urlSuffix: null, seasonFile: 'SCOTLANDPremiership_2025-2026', expectedMatches: 228 },
            { id: '2024-2025', urlSuffix: '2024-2025', seasonFile: 'SCOTLANDPremiership_2024-2025', expectedMatches: 228 },
            { id: '2023-2024', urlSuffix: '2023-2024', seasonFile: 'SCOTLANDPremiership_2023-2024', expectedMatches: 228 },
            { id: '2022-2023', urlSuffix: '2022-2023', seasonFile: 'SCOTLANDPremiership_2022-2023', expectedMatches: 228 },
            { id: '2021-2022', urlSuffix: '2021-2022', seasonFile: 'SCOTLANDPremiership_2021-2022', expectedMatches: 228 }
        ],
        priority: 2
    },
    {
        name: 'AUSTRIA: Bundesliga',
        country: 'austria',
        league: 'bundesliga',
        seasons: [
            { id: '2025-2026', urlSuffix: null, seasonFile: 'AUSTRIABundesliga_2025-2026', expectedMatches: 182 },
            { id: '2024-2025', urlSuffix: '2024-2025', seasonFile: 'AUSTRIABundesliga_2024-2025', expectedMatches: 182 },
            { id: '2023-2024', urlSuffix: '2023-2024', seasonFile: 'AUSTRIABundesliga_2023-2024', expectedMatches: 182 },
            { id: '2022-2023', urlSuffix: '2022-2023', seasonFile: 'AUSTRIABundesliga_2022-2023', expectedMatches: 182 },
            { id: '2021-2022', urlSuffix: '2021-2022', seasonFile: 'AUSTRIABundesliga_2021-2022', expectedMatches: 182 }
        ],
        priority: 2
    },
    {
        name: 'DENMARK: Superliga',
        country: 'denmark',
        league: 'superliga',
        seasons: [
            { id: '2025-2026', urlSuffix: null, seasonFile: 'Superliga_2025-2026', expectedMatches: 198 },
            { id: '2024-2025', urlSuffix: '2024-2025', seasonFile: 'Superliga_2024-2025', expectedMatches: 198 },
            { id: '2023-2024', urlSuffix: '2023-2024', seasonFile: 'Superliga_2023-2024', expectedMatches: 198 },
            { id: '2022-2023', urlSuffix: '2022-2023', seasonFile: 'Superliga_2022-2023', expectedMatches: 198 },
            { id: '2021-2022', urlSuffix: '2021-2022', seasonFile: 'Superliga_2021-2022', expectedMatches: 198 }
        ],
        priority: 2
    },
    {
        name: 'SWITZERLAND: Super League',
        country: 'switzerland',
        league: 'super-league',
        seasons: [
            { id: '2025-2026', urlSuffix: null, seasonFile: 'SWITZERLANDSuperLeague_2025-2026', expectedMatches: 182 },
            { id: '2024-2025', urlSuffix: '2024-2025', seasonFile: 'SWITZERLANDSuperLeague_2024-2025', expectedMatches: 182 },
            { id: '2023-2024', urlSuffix: '2023-2024', seasonFile: 'SWITZERLANDSuperLeague_2023-2024', expectedMatches: 182 },
            { id: '2022-2023', urlSuffix: '2022-2023', seasonFile: 'SWITZERLANDSuperLeague_2022-2023', expectedMatches: 182 },
            { id: '2021-2022', urlSuffix: '2021-2022', seasonFile: 'SWITZERLANDSuperLeague_2021-2022', expectedMatches: 182 }
        ],
        priority: 2
    },
    {
        name: 'GREECE: Super League',
        country: 'greece',
        league: 'super-league',
        seasons: [
            { id: '2025-2026', urlSuffix: null, seasonFile: 'GREECESuperLeague_2025-2026', expectedMatches: 182 },
            { id: '2024-2025', urlSuffix: '2024-2025', seasonFile: 'GREECESuperLeague_2024-2025', expectedMatches: 182 },
            { id: '2023-2024', urlSuffix: '2023-2024', seasonFile: 'GREECESuperLeague_2023-2024', expectedMatches: 182 },
            { id: '2022-2023', urlSuffix: '2022-2023', seasonFile: 'GREECESuperLeague_2022-2023', expectedMatches: 182 },
            { id: '2021-2022', urlSuffix: '2021-2022', seasonFile: 'GREECESuperLeague_2021-2022', expectedMatches: 182 }
        ],
        priority: 2
    },
    {
        name: 'ROMANIA: Superliga',
        country: 'romania',
        league: 'superliga',
        seasons: [
            { id: '2025-2026', urlSuffix: null, seasonFile: 'ROMANIASuperliga_2025-2026', expectedMatches: 240 },
            { id: '2024-2025', urlSuffix: '2024-2025', seasonFile: 'ROMANIASuperliga_2024-2025', expectedMatches: 240 },
            { id: '2023-2024', urlSuffix: '2023-2024', seasonFile: 'ROMANIASuperliga_2023-2024', expectedMatches: 240 },
            { id: '2022-2023', urlSuffix: '2022-2023', seasonFile: 'ROMANIASuperliga_2022-2023', expectedMatches: 240 },
            { id: '2021-2022', urlSuffix: '2021-2022', seasonFile: 'ROMANIASuperliga_2021-2022', expectedMatches: 240 }
        ],
        priority: 2
    },
    {
        name: 'SERBIA: Mozzart Bet Super Liga',
        country: 'serbia',
        league: 'mozzart-bet-super-liga',
        seasons: [
            { id: '2025-2026', urlSuffix: null, seasonFile: 'SERBIAMozzartBetSuperLiga_2025-2026', expectedMatches: 240 },
            { id: '2024-2025', urlSuffix: '2024-2025', seasonFile: 'SERBIAMozzartBetSuperLiga_2024-2025', expectedMatches: 240 },
            { id: '2023-2024', urlSuffix: '2023-2024', seasonFile: 'SERBIAMozzartBetSuperLiga_2023-2024', expectedMatches: 240 },
            { id: '2022-2023', urlSuffix: '2022-2023', seasonFile: 'SERBIAMozzartBetSuperLiga_2022-2023', expectedMatches: 240 },
            { id: '2021-2022', urlSuffix: '2021-2022', seasonFile: 'SERBIAMozzartBetSuperLiga_2021-2022', expectedMatches: 240 }
        ],
        priority: 2
    },
    {
        name: 'POLAND: Ekstraklasa',
        country: 'poland',
        league: 'ekstraklasa',
        seasons: [
            { id: '2025-2026', urlSuffix: null, seasonFile: 'POLANDEkstraklasa_2025-2026', expectedMatches: 306 },
            { id: '2024-2025', urlSuffix: '2024-2025', seasonFile: 'POLONIAEkstraklasa_2024-2025', expectedMatches: 306 },
            { id: '2023-2024', urlSuffix: '2023-2024', seasonFile: 'POLONIAEkstraklasa_2023-2024', expectedMatches: 306 },
            { id: '2022-2023', urlSuffix: '2022-2023', seasonFile: 'POLONIAEkstraklasa_2022-2023', expectedMatches: 306 },
            { id: '2021-2022', urlSuffix: '2021-2022', seasonFile: 'POLONIAEkstraklasa_2021-2022', expectedMatches: 306 }
        ],
        priority: 2
    },

    // ═══════════════════════════════════════════════
    // PRIORITY 2: Ligi secundare
    // ═══════════════════════════════════════════════

    {
        name: 'ENGLAND: Championship',
        country: 'england',
        league: 'championship',
        seasons: [
            { id: '2025-2026', urlSuffix: null, seasonFile: 'ENGLANDChampionship_2025-2026', expectedMatches: 552 },
            { id: '2024-2025', urlSuffix: '2024-2025', seasonFile: 'ENGLANDChampionship_2024-2025', expectedMatches: 552 },
            { id: '2023-2024', urlSuffix: '2023-2024', seasonFile: 'ENGLANDChampionship_2023-2024', expectedMatches: 552 },
            { id: '2022-2023', urlSuffix: '2022-2023', seasonFile: 'ENGLANDChampionship_2022-2023', expectedMatches: 552 },
            { id: '2021-2022', urlSuffix: '2021-2022', seasonFile: 'ENGLANDChampionship_2021-2022', expectedMatches: 552 }
        ],
        priority: 2
    },
    {
        name: 'GERMANY: 2. Bundesliga',
        country: 'germany',
        league: '2-bundesliga',
        seasons: [
            { id: '2025-2026', urlSuffix: null, seasonFile: 'GERMANY2Bundesliga_2025-2026', expectedMatches: 306 },
            { id: '2024-2025', urlSuffix: '2024-2025', seasonFile: 'GERMANY2Bundesliga_2024-2025', expectedMatches: 306 },
            { id: '2023-2024', urlSuffix: '2023-2024', seasonFile: 'GERMANY2Bundesliga_2023-2024', expectedMatches: 306 },
            { id: '2022-2023', urlSuffix: '2022-2023', seasonFile: 'GERMANY2Bundesliga_2022-2023', expectedMatches: 306 },
            { id: '2021-2022', urlSuffix: '2021-2022', seasonFile: 'GERMANY2Bundesliga_2021-2022', expectedMatches: 306 }
        ],
        priority: 2
    },
    {
        name: 'SPAIN: LaLiga2',
        country: 'spain',
        league: 'laliga2',
        seasons: [
            { id: '2025-2026', urlSuffix: null, seasonFile: 'SPAINLaLiga2_2025-2026', expectedMatches: 462 },
            { id: '2024-2025', urlSuffix: '2024-2025', seasonFile: 'SPAINLaLiga2_2024-2025', expectedMatches: 462 },
            { id: '2023-2024', urlSuffix: '2023-2024', seasonFile: 'SPAINLaLiga2_2023-2024', expectedMatches: 462 },
            { id: '2022-2023', urlSuffix: '2022-2023', seasonFile: 'SPAINLaLiga2_2022-2023', expectedMatches: 462 },
            { id: '2021-2022', urlSuffix: '2021-2022', seasonFile: 'SPAINLaLiga2_2021-2022', expectedMatches: 462 }
        ],
        priority: 2
    },

    // ═══════════════════════════════════════════════
    // PRIORITY 2: Ligi nordice / americi
    // ═══════════════════════════════════════════════

    {
        name: 'NORWAY: Eliteserien',
        country: 'norway',
        league: 'eliteserien',
        seasons: [
            { id: '2024', urlSuffix: '2024', seasonFile: 'Eliteserien_2024', expectedMatches: 240 },
            { id: '2023', urlSuffix: '2023', seasonFile: 'Eliteserien_2023', expectedMatches: 240 },
            { id: '2022', urlSuffix: '2022', seasonFile: 'Eliteserien_2022', expectedMatches: 240 },
            { id: '2021', urlSuffix: '2021', seasonFile: 'Eliteserien_2021', expectedMatches: 240 }
        ],
        priority: 2
    },
    {
        name: 'SWEDEN: Allsvenskan',
        country: 'sweden',
        league: 'allsvenskan',
        seasons: [
            { id: '2024-2025', urlSuffix: '2024', seasonFile: 'SWEDENAllsvenskan_2024-2025', expectedMatches: 240 },
            { id: '2023', urlSuffix: '2023', seasonFile: 'SWEDENAllsvenskan_2023', expectedMatches: 240 },
            { id: '2022', urlSuffix: '2022', seasonFile: 'SWEDENAllsvenskan_2022', expectedMatches: 240 },
            { id: '2021', urlSuffix: '2021', seasonFile: 'SWEDENAllsvenskan_2021', expectedMatches: 240 }
        ],
        priority: 2
    },
    {
        name: 'BRAZIL: Serie A',
        country: 'brazil',
        league: 'serie-a',
        seasons: [
            { id: '2024', urlSuffix: '2024', seasonFile: 'BRAZILSerieA_2024', expectedMatches: 380 },
            { id: '2025', urlSuffix: '2025', seasonFile: 'BRAZILSerieA_2025', expectedMatches: 380 },
            { id: '2023', urlSuffix: '2023', seasonFile: 'BRAZILSerieA_2023', expectedMatches: 380 },
            { id: '2022', urlSuffix: '2022', seasonFile: 'BRAZILSerieA_2022', expectedMatches: 380 }
        ],
        priority: 2
    },

    // ═══════════════════════════════════════════════
    // PRIORITY 3: Competitii europene (cupe)
    // ═══════════════════════════════════════════════

    {
        name: 'EUROPE: Champions League',
        country: 'europe',
        league: 'champions-league',
        seasons: [
            { id: '2025-2026', urlSuffix: null, seasonFile: 'ChampionsLeague_2025-2026', expectedMatches: 189 },
            { id: '2024-2025', urlSuffix: '2024-2025', seasonFile: 'ChampionsLeague_2024-2025', expectedMatches: 189 },
            { id: '2023-2024', urlSuffix: '2023-2024', seasonFile: 'ChampionsLeague_2023-2024', expectedMatches: 189 },
            { id: '2022-2023', urlSuffix: '2022-2023', seasonFile: 'ChampionsLeague_2022-2023', expectedMatches: 189 },
            { id: '2021-2022', urlSuffix: '2021-2022', seasonFile: 'ChampionsLeague_2021-2022', expectedMatches: 189 }
        ],
        priority: 3
    },
    {
        name: 'EUROPE: Europa League',
        country: 'europe',
        league: 'europa-league',
        seasons: [
            { id: '2025-2026', urlSuffix: null, seasonFile: 'EuropaLeague_2025-2026', expectedMatches: 189 },
            { id: '2024-2025', urlSuffix: '2024-2025', seasonFile: 'EuropaLeague_2024-2025', expectedMatches: 189 },
            { id: '2023-2024', urlSuffix: '2023-2024', seasonFile: 'EuropaLeague_2023-2024', expectedMatches: 189 },
            { id: '2022-2023', urlSuffix: '2022-2023', seasonFile: 'EuropaLeague_2022-2023', expectedMatches: 189 },
            { id: '2021-2022', urlSuffix: '2021-2022', seasonFile: 'EuropaLeague_2021-2022', expectedMatches: 189 }
        ],
        priority: 3
    },
    {
        name: 'EUROPE: Conference League',
        country: 'europe',
        league: 'europa-conference-league',
        seasons: [
            { id: '2025-2026', urlSuffix: null, seasonFile: 'ConferenceLeague_2025-2026', expectedMatches: 189 },
            { id: '2024-2025', urlSuffix: '2024-2025', seasonFile: 'ConferenceLeague_2024-2025', expectedMatches: 189 },
            { id: '2023-2024', urlSuffix: '2023-2024', seasonFile: 'ConferenceLeague_2023-2024', expectedMatches: 189 },
            { id: '2022-2023', urlSuffix: '2022-2023', seasonFile: 'ConferenceLeague_2022-2023', expectedMatches: 189 },
            { id: '2021-2022', urlSuffix: '2021-2022', seasonFile: 'ConferenceLeague_2021-2022', expectedMatches: 189 }
        ],
        priority: 3
    }
];

/**
 * Construieste URL-ul FlashScore de rezultate
 */
function buildResultsURL(leagueConfig, season) {
    const base = 'https://www.flashscore.com/football';
    if (season.urlSuffix) {
        return `${base}/${leagueConfig.country}/${leagueConfig.league}-${season.urlSuffix}/results/`;
    }
    return `${base}/${leagueConfig.country}/${leagueConfig.league}/results/`;
}

/**
 * Returneaza calea JSON pentru un sezon
 */
function getSeasonFilePath(season) {
    return `/home/florian/API SMART 5/data/seasons/complete_FULL_SEASON_${season.seasonFile}.json`;
}

/**
 * Returneaza toate ligile sortate dupa prioritate
 */
function getLeaguesByPriority() {
    return [...BACKFILL_LEAGUES].sort((a, b) => a.priority - b.priority);
}

/**
 * Cauta o liga dupa nume
 */
function findLeague(name) {
    return BACKFILL_LEAGUES.find(l =>
        l.name.toLowerCase() === name.toLowerCase() ||
        l.name.toLowerCase().includes(name.toLowerCase())
    );
}

/**
 * Numara total combinatii campionat+sezon
 */
function getTotalCombinations() {
    return BACKFILL_LEAGUES.reduce((sum, l) => sum + l.seasons.length, 0);
}

module.exports = {
    BACKFILL_LEAGUES,
    buildResultsURL,
    getSeasonFilePath,
    getLeaguesByPriority,
    findLeague,
    getTotalCombinations
};

// CLI: afiseaza configurarea
if (require.main === module) {
    console.log('\n=== BACKFILL LEAGUE CONFIG ===\n');
    console.log(`Total campionate: ${BACKFILL_LEAGUES.length}`);
    console.log(`Total combinatii campionat+sezon: ${getTotalCombinations()}`);
    console.log('');

    for (const league of getLeaguesByPriority()) {
        for (const season of league.seasons) {
            const url = buildResultsURL(league, season);
            const filePath = getSeasonFilePath(season);
            console.log(`[P${league.priority}] ${league.name} ${season.id}`);
            console.log(`     URL: ${url}`);
            console.log(`     JSON: ${filePath}`);
            console.log('');
        }
    }
}
