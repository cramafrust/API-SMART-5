const { fetchMatchDetails } = require('./flashscore-api');

const matches = [
    { id: 'Cfb5H9Sg', name: 'Monaco vs Rennes' },
    { id: 'MgJFt8Ad', name: 'Sparta Rotterdam vs Groningen' },
    { id: 'bTitnz7m', name: 'Liverpool vs Newcastle' },
    { id: 'fZukhZy3', name: 'St. Truiden vs Charleroi' }
];

(async () => {
    console.log('⚽ VERIFICARE STATUS MECIURI ÎN MONITORING:\n');

    for (const match of matches) {
        try {
            const details = await fetchMatchDetails(match.id);

            if (!details || !details.core) {
                console.log('❌ ' + match.name + ' - Nu s-au putut obține detalii');
                continue;
            }

            const isFinished = details.core.AZ === '1';
            const score = details.core.AG + '-' + details.core.AH;
            const status = isFinished ? '✅ TERMINAT' : '⏳ ÎN CURS';

            console.log(status + ' | ' + match.name + ' | Scor: ' + score);

            await new Promise(r => setTimeout(r, 1500));
        } catch (e) {
            console.log('❌ ' + match.name + ' - Eroare: ' + e.message);
        }
    }
})();
