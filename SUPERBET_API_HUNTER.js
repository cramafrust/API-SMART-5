/**
 * 🎯 SUPERBET API HUNTER
 *
 * Script automat pentru găsirea API-ului Superbet prin reverse engineering
 *
 * STRATEGII:
 * 1. Descarcă pagina Superbet și extrage toate script-urile
 * 2. Analizează JavaScript pentru găsire URL-uri API
 * 3. Extrage configuration objects (apiUrl, baseUrl, etc.)
 * 4. Testează endpoint-uri găsite
 * 5. Urmărește redirect-uri și răspunsuri
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Fetch cu follow redirects și detalii complete
 */
function fetchWithDetails(url, options = {}) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        const requestOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'ro-RO,ro;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://www.superbet.ro/',
                'Origin': 'https://www.superbet.ro',
                ...options.headers
            }
        };

        const req = protocol.request(requestOptions, (res) => {
            // Handle redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                console.log(`   → Redirect to: ${res.headers.location}`);

                const redirectUrl = res.headers.location.startsWith('http')
                    ? res.headers.location
                    : new URL(res.headers.location, url).href;

                return fetchWithDetails(redirectUrl, options).then(resolve).catch(reject);
            }

            let data = Buffer.alloc(0);

            // Handle compression
            let stream = res;
            if (res.headers['content-encoding'] === 'gzip' ||
                res.headers['content-encoding'] === 'br' ||
                res.headers['content-encoding'] === 'deflate') {
                const zlib = require('zlib');

                if (res.headers['content-encoding'] === 'gzip') {
                    stream = res.pipe(zlib.createGunzip());
                } else if (res.headers['content-encoding'] === 'br') {
                    stream = res.pipe(zlib.createBrotliDecompress());
                } else {
                    stream = res.pipe(zlib.createInflate());
                }
            }

            stream.on('data', (chunk) => {
                data = Buffer.concat([data, chunk]);
            });

            stream.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    data: data.toString('utf8'),
                    url: url
                });
            });

            stream.on('error', reject);
        });

        req.on('error', reject);
        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error('Timeout'));
        });

        req.end();
    });
}

/**
 * Extrage toate script-urile din HTML
 */
function extractScripts(html) {
    const scripts = [];

    // Inline scripts
    const inlineRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = inlineRegex.exec(html)) !== null) {
        if (match[1] && match[1].trim().length > 50) {
            scripts.push({
                type: 'inline',
                content: match[1]
            });
        }
    }

    // External scripts
    const externalRegex = /<script[^>]*src=["']([^"']+)["'][^>]*>/gi;

    while ((match = externalRegex.exec(html)) !== null) {
        scripts.push({
            type: 'external',
            src: match[1]
        });
    }

    return scripts;
}

/**
 * Caută API URLs în JavaScript code
 */
function findAPIUrlsInJS(jsCode) {
    const urls = new Set();

    // Pattern-uri pentru URL-uri API
    const patterns = [
        // String literals cu "api" în ele
        /['"`](https?:\/\/[^'"`]*api[^'"`]*?)['"`]/gi,

        // baseURL, apiUrl, endpoint, etc.
        /(?:baseURL|apiUrl|apiEndpoint|endpoint|apiBase|baseUrl):\s*['"`]([^'"`]+)['"`]/gi,

        // fetch() calls
        /fetch\s*\(\s*['"`]([^'"`]*api[^'"`]*?)['"`]/gi,

        // axios calls
        /axios\s*\.\s*\w+\s*\(\s*['"`]([^'"`]*api[^'"`]*?)['"`]/gi,

        // URL concatenations
        /['"`](\/api\/[^'"`]+?)['"`]/gi,

        // Domain-uri Superbet
        /['"`](https?:\/\/[^'"`]*superbet[^'"`]*?)['"`]/gi
    ];

    patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(jsCode)) !== null) {
            if (match[1]) {
                const url = match[1].trim();
                if (url.length > 5 && !url.includes('{{') && !url.includes('${')) {
                    urls.add(url);
                }
            }
        }
    });

    return Array.from(urls);
}

