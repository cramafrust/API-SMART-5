/**
 * TEST - Verificare corecție Pattern 5.x
 *
 * Demonstrează diferența între descrierea veche și cea nouă
 */

const PatternDescriptor = require('./PATTERN_DESCRIPTOR');

const descriptor = new PatternDescriptor();

console.log('\n🧪 TEST CORECȚIE PATTERN 5.x\n');
console.log('='.repeat(70));

// Scenariu real: Arsenal are 4 șuturi pe poartă + 3 cornere = 7 TOTAL
const stats = {
    suturiPePtPauza: 4,
    cornerePauza: 3
};

const team = 'Arsenal';
const probability = 88;

console.log('\n📊 STATISTICI REALE:');
console.log(`   Șuturi pe poartă: ${stats.suturiPePtPauza}`);
console.log(`   Cornere: ${stats.cornerePauza}`);
console.log(`   TOTAL: ${stats.suturiPePtPauza + stats.cornerePauza}`);

console.log('\n' + '='.repeat(70));
console.log('\n❌ DESCRIERE VECHE (CONFUZĂ):');
console.log('   "Arsenal a avut 4 șuturi pe poartă și 3 cornere la pauză"');
console.log('   → NU E CLAR că se verifică SUMA de 7!');

console.log('\n✅ DESCRIERE NOUĂ (CORECTĂ):');
const desc = descriptor.getDescription('PATTERN_5.7', team, stats);
console.log(`   "${desc.description}"`);
console.log(`   → CLAR: TOTAL 7 ACȚIUNI OFENSIVE!`);

console.log('\n' + '='.repeat(70));
console.log('\n📧 MESAJ EMAIL EXPLICIT:\n');

const explicitMessage = descriptor.formatExplicitMessage('PATTERN_5.7', team, probability, stats);
console.log(explicitMessage);

console.log('\n' + '='.repeat(70));
console.log('\n🎯 COMPARAȚIE PATTERN-URI 5.x:\n');

const patterns = [
    { id: 'PATTERN_5.5', shots: 3, corners: 2, total: 5 },
    { id: 'PATTERN_5.6', shots: 4, corners: 2, total: 6 },
    { id: 'PATTERN_5.7', shots: 4, corners: 3, total: 7 },
    { id: 'PATTERN_5.8', shots: 5, corners: 3, total: 8 }
];

patterns.forEach(p => {
    const testStats = {
        suturiPePtPauza: p.shots,
        cornerePauza: p.corners
    };

    const desc = descriptor.getDescription(p.id, team, testStats);
    console.log(`\n${p.id}:`);
    console.log(`   ${desc.description}`);
});

console.log('\n' + '='.repeat(70));
console.log('\n✅ TEST COMPLET!\n');
