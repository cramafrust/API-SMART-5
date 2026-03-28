const fs = require('fs');
const data = JSON.parse(fs.readFileSync('notifications-tracking.json', 'utf8'));
const notifs = data.notifications || [];

// Găsește un exemplu de notificare 'necunoscută'
let foundUnknown = false;
for (const n of notifs) {
  const patterns = n.patterns || [];
  for (const p of patterns) {
    if (n.validationDetails && n.validationDetails.patterns) {
      const vp = n.validationDetails.patterns.find(vp =>
        vp.pattern === p.patternName && vp.team === p.teamName
      );

      if (vp && vp.success !== true && vp.success !== false) {
        console.log('📋 EXEMPLU NOTIFICARE NECUNOSCUTĂ:');
        console.log('');
        console.log('Meci:', n.match.homeTeam, 'vs', n.match.awayTeam);
        console.log('Pattern:', p.patternName);
        console.log('Team:', p.teamName);
        console.log('Scor HT:', n.match.htScore);
        console.log('Scor FT:', n.validationDetails?.finalScore || 'N/A');
        console.log('');
        console.log('Validation result:');
        console.log('  success:', vp.success);
        console.log('  reason:', vp.reason);
        console.log('');
        console.log('Full validation details:');
        console.log(JSON.stringify(vp, null, 2));
        foundUnknown = true;
        break;
      }
    }
  }
  if (foundUnknown) break;
}

if (!foundUnknown) {
  console.log('Nu am găsit nicio notificare necunoscută în primele verificări');
}
