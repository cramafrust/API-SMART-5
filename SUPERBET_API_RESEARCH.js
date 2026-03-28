/**
 * 🔍 SUPERBET API RESEARCH
 *
 * Investigație pentru a găsi API-ul Superbet pentru cote
 *
 * METODOLOGIE:
 * 1. Inspectăm Network traffic când încărcăm un meci pe Superbet.ro
 * 2. Găsim endpoint-ul API care returnează cotele
 * 3. Identificăm headers necesare
 * 4. Testăm accesul direct
 */

const https = require('https');
const { URL } = require('url');

/**
 * Fetch generic cu headers pentru Superbet
 */
function fetchFromSuperbet(url, customHeaders = {}) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://www.superbet.ro/',
                'Origin': 'https://www.superbet.ro',
                ...customHeaders
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            // Handle compression
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
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: data
                    });
                });

                decompressor.on('error', (err) => {
                    reject(err);
                });
            } else {
                res.on('data', (chunk) => {
                    data += chunk.toString('utf8');
                });

                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: data
                    });
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
 * CANDIDAȚI pentru API endpoints Superbet:
 *
 * Bazat pe reverse engineering, posibile URL-uri:
 */
const POSSIBLE_ENDPOINTS = {
    // Sports API (probabil pentru lista de sporturi/meciuri)
    sports: 'https://superbet.ro/api/sports',
    sportsV2: 'https://api.superbet.ro/sports/v2',

    // Events API (meciuri)
    events: 'https://superbet.ro/api/events',
    eventsLive: 'https://superbet.ro/api/live/events',

    // Odds API (cote)
    odds: 'https://superbet.ro/api/odds',
    markets: 'https://superbet.ro/api/markets',

    // GraphQL (multe site-uri moderne folosesc GraphQL)
    graphql: 'https://superbet.ro/graphql',
    apiGraphql: 'https://api.superbet.ro/graphql',

    // BetBuilder sau alte API-uri specializate
    betbuilder: 'https://superbet.ro/api/betbuilder',

    // Feed-uri (similar cu FlashScore)
    feed: 'https://feed.superbet.ro/api/v1',
    feedV2: 'https://feed.superbet.ro/api/v2'
};

/**
 * Test endpoints pentru a vedea care răspund
 */
async function testEndpoints() {
    console.log(`\n🔍 TESTARE ENDPOINTS SUPERBET API\n`);
    console.log('='.repeat(60));

    for (const [name, url] of Object.entries(POSSIBLE_ENDPOINTS)) {
        try {
            console.log(`\nTestez: ${name}`);
            console.log(`URL: ${url}`);

            const result = await fetchFromSuperbet(url);

            console.log(`✅ Status: ${result.status}`);
            console.log(`   Content-Type: ${result.headers['content-type']}`);

            // Încearcă să parseze JSON
            try {
                const json = JSON.parse(result.data);
                console.log(`   ✅ Valid JSON`);
                console.log(`   Keys: ${Object.keys(json).join(', ')}`);

                if (result.data.length < 500) {
                    console.log(`   Preview:`, JSON.stringify(json, null, 2).substring(0, 300));
                }
            } catch {
                console.log(`   ⚠️  Nu e JSON`);
                if (result.data.length < 200) {
                    console.log(`   Preview: ${result.data.substring(0, 200)}`);
                }
            }

        } catch (error) {
            console.log(`❌ Eroare: ${error.message}`);
        }

        // Delay între requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n' + '='.repeat(60));
}

/**
 * Caută în pagina principală Superbet pentru API endpoints
 */
async function findAPIEndpointsInHTML() {
    console.log(`\n🔍 CĂUTARE API ENDPOINTS ÎN HTML\n`);
    console.log('='.repeat(60));

    try {
        console.log(`Descarcă pagina principală Superbet...`);

        const result = await fetchFromSuperbet('https://www.superbet.ro/fotbal');

        console.log(`✅ Pagină descărcată (${result.data.length} caractere)`);

        // Caută pattern-uri API în HTML/JS
        const apiPatterns = [
            /https:\/\/[a-z0-9.-]*superbet[a-z0-9.-]*\/[a-z0-9\/_-]*/gi,
            /api[a-z]*\.superbet\.ro/gi,
            /\/api\/[a-z0-9\/_-]*/gi,
            /"apiUrl":\s*"([^"]+)"/gi,
            /"baseUrl":\s*"([^"]+)"/gi,
            /fetch\(['"]([^'"]*api[^'"]*)['"]\)/gi
        ];

        const foundURLs = new Set();

        apiPatterns.forEach(pattern => {
            const matches = result.data.matchAll(pattern);
            for (const match of matches) {
                if (match[0] && match[0].includes('api')) {
                    foundURLs.add(match[0]);
                }
            }
        });

        if (foundURLs.size > 0) {
            console.log(`\n✅ Găsite ${foundURLs.size} URL-uri potențiale:\n`);
            Array.from(foundURLs).slice(0, 20).forEach(url => {
                console.log(`   - ${url}`);
            });
        } else {
            console.log(`\n⚠️  Nu s-au găsit URL-uri API în HTML`);
        }

    } catch (error) {
        console.error(`❌ Eroare: ${error.message}`);
    }

    console.log('\n' + '='.repeat(60));
}

