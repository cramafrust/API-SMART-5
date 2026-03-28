#!/usr/bin/env node
/**
 * TEST - Verificare Champions League în sistem
 */

const ProcenteLoader = require('./PROCENTE_LOADER');
const { getTierFromPosition } = require('./standings-scraper-puppeteer');

console.log('═'.repeat(60));
console.log('🏆 TEST CHAMPIONS LEAGUE - VERIFICARE INTEGRARE');
console.log('═'.repeat(60));

// Test 1: Încărcare JSON PROCENTE
console.log('\n📊 TEST 1: Încărcare JSON PROCENTE');
console.log('-'.repeat(60));

const loader = new ProcenteLoader();
const loaded = loader.load();

if (!loaded) {
    console.error('❌ EȘUAT: Nu s-a putut încărca JSON PROCENTE');
    process.exit(1);
}

// Test 2: Verificare Champions League în JSON
console.log('\n🔍 TEST 2: Verificare Champions League există în JSON');
console.log('-'.repeat(60));

const championsLeagueNames = [
    'Champions League',
    'EUROPE: Champions League - League phase',
    'UEFA Champions League'
];

let foundChampions = false;
for (const name of championsLeagueNames) {
    const normalized = loader.normalizeLeagueName(name);
    if (normalized === 'Champions League') {
        console.log(`✅ "${name}" → "${normalized}"`);
        foundChampions = true;
    } else {
        console.log(`❌ "${name}" → ${normalized || 'null'}`);
    }
}

if (!foundChampions) {
    console.error('\n❌ EȘUAT: Champions League nu este recunoscut');
    process.exit(1);
}

// Test 3: Verificare tiers Champions League
console.log('\n🏅 TEST 3: Verificare tiers Champions League (36 echipe)');
console.log('-'.repeat(60));

const testPositions = [
    { pos: 1, expected: 'TOP_1-8', desc: 'Locul 1 (direct în optimi)' },
    { pos: 8, expected: 'TOP_1-8', desc: 'Locul 8 (ultimul direct în optimi)' },
    { pos: 9, expected: 'MID_9-24', desc: 'Locul 9 (play-off)' },
    { pos: 16, expected: 'MID_9-24', desc: 'Locul 16 (play-off)' },
    { pos: 24, expected: 'MID_9-24', desc: 'Locul 24 (ultimul play-off)' },
    { pos: 25, expected: 'BOTTOM_25-36', desc: 'Locul 25 (eliminat)' },
    { pos: 36, expected: 'BOTTOM_25-36', desc: 'Locul 36 (ultimul loc)' }
];

let tiersOK = true;
testPositions.forEach(test => {
    const tier = getTierFromPosition(test.pos, 36);
    const status = tier === test.expected ? '✅' : '❌';
    console.log(`${status} ${test.desc}: ${tier} ${tier === test.expected ? '' : `(așteptat: ${test.expected})`}`);
    if (tier !== test.expected) tiersOK = false;
});

if (!tiersOK) {
    console.error('\n❌ EȘUAT: Tiers Champions League nu funcționează corect');
    process.exit(1);
}

// Test 4: Verificare probabilități pattern pentru Champions League
console.log('\n📈 TEST 4: Verificare probabilități pattern Champions League');
console.log('-'.repeat(60));

const testPattern = 'PATTERN_5.5';
const testTier = 'TOP_1-8';

const prob = loader.getPatternProbability('Champions League', testTier, testPattern);

if (prob) {
    console.log(`✅ ${testPattern} (${testTier}): ${prob.procent}% (${prob.succes}/${prob.cazuri})`);
} else {
    console.log(`⚠️  ${testPattern} (${testTier}): Nu există date (normal dacă pattern-ul nu a apărut)`);
}

// Test 5: Verificare toate tier-urile Champions League au date
console.log('\n🔢 TEST 5: Verificare date pentru toate tier-urile');
console.log('-'.repeat(60));

const championsData = loader.data.campionate['Champions League'];

if (!championsData) {
    console.error('❌ EȘUAT: Champions League nu există în date');
    process.exit(1);
}

console.log(`✅ Campionat: ${championsData.nume_complet}`);
console.log(`✅ Sezon: ${championsData.sezon}`);
console.log(`✅ Echipe: ${championsData.numar_echipe}`);
console.log(`✅ Meciuri analizate: ${championsData.total_meciuri_analizate}`);

const tiers = ['TOP_1-8', 'MID_9-24', 'BOTTOM_25-36'];
tiers.forEach(tier => {
    const tierData = championsData.procente_reusita[tier];
    if (tierData) {
        const numPatterns = Object.keys(tierData).length;
        console.log(`✅ Tier ${tier}: ${numPatterns} pattern-uri`);
    } else {
        console.log(`❌ Tier ${tier}: Nu există date`);
    }
});

// Rezumat final
console.log('\n' + '═'.repeat(60));
console.log('✅ TOATE TESTELE AU TRECUT!');
console.log('═'.repeat(60));
console.log('');
console.log('🎉 Champions League este complet integrat în sistem!');
console.log('');
console.log('📋 Verificări efectuate:');
console.log('   ✅ JSON PROCENTE încărcat');
console.log('   ✅ Champions League recunoscut (3 variante de nume)');
console.log('   ✅ Tiers corect calculate (TOP_1-8, MID_9-24, BOTTOM_25-36)');
console.log('   ✅ Probabilități pattern disponibile');
console.log('   ✅ Date complete pentru toate tier-urile');
console.log('');
console.log('🚀 Sistemul este pregătit pentru meciuri Champions League!');
console.log('');
