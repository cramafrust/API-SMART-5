/**
 * 🔐 SUPERBET TOKEN EXTRACTOR
 *
 * Extrage token-urile de autentificare necesare pentru API Superbet
 *
 * METODĂ:
 * 1. Monitorizează request-urile reale ale browserului
 * 2. Extrage Authorization headers
 * 3. Găsește pattern-ul de generare token
 * 4. Implementează generarea în cod
 */

const https = require('https');

/**
 * Test API cu diverse token-uri/headers
 */
async function testAPIWithAuth(url, authHeaders = {}) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);

        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'ro-RO,ro;q=0.9',
                'Referer': 'https://www.superbet.ro/',
                'Origin': 'https://www.superbet.ro',
                ...authHeaders
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', chunk => data += chunk);

            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    data: data,
                    success: res.statusCode === 200
                });
            });
        });

        req.on('error', reject);
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });

        req.end();
    });
}

/**
 * Încearcă diverse combinații de headers
 */
async function bruteforceHeaders() {
    console.log(`\n🔐 TESTARE AUTENTIFICARE SUPERBET API\n`);
    console.log('='.repeat(60));

    const baseURL = 'https://api.web.production.betler.superbet.ro/api-gw';

    // Teste diverse headers
    const headerCombos = [
        // No auth
        {},

        // Guest/Anonymous token
        {
            'Authorization': 'Bearer anonymous',
            'X-Client-Id': 'web-app'
        },

        // Different client IDs
        {
            'X-Client-Id': 'superbet-web',
            'X-Country-Code': 'RO'
        },

        // API Key tests
        {
            'X-Api-Key': 'public',
            'X-Platform': 'web'
        },

        // Session tests
        {
            'X-Session-Id': 'guest',
            'X-Device-Type': 'desktop'
        }
    ];

    console.log(`\nTestez ${headerCombos.length} combinații de headers...\n`);

    for (let i = 0; i < headerCombos.length; i++) {
        const headers = headerCombos[i];

        console.log(`\n[${i + 1}/${headerCombos.length}] Headers:`, JSON.stringify(headers, null, 2));

        try {
            const result = await testAPIWithAuth(baseURL, headers);

            console.log(`   Status: ${result.status}`);

            if (result.status === 200) {
                console.log(`   ✅ SUCCESS! Token-uri găsite:`);
                console.log(JSON.stringify(headers, null, 2));
                return headers;
            } else if (result.status === 401) {
                console.log(`   ⚠️  Unauthorized`);
            } else if (result.status === 403) {
                console.log(`   ⚠️  Forbidden`);
            } else if (result.status === 404) {
                console.log(`   ⚠️  Not Found`);
            } else {
                console.log(`   ℹ️  Response preview:`, result.data.substring(0, 200));
            }

        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }

        await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`\n❌ Niciun token funcțional găsit\n`);
    console.log('='.repeat(60));

    return null;
}

/**
 * INSTRUCȚIUNI MANUAL pentru extragere token
 */
function printTokenExtractionGuide() {
    console.log(`\n📖 GHID EXTRAGERE TOKEN MANUAL\n`);
    console.log('='.repeat(60));
    console.log(`
🔧 PAȘI pentru a extrage token-ul de autentificare:

1. Deschide Chrome → https://www.superbet.ro/fotbal

2. F12 → Tab "Network"

3. Filtrează după: "api" sau "betler"

4. Caută un meci → Click pe meci să vezi cotele

5. În Network tab, caută request-uri către:
   - api.web.production.betler.superbet.ro
   - betting.prod.incubator.superbet.ro

6. Click pe unul din request-uri

7. În tab "Headers", caută:
   ✅ Authorization: Bearer eyJhbGc...
   ✅ X-Client-Id: ...
   ✅ X-Session-Id: ...
   ✅ X-Api-Key: ...

8. Copiază TOATE headers-ele și rulează:

   node SUPERBET_TOKEN_EXTRACTOR.js test \\
       --auth "Bearer TOK_TAU_AICI" \\
       --client-id "ID_TAU_AICI"

EXEMPLU ce căutăm:

Request Headers:
  authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  x-client-id: web-app-ro
  x-session-id: 1234567890
  x-country: RO

IMPORTANT:
- Token-ul poate expira (de obicei 1-24 ore)
- Poate fi diferit pentru fiecare utilizator
- Poate fi generat dinamic de JavaScript
    `);
    console.log('='.repeat(60));
}

// Export
module.exports = {
    testAPIWithAuth,
    bruteforceHeaders
};

// CLI
if (require.main === module) {
    const args = process.argv.slice(2);

    (async () => {
        if (args[0] === 'brute') {
            await bruteforceHeaders();

        } else if (args[0] === 'test' && args.length >= 3) {
            // Manual test cu token furnizat
            const authIndex = args.indexOf('--auth');
            const clientIndex = args.indexOf('--client-id');

            const headers = {};
            if (authIndex >= 0 && args[authIndex + 1]) {
                headers['Authorization'] = args[authIndex + 1];
            }
            if (clientIndex >= 0 && args[clientIndex + 1]) {
                headers['X-Client-Id'] = args[clientIndex + 1];
            }

            console.log(`\n🧪 Test cu token furnizat...\n`);
            console.log(`Headers:`, headers);

            const result = await testAPIWithAuth(
                'https://api.web.production.betler.superbet.ro/api-gw',
                headers
            );

            console.log(`\nRezultat:`);
            console.log(`Status: ${result.status}`);
            console.log(`Data:`, result.data.substring(0, 500));

        } else {
            printTokenExtractionGuide();
        }

    })().catch(console.error);
}
