/**
 * API SMART 5 - FlashScore API Client
 *
 * Modul central pentru accesarea API-ului FlashScore
 * Conține toate metodele necesare pentru extragerea datelor live
 *
 * METODE PRINCIPALE:
 * - parseFlashscoreData() - Parsează formatul custom FlashScore
 * - fetchFromAPI() - Fetch generic cu headers corecte + decompresie
 * - fetchLiveMatches() - Lista meciuri live
 * - fetchMatchDetails() - Detalii complete meci (core, summary, stats)
 * - fetchMainFeed() - Feed principal cu info despre meciuri și ligi
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Parse FlashScore's custom data format
 *
 * Format: ~key÷value¬key÷value~
 * Separatori:
 *   ~ = record separator
 *   ¬ = field separator
 *   ÷ = key-value separator
 */
function parseFlashscoreData(data) {
    if (!data || typeof data !== 'string') {
        return [];
    }

    const records = [];
    const recordSeparator = '~';
    const fieldSeparator = '¬';
    const keyValueSeparator = '÷';

    const rawRecords = data.split(recordSeparator);

    for (const rawRecord of rawRecords) {
        if (!rawRecord.trim()) continue;

        const record = {};
        const fields = rawRecord.split(fieldSeparator);

        for (const field of fields) {
            if (!field.trim()) continue;

            const [key, ...valueParts] = field.split(keyValueSeparator);
            const value = valueParts.join(keyValueSeparator);

            if (key && value !== undefined) {
                record[key] = value;
            }
        }

        if (Object.keys(record).length > 0) {
            records.push(record);
        }
    }

    return records;
}

/**
 * Fetch data from FlashScore API with proper headers + RETRY LOGIC
 *
 * Suportă:
 * - Compresie: gzip, brotli, deflate
 * - Headers: User-Agent, X-Fsign, Referer, Origin
 * - Timeout: 10 secunde
 * - Retry: 3 încercări pentru erori TLS/network
 */
