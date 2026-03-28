const fs = require('fs');
const glob = require('glob');
const path = require('path');

const files = glob.sync('data/seasons/complete_FULL_SEASON_*.json')
  .filter(f => !f.includes('BACKUP') && !f.includes('ORIGINAL') && !f.includes('OLD_FORMAT'));

const seasonData = {};

files.forEach(file => {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const sezon = data.sezon || 'Unknown';
    const campionat = data.campionat || path.basename(file, '.json').substring(20, 50);
    const meciuri = (data.meciuri || []).length;

    if (!seasonData[sezon]) seasonData[sezon] = [];
    seasonData[sezon].push({ campionat, meciuri, file: path.basename(file) });
  } catch(e) {
    console.error(`Eroare: ${path.basename(file)} - ${e.message}`);
  }
});

console.log('\n📊 SEZOANE DISPONIBILE:\n');
console.log('='.repeat(80));

Object.keys(seasonData).sort().forEach(sezon => {
  const camps = seasonData[sezon];
  const totalMeciuri = camps.reduce((sum, c) => sum + c.meciuri, 0);

  console.log(`\n🏆 ${sezon} (${camps.length} campionate, ${totalMeciuri} meciuri):`);
  camps.slice(0, 10).forEach(c => {
    console.log(`   - ${c.campionat.substring(0, 40)}: ${c.meciuri} meciuri`);
  });
  if (camps.length > 10) {
    console.log(`   ... și încă ${camps.length - 10} campionate`);
  }
});

console.log('\n' + '='.repeat(80));
console.log(`\nTotal fișiere: ${files.length}`);
console.log(`Sezoane unice: ${Object.keys(seasonData).length}\n`);