/**
 * INSTRUCȚIUNI MANUAL pentru găsire API:
 */
function printManualInstructions() {
    console.log(`\n📖 INSTRUCȚIUNI MANUAL - Găsire API Superbet\n`);
    console.log('='.repeat(60));
    console.log(`
🔧 PAȘI pentru a găsi API-ul manual:

1. Deschide Chrome/Firefox
2. Accesează: https://www.superbet.ro/fotbal
3. Deschide DevTools (F12)
4. Du-te la tab-ul "Network"
5. Filtrează după: XHR sau Fetch
6. Caută un meci live (ex: Premier League)
7. Click pe meci să vezi cotele
8. Observă request-urile în Network:
   - Caută request-uri către /api/
   - Caută JSON responses cu cote
   - Notează URL-ul și headers-ele

9. Click dreapta pe request → Copy → Copy as cURL
10. Trimite-mi cURL command-ul sau:
    - URL-ul exact
    - Headers necesare (Authorization, etc.)

EXEMPLU ce căutăm:

Request URL: https://api.superbet.ro/sports/v2/events/12345/markets
Headers:
  Authorization: Bearer xyz123...
  X-Api-Key: abc456...

Response (JSON):
{
  "markets": [
    {
      "name": "Match Result",
      "odds": [
        { "outcome": "1", "price": 1.85 },
        { "outcome": "X", "price": 3.40 }
      ]
    }
  ]
}
    `);
    console.log('='.repeat(60));
}

// Export
module.exports = {
    fetchFromSuperbet,
    testEndpoints,
    findAPIEndpointsInHTML
};

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);

    (async () => {
        try {
            if (args[0] === 'test') {
                await testEndpoints();
            } else if (args[0] === 'html') {
                await findAPIEndpointsInHTML();
            } else if (args[0] === 'manual') {
                printManualInstructions();
            } else {
                console.log(`
📖 USAGE:

   node SUPERBET_API_RESEARCH.js test     # Testează endpoint-uri posibile
   node SUPERBET_API_RESEARCH.js html     # Caută API în HTML
   node SUPERBET_API_RESEARCH.js manual   # Instrucțiuni pentru reverse engineering manual

📝 RECOMANDAT:

   Începe cu: node SUPERBET_API_RESEARCH.js manual
   Apoi folosește DevTools pentru a găsi API-ul real
`);
            }

        } catch (error) {
            console.error(`\n❌ EROARE: ${error.message}\n`);
            process.exit(1);
        }
    })();
}