/**
 * Analizează un script extern
 */
async function analyzeExternalScript(scriptUrl, baseUrl) {
    try {
        const fullUrl = scriptUrl.startsWith('http')
            ? scriptUrl
            : new URL(scriptUrl, baseUrl).href;

        console.log(`\n   📥 Analizez script: ${scriptUrl.substring(0, 80)}...`);

        const result = await fetchWithDetails(fullUrl);

        if (result.status === 200) {
            const urls = findAPIUrlsInJS(result.data);

            if (urls.length > 0) {
                console.log(`   ✅ Găsite ${urls.length} URL-uri potențiale`);
                return urls;
            }
        }

        return [];

    } catch (error) {
        console.log(`   ⚠️  Eroare: ${error.message}`);
        return [];
    }
}

/**
 * Testează un endpoint pentru a vedea dacă returnează JSON cu cote
 */
async function testEndpoint(url) {
    try {
        const result = await fetchWithDetails(url, {
            headers: {
                'Accept': 'application/json'
            }
        });

        const isJSON = result.headers['content-type']?.includes('application/json');

        let parsedData = null;
        if (isJSON) {
            try {
                parsedData = JSON.parse(result.data);
            } catch {}
        }

        return {
            url: url,
            status: result.status,
            isJSON: isJSON,
            hasOdds: parsedData && (
                JSON.stringify(parsedData).includes('odd') ||
                JSON.stringify(parsedData).includes('price') ||
                JSON.stringify(parsedData).includes('market')
            ),
            data: parsedData,
            size: result.data.length
        };

    } catch (error) {
        return {
            url: url,
            status: 'error',
            error: error.message
        };
    }
}

/**
 * HUNTER PRINCIPAL
 */
