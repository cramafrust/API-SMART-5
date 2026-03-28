const { fetchMainFeed } = require('./flashscore-api');

(async () => {
    const feed = await fetchMainFeed();
    const allMatches = Object.values(feed.matches);

    // Găsește meciurile Paulista la pauză
    const paulistaHT = allMatches.filter(m => {
        const league = feed.leagues[m.leagueId] || {};
        const leagueName = (league.name || '');
        const isPaulista = leagueName.includes('BRAZIL: Paulista');
        const isNotA2 = !leagueName.includes('A2');
        const isNotA3 = !leagueName.includes('A3');
        const isNotA4 = !leagueName.includes('A4');
        const isHT = m.status === '2';

        return isPaulista && isNotA2 && isNotA3 && isNotA4 && isHT;
    });

    console.log('Meciuri găsite la pauză:', paulistaHT.length);
    console.log('');

    paulistaHT.forEach(m => {
        const league = feed.leagues[m.leagueId] || {};
        const matchDate = new Date(m.timestamp * 1000);
        const ora = matchDate.toLocaleTimeString('ro-RO', {hour: '2-digit', minute: '2-digit'});

        console.log(JSON.stringify({
            matchId: m.matchId,
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            liga: league.name,
            ora: ora,
            timestamp: m.timestamp,
            finished: false
        }, null, 2));
    });
})();
