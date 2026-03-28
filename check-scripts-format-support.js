#!/usr/bin/env node
const fs = require('fs');

// Lista scripturilor care citesc JSON-uri de campionate
const scripts = [
  'CHAMPIONSHIP_JSON_MANAGER.js',
  'EXTRACT_MISSING_MATCHES.js',
  'FIX_MISSING_AND_INCOMPLETE.js',
  'CONVERT_AND_MOVE_CHAMPIONS.js',
  'DAILY_FINAL_DATA_COLLECTOR.js',
  'API-SMART-5.js',
  'PROCENTE_LOADER.js'
];

console.log('\n📊 VERIFICARE SUPORT FORMAT API SMART 5\n');
console.log('='.repeat(70));

let allGood = true;

scripts.forEach(script => {
  if (!fs.existsSync(script)) {
    console.log('\n⚠️  ' + script + ' - NU EXISTĂ');
    return;
  }

  const content = fs.readFileSync(script, 'utf8');

  // Verifică dacă folosește data.meciuri (format nou)
  const usesNewFormat = content.includes('data.meciuri') || content.includes('championshipData.meciuri');

  // Verifică dacă folosește saveMatchData (prin CHAMPIONSHIP_JSON_MANAGER)
  const usesSaveMatchData = content.includes('saveMatchData') || content.includes('CHAMPIONSHIP_JSON_MANAGER');

  // Verifică dacă are logică buggy de conversie automată
  const hasAutoConversion = content.includes('convertToAPISMART4Format') ||
                           (content.includes('Array.isArray') && content.includes('convertesc'));

  console.log('\n📄 ' + script);

  if (script === 'PROCENTE_LOADER.js') {
    console.log('   ℹ️  JSON PROCENTE (format diferit, OK)');
  } else if (script === 'API-SMART-5.js') {
    if (usesSaveMatchData) {
      console.log('   ✅ Folosește CHAMPIONSHIP_JSON_MANAGER (OK)');
    } else {
      console.log('   ⚠️  NU folosește CHAMPIONSHIP_JSON_MANAGER');
      allGood = false;
    }
  } else if (usesNewFormat || usesSaveMatchData) {
    console.log('   ✅ Suportă format API SMART 5');
  } else {
    console.log('   ❌ NU pare să folosească formatul nou!');
    allGood = false;
  }

  if (hasAutoConversion) {
    console.log('   ⚠️  ATENȚIE: Are logică buggy de conversie automată!');
    allGood = false;
  }
});

console.log('\n' + '='.repeat(70));

if (allGood) {
  console.log('\n✅ TOATE SCRIPTURILE SUNT OK - Suport complet format API SMART 5!\n');
} else {
  console.log('\n⚠️  ATENȚIE: Unele scripturi pot avea probleme!\n');
}
