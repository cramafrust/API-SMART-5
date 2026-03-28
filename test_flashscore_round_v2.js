/**
 * TEST v2: Verifică SUMMARY și alte secțiuni pentru round/etapă
 */

const { fetchMatchDetails } = require('./flashscore-api');

async function test() {
    const matchId = 'AFilY12h'; // Premier League meci

    console.log(`🔍 Testare FlashScore API - TOATE secțiunile\n`);

    try {
        const data = await fetchMatchDetails(matchId);

        console.log('📦 Secțiuni disponibile:', Object.keys(data).join(', '));

        // Check SUMMARY data
        if (data.summary && data.summary.length > 0) {
            console.log('\n📋 SUMMARY DATA (primele 5 recorduri):');
            data.summary.slice(0, 5).forEach((record, idx) => {
                console.log(`\n[${idx}] Keys:`, Object.keys(record).join(', '));
                Object.entries(record).forEach(([key, value]) => {
                    const displayValue = typeof value === 'string' && value.length > 50
                        ? value.substring(0, 50) + '...'
                        : value;
                    console.log(`     ${key}: ${JSON.stringify(displayValue)}`);
                });
            });
        }

        // Check dacă există alt câmp
        console.log('\n🔍 Căutare în TOATE datele pentru "round", "Round", "stage", "etapa":');

        function searchForRound(obj, path = '') {
            if (!obj) return;

            if (typeof obj === 'object') {
                Object.entries(obj).forEach(([key, value]) => {
                    const fullPath = path ? `${path}.${key}` : key;

                    // Check key name
                    if (key.toLowerCase().includes('round') ||
                        key.toLowerCase().includes('stage') ||
                        key.toLowerCase().includes('etapa')) {
                        console.log(`   🎯 Găsit: ${fullPath} = ${JSON.stringify(value).substring(0, 100)}`);
                    }

                    // Check value (dacă e string)
                    if (typeof value === 'string' && (
                        value.includes('Round') ||
                        value.includes('round') ||
                        value.includes('Stage') ||
                        value.includes('Etapa')
                    )) {
                        console.log(`   🎯 Găsit în valoare: ${fullPath} = "${value}"`);
                    }

                    // Recursiv pentru obiecte/array-uri
                    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                        searchForRound(value, fullPath);
                    } else if (Array.isArray(value) && value.length > 0 && value.length < 20) {
                        value.forEach((item, idx) => {
                            if (typeof item === 'object') {
                                searchForRound(item, `${fullPath}[${idx}]`);
                            }
                        });
                    }
                });
            }
        }

        searchForRound(data);

        console.log('\n✅ Analiză completă!');

    } catch (error) {
        console.error('❌ Eroare:', error.message);
    }
}

test();
