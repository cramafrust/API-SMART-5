const fs = require('fs');
const data = JSON.parse(fs.readFileSync('notifications_tracking.json', 'utf8'));

console.log('📊 RAPORT COMPLET NOTIFICĂRI - API SMART 5');
console.log('='.repeat(80));
console.log('');

let stats = {
  total: data.notifications.length,
  completed: 0,
  failed: 0,
  monitoring: 0,
  withOdd150: 0,
  withOdd200: 0,
  fulfilled: 0
};

console.log('📋 LISTA COMPLETĂ NOTIFICĂRI:\n');

data.notifications.forEach((n, idx) => {
  console.log(`${idx + 1}. ${n.match}`);
  console.log(`   Pattern: ${n.pattern.name} | Team: ${n.pattern.team}`);
  console.log(`   Cotă inițială: ${n.initial_odd || 'N/A'} | Probabilitate: ${n.probability}%`);
  console.log(`   ⚡ Cota 1.50: ${n.minute_odd_1_50 !== null ? 'min ' + n.minute_odd_1_50 : '❌'} | 🚀 Cota 2.00: ${n.minute_odd_2_00 !== null ? 'min ' + n.minute_odd_2_00 : '❌'}`);
  console.log(`   ✅ Îndeplinit: ${n.minute_fulfilled !== null && n.minute_fulfilled !== 'NU' ? 'min ' + n.minute_fulfilled : '❌'}`);
  console.log(`   📊 Status: ${n.status}`);
  console.log('');

  // Statistici
  if (n.status === 'COMPLETED') stats.completed++;
  if (n.status === 'FAILED') stats.failed++;
  if (n.status === 'MONITORING') stats.monitoring++;
  if (n.minute_odd_1_50 !== null) stats.withOdd150++;
  if (n.minute_odd_2_00 !== null) stats.withOdd200++;
  if (n.minute_fulfilled !== null && n.minute_fulfilled !== 'NU') stats.fulfilled++;
});

console.log('='.repeat(80));
console.log('📈 STATISTICI GENERALE:\n');
console.log(`Total notificări: ${stats.total}`);
console.log(`Completate: ${stats.completed} (${(stats.completed/stats.total*100).toFixed(1)}%)`);
console.log(`Eșuate: ${stats.failed} (${(stats.failed/stats.total*100).toFixed(1)}%)`);
console.log(`În monitorizare: ${stats.monitoring} (${(stats.monitoring/stats.total*100).toFixed(1)}%)`);
console.log('');
console.log(`⚡ Au atins cota 1.50: ${stats.withOdd150} (${(stats.withOdd150/stats.total*100).toFixed(1)}%)`);
console.log(`🚀 Au atins cota 2.00: ${stats.withOdd200} (${(stats.withOdd200/stats.total*100).toFixed(1)}%)`);
console.log('');
console.log(`✅ Pronosticuri îndeplinite: ${stats.fulfilled}/${stats.total} (${(stats.fulfilled/stats.total*100).toFixed(1)}%)`);
console.log(`❌ Pronosticuri eșuate: ${stats.failed}/${stats.total} (${(stats.failed/stats.total*100).toFixed(1)}%)`);

// Rata de succes (doar pentru meciuri finalizate)
const finalized = stats.completed + stats.failed;
if (finalized > 0) {
  console.log(`\n🎯 RATĂ SUCCES (meciuri finalizate): ${stats.fulfilled}/${finalized} = ${(stats.fulfilled/finalized*100).toFixed(1)}%`);
}

console.log('='.repeat(80));
