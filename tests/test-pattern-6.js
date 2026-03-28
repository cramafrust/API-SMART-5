const PatternDescriptor = require('./PATTERN_DESCRIPTOR');

const descriptor = new PatternDescriptor();

console.log('\n🧪 TEST CATEGORIA 6 - CONTINUITATE CORNERE\n');

// Test pattern-uri categoria 6
const tests = [
    { id: 'PATTERN_6.3', team: 'Arsenal', prob: 75, stats: { cornerePauza: 3, suturiPePtPauza: 3 } },
    { id: 'PATTERN_6.5', team: 'Liverpool', prob: 80, stats: { cornerePauza: 2, suturiPePtPauza: 4 } },
    { id: 'PATTERN_6.7', team: 'Manchester City', prob: 85, stats: { cornerePauza: 4, suturiPePtPauza: 2 } },
    { id: 'PATTERN_6.8', team: 'Chelsea', prob: 78, stats: { cornerePauza: 4, suturiPePtPauza: 1 } }
];

tests.forEach(test => {
    console.log(`${test.id} (${test.prob}%):`);
    const message = descriptor.formatFullMessage(test.id, test.team, test.prob, test.stats);
    console.log(`   ${message}`);
    console.log('');
    
    const explicitMsg = descriptor.formatExplicitMessage(test.id, test.team, test.prob, test.stats);
    console.log(`   Mesaj explicit: ${explicitMsg}`);
    console.log('');
});

console.log('✅ Test finalizat!\n');
