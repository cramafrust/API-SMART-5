const { fetchMatchDetails } = require("./flashscore-api.js");
const PatternDetector = require("./PATTERN_DETECTOR.js");

(async () => {
    try {
        console.log("🔍 Verificare: Rapid București vs U. Cluj (ID: zZSLsJYI)");
        console.log("⏰ Ora start: 20:00, verificare tardivă la 21:10\n");

        const details = await fetchMatchDetails("zZSLsJYI");

        if (!details.statsData || details.statsData.length === 0) {
            console.log("❌ Nu există date statistice disponibile");
            return;
        }

        const patterns = PatternDetector.detectAllPatterns({
            matchId: "zZSLsJYI",
            homeTeam: "Rapid București",
            awayTeam: "U. Cluj",
            liga: "ROMANIA: Superliga",
            statsData: details.statsData
        });

        console.log("📊 PATTERN-URI DETECTATE:\n");

        if (patterns.length === 0) {
            console.log("❌ Niciun pattern detectat");
        } else {
            patterns.forEach(p => {
                console.log("✅ " + p.name);
                console.log("   Echipă: " + p.team);
                console.log("   Probabilitate: " + p.probability + "%");
                console.log("   Tier: " + p.tier);
                console.log("   Poziție: " + p.position);
                console.log("");
            });
        }

    } catch (error) {
        console.error("❌ Eroare:", error.message);
    }
})();
