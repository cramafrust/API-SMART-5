const fs = require("fs");
const { fetchMatchDetails } = require("./flashscore-api.js");
const PATTERN_DESCRIPTOR = require("./PATTERN_DESCRIPTOR.js");
const ProcenteLoader = require("./PROCENTE_LOADER.js");

(async () => {
    try {
        console.log("🔍 Extragere date Rapid vs U. Cluj...\n");

        const details = await fetchMatchDetails("zZSLsJYI");

        if (!details.statsData || details.statsData.length === 0) {
            console.log("❌ Nu există date statistice");
            return;
        }

        // Salvează stats
        fs.writeFileSync("stats-zZSLsJYI-HT.json", JSON.stringify(details, null, 2));
        console.log("✅ Stats salvate în stats-zZSLsJYI-HT.json\n");

        // Detectează pattern-uri
        const matchData = {
            matchId: "zZSLsJYI",
            homeTeam: "Rapid București",
            awayTeam: "U. Cluj",
            liga: "ROMANIA: Superliga"
        };

        const patterns = PATTERN_DESCRIPTOR.detectAllPatterns(matchData, details.statsData);

        console.log("📊 PATTERN-URI DETECTATE:\n");

        if (!patterns || patterns.length === 0) {
            console.log("❌ Niciun pattern detectat");
        } else {
            for (const p of patterns) {
                console.log(`✅ ${p.name}`);
                console.log(`   Echipă: ${p.team}`);
                console.log(`   Probabilitate: ${p.probability}%`);
                console.log(`   Tier: ${p.tier}`);
                console.log(`   Poziție: ${p.position || 'N/A'}`);
                console.log("");
            }
        }

    } catch (error) {
        console.error("❌ Eroare:", error.message);
        console.error(error.stack);
    }
})();
