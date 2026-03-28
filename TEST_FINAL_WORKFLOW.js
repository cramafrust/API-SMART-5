/**
 * TEST SCRIPT pentru workflow-ul FINAL DATA COLLECTOR
 */

const { saveMatchData } = require('./CHAMPIONSHIP_JSON_MANAGER');

// Date mock pentru test
const mockMatchData = {
    match: {
        homeTeam: "Arsenal",
        awayTeam: "Chelsea",
        date: "04.11.2025 20:00",
        league: "Premier League",
        country: "England",
        season: "2025-2026",
        round: null,
        roundNumber: null,
        homePositionBefore: 1,
        awayPositionBefore: 3,
        homeTier: "TOP",
        awayTier: "TOP"
    },
    halftime: {
        teams: {
            home: "Arsenal",
            away: "Chelsea"
        },
        score: {
            home: "1",
            away: "0"
        },
        statistics: {
            home: {
                "Total shots": "8",
                "Shots on target": "4",
                "Corner Kicks": "3",
                "Yellow Cards": "1",
                "Shots off target": "4",
                "Offsides": "0",
                "Free Kicks": "10",
                "Fouls": "8",
                "Goalkeeper Saves": "0"
            },
            away: {
                "Total shots": "5",
                "Shots on target": "2",
                "Corner Kicks": "2",
                "Yellow Cards": "2",
                "Shots off target": "3",
                "Offsides": "1",
                "Free Kicks": "8",
                "Fouls": "10",
                "Goalkeeper Saves": "3"
            }
        }
    },
    fulltime: {
        teams: {
            home: "Arsenal",
            away: "Chelsea"
        },
        score: {
            home: "2",
            away: "1"
        },
        statistics: {
            home: {
                "Total shots": "15",
                "Shots on target": "7",
                "Corner Kicks": "6",
                "Yellow Cards": "2",
                "Shots off target": "8",
                "Offsides": "2",
                "Free Kicks": "18",
                "Fouls": "14",
                "Goalkeeper Saves": "1",
                "Ball Possession": "58"
            },
            away: {
                "Total shots": "10",
                "Shots on target": "4",
                "Corner Kicks": "4",
                "Yellow Cards": "3",
                "Shots off target": "6",
                "Offsides": "3",
                "Free Kicks": "14",
                "Fouls": "18",
                "Goalkeeper Saves": "5",
                "Ball Possession": "42"
            }
        }
    },
    metadata: {
        matchId: "TEST_MOCK_123",
        extractedAt: new Date().toISOString(),
        source: "FlashScore API"
    }
};

console.log('\n🧪 TEST WORKFLOW - FINAL DATA COLLECTOR\n');
console.log('='.repeat(60));
console.log('\n📝 Test 1: Salvare date meci în JSON campionat\n');

// Test salvare
const result = saveMatchData(mockMatchData, '/home/florian/football-analyzer');

console.log('\n✅ Test completat!');
console.log('\nRezultat:', JSON.stringify(result, null, 2));

// Test 2: Salvare meci duplicate (ar trebui să fie skip)
console.log('\n📝 Test 2: Salvare meci duplicat (ar trebui SKIP)\n');
const result2 = saveMatchData(mockMatchData, '/home/florian/football-analyzer');

console.log('\n✅ Test completat!');
console.log('\nRezultat:', JSON.stringify(result2, null, 2));

// Test 3: Salvare meci diferit din aceeași ligă
console.log('\n📝 Test 3: Salvare meci diferit din aceeași ligă\n');

const mockMatchData2 = {
    ...mockMatchData,
    match: {
        ...mockMatchData.match,
        homeTeam: "Manchester United",
        awayTeam: "Liverpool",
        date: "05.11.2025 21:00"
    },
    halftime: {
        ...mockMatchData.halftime,
        teams: { home: "Manchester United", away: "Liverpool" },
        score: { home: "0", away: "1" }
    },
    fulltime: {
        ...mockMatchData.fulltime,
        teams: { home: "Manchester United", away: "Liverpool" },
        score: { home: "1", away: "2" }
    },
    metadata: {
        matchId: "TEST_MOCK_456",
        extractedAt: new Date().toISOString(),
        source: "FlashScore API"
    }
};

const result3 = saveMatchData(mockMatchData2, '/home/florian/football-analyzer');

console.log('\n✅ Test completat!');
console.log('\nRezultat:', JSON.stringify(result3, null, 2));

console.log('\n' + '='.repeat(60));
console.log('\n🎉 TOATE TESTELE COMPLETATE!\n');
console.log('Verifică fișierul generat în:');
console.log('/home/florian/football-analyzer/complete_FULL_SEASON_PremierLeague_2025-2026.json\n');
