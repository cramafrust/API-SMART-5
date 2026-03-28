const { generateDailyReport } = require('./DAILY_REPORT_GENERATOR');

const { html, stats, matches } = generateDailyReport('2026-01-29');

console.log('\n✅ VERIFICARE CORECTARE:\n');
console.log('Matches găsite:', matches.length);
matches.forEach((m, i) => {
    console.log(`${i+1}. DATA: "${m.date}" | ${m.homeTeam} vs ${m.awayTeam}`);
});