async function fetchFromAPI(url, retryCount = 0) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 secunde

    try {
        return await fetchFromAPIRaw(url);
    } catch (error) {
        const isTLSError = error.message && (
            error.message.includes('TLS') ||
            error.message.includes('socket disconnected') ||
            error.message.includes('ECONNRESET') ||
            error.message.includes('ETIMEDOUT')
        );

        if (isTLSError && retryCount < MAX_RETRIES) {
            console.log(`   ⚠️  Eroare TLS/network, retry ${retryCount + 1}/${MAX_RETRIES} în ${RETRY_DELAY/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return fetchFromAPI(url, retryCount + 1);
        }

        throw error;
    }
}

/**
 * Fetch RAW (fără retry) - funcția originală
 */
function fetchFromAPIRaw(url) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://www.flashscore.com/',
                'Origin': 'https://www.flashscore.com',
                'X-Fsign': 'SW9D1eZo'
            }
        };

        const req = protocol.request(options, (res) => {
            let data = '';

            // Handle different encodings (gzip, brotli, deflate)
            if (res.headers['content-encoding'] === 'gzip' ||
                res.headers['content-encoding'] === 'br' ||
                res.headers['content-encoding'] === 'deflate') {
                const zlib = require('zlib');
                let decompressor;

                if (res.headers['content-encoding'] === 'gzip') {
                    decompressor = zlib.createGunzip();
                } else if (res.headers['content-encoding'] === 'br') {
                    decompressor = zlib.createBrotliDecompress();
                } else {
                    decompressor = zlib.createInflate();
                }

                res.pipe(decompressor);

                decompressor.on('data', (chunk) => {
                    data += chunk.toString('utf8');
                });

                decompressor.on('end', () => {
                    resolve(data);
                });

                decompressor.on('error', (err) => {
                    reject(err);
                });
            } else {
                res.on('data', (chunk) => {
                    data += chunk.toString('utf8');
                });

                res.on('end', () => {
                    resolve(data);
                });
            }
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

/**
 * Fetch list of live matches
 *
 * Endpoint: r_1_1 (live matches feed)
 * Returns: Array of match records
 */
async function fetchLiveMatches() {
    const url = 'https://global.flashscore.ninja/2/x/feed/r_1_1';
    const data = await fetchFromAPI(url);
    const parsed = parseFlashscoreData(data);
    return parsed;
}

/**
 * Fetch main feed (complete info about matches and leagues)
 *
 * Endpoint: f_1_0_2_en_1 (main feed)
 * Returns: { matches: {}, leagues: {}, timestamp: number }
 */
async function fetchMainFeed() {
    const url = 'https://global.flashscore.ninja/2/x/feed/f_1_0_2_en_1';
    const data = await fetchFromAPI(url);
    const records = parseFlashscoreData(data);

    // Parse records into leagues and matches
    const matches = {};
    const leagues = {};
    let currentLeagueId = null;

    for (const record of records) {
        // Check if it's a league record
        if (record.ZEE) {
            currentLeagueId = record.ZEE;
            leagues[currentLeagueId] = {
                id: record.ZEE,
                name: record.ZA || '',
                country: record.ZY || '',
                countryId: record.ZC || ''
            };
        }
        // Check if it's a match record
        else if (record.AA && record.AE && record.AF) {
            // Use match's OWN tournament/league ID
            const matchLeagueId = record.ZEZ || record.ZY || currentLeagueId || '';

            matches[record.AA] = {
                matchId: record.AA,
                homeTeam: record.AE || 'Unknown',
                awayTeam: record.AF || 'Unknown',
                leagueId: matchLeagueId,
                timestamp: parseInt(record.AD) || 0,
                homeScore: parseInt(record.AG) || 0,
                awayScore: parseInt(record.AT) || 0,
                status: record.AB || '',
                finished: record.AZ == 1
            };
        }
    }

    return {
        matches,
        leagues,
        timestamp: Date.now()
    };
}

/**
 * Fetch detailed match data
 *
 * Endpoints:
 *   - dc_1_{matchId} - Core match data
 *   - df_sui_1_{matchId} - Summary/incidents (goals by halves)
 *   - df_st_1_{matchId} - Statistics (THE IMPORTANT ONE for halftime stats)
 *
 * Returns: {
 *   matchId: string,
 *   core: object,
 *   summary: array,
 *   statsData: array,
 *   timestamp: number
 * }
 */
async function fetchMatchDetails(matchId) {
    const details = {
        matchId: matchId,
        core: null,
        summary: null,
        statsData: null,
        timestamp: Date.now()
    };

    try {
        // Core match data
        const coreUrl = `https://global.flashscore.ninja/2/x/feed/dc_1_${matchId}`;
        const coreData = await fetchFromAPI(coreUrl);
        const coreParsed = parseFlashscoreData(coreData);
        details.core = coreParsed.length > 0 ? coreParsed[0] : null;

        // Summary/incidents data (goals by halves)
        const summaryUrl = `https://global.flashscore.ninja/2/x/feed/df_sui_1_${matchId}`;
        const summaryData = await fetchFromAPI(summaryUrl);
        const summaryParsed = parseFlashscoreData(summaryData);
        details.summary = summaryParsed;

        // Statistics data (THE IMPORTANT ONE for halftime stats)
        const statsUrl = `https://2.flashscore.ninja/2/x/feed/df_st_1_${matchId}`;
        const statsData = await fetchFromAPI(statsUrl);
        const statsParsed = parseFlashscoreData(statsData);
        details.statsData = statsParsed;

        return details;

    } catch (error) {
        throw new Error(`Failed to fetch match ${matchId}: ${error.message}`);
    }
}

/**
 * Get match info from main feed
 */
async function getMatchFromMainFeed(matchId) {
    const feed = await fetchMainFeed();

    const match = feed.matches[matchId];
    if (!match) {
        return null;
    }

    // Get league info
    const league = feed.leagues[match.leagueId] || {};

    return {
        ...match,
        leagueName: league.name || 'Unknown League',
        country: league.country || 'Unknown'
    };
}

// Export all methods
module.exports = {
    // Core methods
    parseFlashscoreData,
    fetchFromAPI,

    // High-level methods
    fetchLiveMatches,
    fetchMainFeed,
    fetchMatchDetails,
    getMatchFromMainFeed
};
