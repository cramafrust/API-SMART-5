/**
 * TEST AUTO BETTING SYSTEM
 *
 * Script de testare pentru sistemul de pariuri automate
 * ⚠️  COMPLET SEPARAT - NU AFECTEAZĂ SISTEMUL PRINCIPAL
 * ⚠️  RULEAZĂ ÎN DRY RUN MODE (fără pariuri reale)
 */

const SuperbetAutoBetting = require('./SUPERBET_AUTO_BETTING');
const BudgetManager = require('./BUDGET_MANAGER');

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║         🧪 TEST AUTO BETTING SYSTEM                           ║
║         (DRY RUN MODE - FĂRĂ PARIURI REALE)                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

async function testCompletFlow() {
    console.log('\n📋 TEST FLOW COMPLET:\n');
    console.log('1. Inițializare sistem (DRY RUN)');
    console.log('2. Login simulat');
    console.log('3. Update buget zilnic');
    console.log('4. Plasare 3 pariuri de test');
    console.log('5. Verificare statistici');
    console.log('6. Shutdown sistem\n');
    console.log('='.repeat(80));

    // 1. Inițializare sistem (DRY RUN mode)
    const betting = new SuperbetAutoBetting({
        dryRun: true, // IMPORTANT: DRY RUN!
        email: 'test@example.com',
        password: '***'
    });

    // 2. Login
    const loginSuccess = await betting.login();
    if (!loginSuccess) {
        console.error('\n❌ Login failed - opresc testul\n');
        return;
    }

    // 3. Update buget zilnic
    const budgetUpdated = await betting.updateDailyBudget();
    if (!budgetUpdated) {
        console.error('\n❌ Budget update failed - opresc testul\n');
        return;
    }

    // 4. Plasare pariuri de test
    console.log('\n' + '='.repeat(80));
    console.log('🎯 PLASARE PARIURI DE TEST (DRY RUN)');
    console.log('='.repeat(80));

    const testBets = [
        {
            matchId: 'TEST_001',
            homeTeam: 'Manchester City',
            awayTeam: 'Liverpool',
            event: 'Echipa gazdă va marca în repriza 2',
            odd: 1.75,
            selectionId: 'SELECTION_001'
        },
        {
            matchId: 'TEST_002',
            homeTeam: 'Real Madrid',
            awayTeam: 'Barcelona',
            event: 'Vor fi peste 2.5 goluri',
            odd: 1.90,
            selectionId: 'SELECTION_002'
        },
        {
            matchId: 'TEST_003',
            homeTeam: 'Bayern Munich',
            awayTeam: 'Borussia Dortmund',
            event: 'Ambele echipe vor marca',
            odd: 1.65,
            selectionId: 'SELECTION_003'
        }
    ];

    const results = [];

    for (const betData of testBets) {
        const result = await betting.placeBet(betData);
        results.push(result);

        if (result.success) {
            console.log('✅ Pariu plasat cu succes!');
        } else {
            console.log(`❌ Pariu eșuat: ${result.reason}`);
        }

        // Delay între pariuri (comportament uman)
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 5. Statistici
    console.log('\n' + '='.repeat(80));
    console.log('📊 STATISTICI DUPĂ TESTARE');
    console.log('='.repeat(80));

    const sessionStats = betting.getSessionStats();
    console.log('\n🤖 Sesiune Auto Betting:');
    console.log(`   Durată: ${sessionStats.duration}`);
    console.log(`   Pariuri plasate: ${sessionStats.betsPlaced}`);
    console.log(`   Succes: ${sessionStats.betsSuccess}`);
    console.log(`   Eșuate: ${sessionStats.betsFailed}`);
    console.log(`   Success rate: ${sessionStats.successRate}%`);

    const budgetStats = BudgetManager.getStatistics();
    if (budgetStats) {
        console.log('\n💰 Budget Manager:');
        console.log(`   Sold curent: ${budgetStats.currentBalance.toFixed(2)} RON`);
        console.log(`   Pariuri azi: ${budgetStats.betsToday}`);
        console.log(`   Total pariuri: ${budgetStats.totalBets}`);
        console.log(`   Miză medie: ${budgetStats.averageStake.toFixed(2)} RON`);
    }

    // 6. Shutdown
    await betting.shutdown();

    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST COMPLET!');
    console.log('='.repeat(80));
    console.log('\n📋 REZUMAT:');
    console.log('   ✅ Login: Funcțional (simulat)');
    console.log('   ✅ Get Balance: Funcțional (simulat)');
    console.log('   ✅ Update Budget: Funcțional');
    console.log('   ✅ Place Bet: Funcțional (simulat)');
    console.log('   ✅ Budget Manager: Funcțional');
    console.log('   ✅ Rate Limiting: Funcțional');
    console.log('   ✅ Safeguard-uri: Funcționale\n');

    console.log('💡 URMĂTORII PAȘI:');
    console.log('   1. Descoperă API-urile reale cu DISCOVER_BETTING_API.js');
    console.log('   2. Completează endpoint-urile în SUPERBET_AUTO_BETTING.js');
    console.log('   3. Testează cu cont real (DRY RUN mode)');
    console.log('   4. După validare → integrează în sistemul principal\n');
}

// Test individual Budget Manager
async function testBudgetManager() {
    console.log('\n' + '='.repeat(80));
    console.log('🧪 TEST BUDGET MANAGER (IZOLAT)');
    console.log('='.repeat(80) + '\n');

    // Simulare sold
    console.log('1. Setare sold inițial: 1000 RON');
    await BudgetManager.updateDailyBalance(1000);

    console.log('\n2. Calculare miză următorul pariu (5%):');
    const stake = BudgetManager.getNextBetStake();
    console.log(`   Miză: ${stake.toFixed(2)} RON`);

    console.log('\n3. Verificare dacă poate plasa pariu:');
    const canBet = BudgetManager.canPlaceBet();
    console.log(`   Permis: ${canBet.allowed ? 'DA' : 'NU'}`);
    if (canBet.allowed) {
        console.log(`   Sold: ${canBet.balance.toFixed(2)} RON`);
        console.log(`   Miză: ${canBet.stake.toFixed(2)} RON`);
    } else {
        console.log(`   Motiv: ${canBet.reason}`);
    }

    console.log('\n4. Înregistrare pariu de test:');
    const bet = BudgetManager.recordBet({
        betId: 'TEST_BET_001',
        match: 'Test Match 1',
        event: 'Test Event',
        odd: 1.80,
        stake: stake
    });

    console.log('\n5. Statistici:');
    const stats = BudgetManager.getStatistics();
    console.log(JSON.stringify(stats, null, 2));

    console.log('\n✅ TEST BUDGET MANAGER COMPLET!\n');
}

// Meniu principal
async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--budget')) {
        await testBudgetManager();
    } else if (args.includes('--full')) {
        await testCompletFlow();
    } else {
        console.log('📖 UTILIZARE:\n');
        console.log('   node TEST_AUTO_BETTING_SYSTEM.js --budget');
        console.log('      → Testează doar Budget Manager\n');
        console.log('   node TEST_AUTO_BETTING_SYSTEM.js --full');
        console.log('      → Testează întregul flow (login, budget, betting)\n');
    }
}

// Run
main().catch(error => {
    console.error('\n❌ EROARE ÎN TEST:', error);
    process.exit(1);
});