async function huntSuperbetAPI() {
    console.log(`\n🎯 SUPERBET API HUNTER - START\n`);
    console.log('='.repeat(70));

    const foundAPIs = [];

    // FAZA 1: Descarcă pagina principală
    console.log(`\n📥 FAZA 1: Descărcare pagina Superbet...\n`);

    let mainPage;
    try {
        mainPage = await fetchWithDetails('https://www.superbet.ro/fotbal');
        console.log(`✅ Pagină descărcată (${mainPage.data.length} caractere)`);
    } catch (error) {
        console.error(`❌ Nu pot accesa Superbet.ro: ${error.message}`);
        return;
    }

    // FAZA 2: Extrage scripts
    console.log(`\n📜 FAZA 2: Extragere scripts...\n`);

    const scripts = extractScripts(mainPage.data);
    console.log(`✅ Găsite ${scripts.length} script-uri (${scripts.filter(s => s.type === 'inline').length} inline, ${scripts.filter(s => s.type === 'external').length} externe)`);

    // FAZA 3: Analizează inline scripts
    console.log(`\n🔍 FAZA 3: Analizare inline scripts...\n`);

    const inlineURLs = new Set();
    scripts.filter(s => s.type === 'inline').forEach(script => {
        const urls = findAPIUrlsInJS(script.content);
        urls.forEach(url => inlineURLs.add(url));
    });

    console.log(`✅ Găsite ${inlineURLs.size} URL-uri în inline scripts`);

    if (inlineURLs.size > 0) {
        console.log(`\n📋 URL-uri găsite în inline scripts:`);
        Array.from(inlineURLs).slice(0, 15).forEach(url => {
            console.log(`   - ${url}`);
        });
    }

    // FAZA 4: Analizează external scripts (primele 10)
    console.log(`\n🔍 FAZA 4: Analizare external scripts...\n`);

    const externalURLs = new Set();
    const externalScripts = scripts.filter(s => s.type === 'external').slice(0, 10);

    for (const script of externalScripts) {
        const urls = await analyzeExternalScript(script.src, 'https://www.superbet.ro');
        urls.forEach(url => externalURLs.add(url));

        // Delay între requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n✅ Găsite ${externalURLs.size} URL-uri în external scripts`);

    // Combină toate URL-urile
    const allURLs = new Set([...inlineURLs, ...externalURLs]);

    // FAZA 5: Filtrare și prioritizare URL-uri
    console.log(`\n🎯 FAZA 5: Filtrare URL-uri candidate...\n`);

    const candidates = Array.from(allURLs).filter(url => {
        // Filtrează URL-uri relevante pentru API
        return (
            (url.includes('api') || url.includes('sports') || url.includes('events') || url.includes('odds')) &&
            !url.includes('.js') &&
            !url.includes('.css') &&
            !url.includes('.png') &&
            !url.includes('.jpg') &&
            !url.includes('google') &&
            !url.includes('facebook')
        );
    });

    console.log(`✅ ${candidates.length} URL-uri candidate pentru testare`);

    if (candidates.length > 0) {
        console.log(`\n📋 Top candidate URLs:`);
        candidates.slice(0, 20).forEach((url, i) => {
            console.log(`   ${i + 1}. ${url}`);
        });
    }

    // FAZA 6: Testare endpoint-uri candidate
    console.log(`\n🧪 FAZA 6: Testare endpoint-uri (top 15)...\n`);

    const testPromises = candidates.slice(0, 15).map(async (url) => {
        console.log(`\n   Testing: ${url}`);
        const result = await testEndpoint(url);

        if (result.status === 200 && result.isJSON) {
            console.log(`   ✅ Status: ${result.status} | JSON: Da | Odds: ${result.hasOdds ? 'DA!' : 'Nu'}`);

            if (result.hasOdds) {
                foundAPIs.push(result);
            }
        } else {
            console.log(`   ⚠️  Status: ${result.status} | JSON: ${result.isJSON ? 'Da' : 'Nu'}`);
        }

        await new Promise(resolve => setTimeout(resolve, 800));
        return result;
    });

    await Promise.all(testPromises);

    // REZULTATE FINALE
    console.log(`\n\n` + '='.repeat(70));
    console.log(`\n🎯 REZULTATE FINALE:\n`);

    if (foundAPIs.length > 0) {
        console.log(`✅ GĂSITE ${foundAPIs.length} API-uri cu cote!\n`);

        foundAPIs.forEach((api, i) => {
            console.log(`\n${i + 1}. ${api.url}`);
            console.log(`   Status: ${api.status}`);
            console.log(`   Mărime răspuns: ${api.size} bytes`);
            console.log(`   Preview data:`);
            console.log(`   ${JSON.stringify(api.data, null, 2).substring(0, 500)}...`);
        });

    } else if (candidates.length > 0) {
        console.log(`⚠️  Nu am găsit API-uri cu cote, dar am găsit ${candidates.length} URL-uri candidate\n`);
        console.log(`📝 Recomandare: Rulează manual în browser cu DevTools\n`);
        console.log(`Candidați cei mai promițători:\n`);
        candidates.slice(0, 10).forEach((url, i) => {
            console.log(`   ${i + 1}. ${url}`);
        });

    } else {
        console.log(`❌ Nu am găsit URL-uri API în JavaScript-ul paginii\n`);
        console.log(`📝 NEXT STEP: Trebuie investigație manuală în DevTools\n`);
    }

    console.log('\n' + '='.repeat(70));
}

// Export
module.exports = {
    huntSuperbetAPI,
    fetchWithDetails,
    testEndpoint
};

// CLI usage
if (require.main === module) {
    (async () => {
        try {
            await huntSuperbetAPI();

        } catch (error) {
            console.error(`\n❌ EROARE CRITICĂ: ${error.message}\n`);
            console.error(error.stack);
            process.exit(1);
        }
    })();
}
