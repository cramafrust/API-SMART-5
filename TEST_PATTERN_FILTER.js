/**
 * TEST - Filtrare pattern-uri duplicate
 *
 * Testează funcția de filtrare care păstrează doar pattern-ul
 * cu cea mai mare probabilitate din fiecare categorie
 */

/**
 * Filtrează pattern-uri: din fiecare categorie păstrează doar cel cu cea mai mare probabilitate
 */
function filterBestPatternsOnly(patterns) {
    if (patterns.length === 0) return patterns;

    console.log(`\n🔍 FILTRARE PATTERN-URI DUPLICATE\n`);
    console.log('='.repeat(60));
    console.log(`Pattern-uri înainte de filtrare: ${patterns.length}\n`);

    // Extrage categoria din numele pattern-ului (ex: "PATTERN_5.5" → "5")
    const getPatternCategory = (patternName) => {
        const match = patternName.match(/PATTERN_(\d+)/);
        return match ? match[1] : patternName;
    };

    // Grupează pattern-uri pe: categorie + echipă
    const groups = {};

    patterns.forEach(pattern => {
        const category = getPatternCategory(pattern.name);
        const team = pattern.team || 'meci';
        const groupKey = `${category}_${team}`;

        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }
        groups[groupKey].push(pattern);
    });

    // Pentru fiecare grup, păstrează doar pattern-ul cu probabilitatea maximă
    const filtered = [];

    Object.entries(groups).forEach(([groupKey, groupPatterns]) => {
        if (groupPatterns.length === 1) {
            // Doar un pattern în grup, îl păstrăm
            filtered.push(groupPatterns[0]);
            console.log(`✅ Categorie ${groupKey}: 1 pattern → păstrat ${groupPatterns[0].name} (${groupPatterns[0].probability}%)`);
        } else {
            // Multiple pattern-uri în grup, păstrăm doar cel cu probabilitatea maximă
            const best = groupPatterns.reduce((max, current) =>
                current.probability > max.probability ? current : max
            );

            console.log(`🔥 Categorie ${groupKey}: ${groupPatterns.length} pattern-uri → păstrat ${best.name} (${best.probability}%)`);

            // Log pattern-uri eliminate
            groupPatterns.forEach(p => {
                if (p.name !== best.name) {
                    console.log(`   ↳ ❌ Eliminat ${p.name} (${p.probability}%)`);
                }
            });

            filtered.push(best);
        }
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Pattern-uri după filtrare: ${filtered.length}\n`);

    return filtered;
}

// TEST CASE 1: Pattern-uri 5.x din aceeași categorie
console.log('\n📋 TEST CASE 1: Pattern-uri 5.x (suturi + cornere)\n');
console.log('Scenariu: Arsenal are 5 șuturi + 2 cornere = 7 total');
console.log('Pattern-uri detectate: 5.5, 5.6, 5.7 cu probabilități diferite\n');

const testPatterns1 = [
    { name: 'PATTERN_5.5', team: 'gazda', probability: 85 },
    { name: 'PATTERN_5.6', team: 'gazda', probability: 92 },
    { name: 'PATTERN_5.7', team: 'gazda', probability: 88 }
];

const filtered1 = filterBestPatternsOnly(testPatterns1);

console.log('\n📊 REZULTAT:');
filtered1.forEach(p => {
    console.log(`   ✅ ${p.name} (${p.team}): ${p.probability}%`);
});

// TEST CASE 2: Pattern-uri mixte (categorii diferite)
console.log('\n\n📋 TEST CASE 2: Pattern-uri din categorii diferite\n');
console.log('Scenariu: Meci cu multiple pattern-uri active\n');

const testPatterns2 = [
    // Categoria 1 - gazda
    { name: 'PATTERN_1.0', team: 'gazda', probability: 72 },
    { name: 'PATTERN_1.1', team: 'gazda', probability: 75 },
    { name: 'PATTERN_1.2', team: 'gazda', probability: 78 },
    // Categoria 5 - gazda
    { name: 'PATTERN_5.5', team: 'gazda', probability: 85 },
    { name: 'PATTERN_5.6', team: 'gazda', probability: 92 },
    // Categoria 1 - oaspete
    { name: 'PATTERN_1.0', team: 'oaspete', probability: 70 },
    { name: 'PATTERN_1.1', team: 'oaspete', probability: 73 },
    // Categoria 6 - oaspete
    { name: 'PATTERN_6.3', team: 'oaspete', probability: 80 }
];

const filtered2 = filterBestPatternsOnly(testPatterns2);

console.log('\n📊 REZULTAT:');
filtered2.forEach(p => {
    console.log(`   ✅ ${p.name} (${p.team}): ${p.probability}%`);
});

// TEST CASE 3: Pattern-uri pe ambele echipe + meci
console.log('\n\n📋 TEST CASE 3: Pattern-uri complexe (gazda + oaspete + meci)\n');
console.log('Scenariu: Ambele echipe cu pattern-uri active + pattern meci\n');

const testPatterns3 = [
    // Gazda - categoria 5
    { name: 'PATTERN_5.5', team: 'gazda', probability: 85 },
    { name: 'PATTERN_5.6', team: 'gazda', probability: 88 },
    { name: 'PATTERN_5.7', team: 'gazda', probability: 90 },
    // Oaspete - categoria 5
    { name: 'PATTERN_5.5', team: 'oaspete', probability: 82 },
    { name: 'PATTERN_5.6', team: 'oaspete', probability: 86 },
    // Meci - categoria 3
    { name: 'PATTERN_3.3', team: 'meci', probability: 75 },
    { name: 'PATTERN_3.4', team: 'meci', probability: 78 }
];

const filtered3 = filterBestPatternsOnly(testPatterns3);

console.log('\n📊 REZULTAT:');
filtered3.forEach(p => {
    console.log(`   ✅ ${p.name} (${p.team}): ${p.probability}%`);
});

console.log('\n\n' + '='.repeat(60));
console.log('✅ TESTE COMPLETE\n');
console.log('Concluzie: Din fiecare categorie (ex: 5) + echipă (ex: gazda)');
console.log('           se păstrează DOAR pattern-ul cu probabilitatea maximă');
console.log('='.repeat(60) + '\n');
