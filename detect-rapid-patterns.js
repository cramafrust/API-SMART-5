const fs = require("fs");

const statsFile = "stats-zZSLsJYI-HT.json";
const data = JSON.parse(fs.readFileSync(statsFile, "utf8"));

console.log("🔍 Rapid București vs U. Cluj - Analiza HT");
console.log("=" + "=".repeat(60) + "\n");

// Extrage statistici relevante
const stats = data.statsData;

// Găsește stats pentru 1st Half
let homeShots = 0, awayShots = 0;
let homeShotsOnTarget = 0, awayShotsOnTarget = 0;
let homeCorners = 0, awayCorners = 0;
let homeGoals = 0, awayGoals = 0;

let inFirstHalf = false;

stats.forEach(stat => {
    // Marchează când intrăm în secțiunea 1st Half
    if (stat.SE === "1st Half") {
        inFirstHalf = true;
        return;
    }

    // Ieșim când ajungem la 2nd Half
    if (stat.SE === "2nd Half") {
        inFirstHalf = false;
        return;
    }

    // Extragem stats doar din 1st Half
    if (inFirstHalf) {
        if (stat.SG === "Total shots") {
            homeShots = parseInt(stat.SH) || 0;
            awayShots = parseInt(stat.SI) || 0;
        }
        if (stat.SG === "Shots on target") {
            homeShotsOnTarget = parseInt(stat.SH) || 0;
            awayShotsOnTarget = parseInt(stat.SI) || 0;
        }
        if (stat.SG === "Corner kicks") {
            homeCorners = parseInt(stat.SH) || 0;
            awayCorners = parseInt(stat.SI) || 0;
        }
    }
});

// Din summary
data.summary.forEach(item => {
    if (item.AC === "1st Half") {
        homeGoals = parseInt(item.IG) || 0;
        awayGoals = parseInt(item.IH) || 0;
    }
});

console.log("📊 STATISTICI LA PAUZĂ:\n");
console.log(`Rapid București (gazda):`);
console.log(`  - Total suturi: ${homeShots}`);
console.log(`  - Suturi pe poartă: ${homeShotsOnTarget}`);
console.log(`  - Cornere: ${homeCorners}`);
console.log(`  - Goluri: ${homeGoals}\n`);

console.log(`U. Cluj (oaspete):`);
console.log(`  - Total suturi: ${awayShots}`);
console.log(`  - Suturi pe poartă: ${awayShotsOnTarget}`);
console.log(`  - Cornere: ${awayCorners}`);
console.log(`  - Goluri: ${awayGoals}\n`);

console.log("=" + "=".repeat(60));
console.log("🎯 DETECTARE PATTERN-URI:\n");

const patterns = [];

// PATTERN 1.x - Șuturi pe poartă fără gol (GAZDA)
if (homeGoals === 0) {
    if (homeShotsOnTarget >= 3) patterns.push(`PATTERN_1.${homeShotsOnTarget - 3} (Gazda)`);
}

// PATTERN 1.x - Șuturi pe poartă fără gol (OASPETE)
if (awayGoals === 0) {
    if (awayShotsOnTarget >= 3) patterns.push(`PATTERN_1.${awayShotsOnTarget - 3} (Oaspete)`);
}

// PATTERN 2.x - Total suturi fără gol (GAZDA)
if (homeGoals === 0) {
    if (homeShots >= 6) patterns.push(`PATTERN_2.${homeShots - 5} (Gazda)`);
}

// PATTERN 2.x - Total suturi fără gol (OASPETE)
if (awayGoals === 0) {
    if (awayShots >= 6) patterns.push(`PATTERN_2.${awayShots - 5} (Oaspete)`);
}

// PATTERN 4.x - Cornere fără gol (GAZDA)
if (homeGoals === 0) {
    if (homeCorners >= 5) patterns.push(`PATTERN_4.${homeCorners} (Gazda)`);
}

// PATTERN 4.x - Cornere fără gol (OASPETE)
if (awayGoals === 0) {
    if (awayCorners >= 5) patterns.push(`PATTERN_4.${awayCorners} (Oaspete)`);
}

// PATTERN 5.x - Combinație șuturi pe poartă + cornere (GAZDA)
if (homeGoals === 0) {
    const homeCombo = homeShotsOnTarget + homeCorners;
    if (homeCombo >= 5) patterns.push(`PATTERN_5.${homeCombo} (Gazda)`);
}

// PATTERN 5.x - Combinație șuturi pe poartă + cornere (OASPETE)
if (awayGoals === 0) {
    const awayCombo = awayShotsOnTarget + awayCorners;
    if (awayCombo >= 5) patterns.push(`PATTERN_5.${awayCombo} (Oaspete)`);
}

if (patterns.length === 0) {
    console.log("❌ Niciun pattern detectat");
} else {
    patterns.forEach(p => console.log(`✅ ${p}`));
}

console.log("\n" + "=".repeat(60));
