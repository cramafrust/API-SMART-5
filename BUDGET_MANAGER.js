/**
 * BUDGET MANAGER
 *
 * Gestionează bugetul zilnic pentru pariuri automate
 * - Verifică sold dimineața
 * - Alocă 5% per pariu
 * - Update zilnic automat
 * - Safeguard-uri pentru pierderi
 */

const fs = require('fs');
const path = require('path');

class BudgetManager {
    constructor() {
        this.budgetFile = path.join(__dirname, 'budget_data.json');
        this.ensureBudgetFile();
    }

    /**
     * Asigură că fișierul de budget există
     */
    ensureBudgetFile() {
        if (!fs.existsSync(this.budgetFile)) {
            const initialData = {
                version: '1.0',
                created: new Date().toISOString(),
                currentBalance: 0,
                dailyBudget: 0,
                betsPlaced: 0,
                betsToday: [],
                lastUpdate: new Date().toISOString(),
                totalProfit: 0,
                statistics: {
                    totalBets: 0,
                    wonBets: 0,
                    lostBets: 0,
                    totalStake: 0,
                    totalReturn: 0
                }
            };

            fs.writeFileSync(this.budgetFile, JSON.stringify(initialData, null, 2));
            console.log('✅ Budget file created');
        }
    }

    /**
     * Citește datele de budget
     */
    readBudget() {
        try {
            const data = fs.readFileSync(this.budgetFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('❌ Error reading budget:', error.message);
            return null;
        }
    }

    /**
     * Salvează datele de budget
     */
    writeBudget(data) {
        try {
            data.lastUpdate = new Date().toISOString();
            fs.writeFileSync(this.budgetFile, JSON.stringify(data, null, 2));
            return true;
        } catch (error) {
            console.error('❌ Error writing budget:', error.message);
            return false;
        }
    }

    /**
     * Update sold dimineața (rulează automat la 08:00)
     */
    async updateDailyBalance(newBalance) {
        const budget = this.readBudget();

        if (!budget) {
            console.error('❌ Nu pot citi budget');
            return false;
        }

        const today = new Date().toISOString().split('T')[0];
        const lastUpdateDate = budget.lastUpdate.split('T')[0];

        // Verifică dacă e o zi nouă
        const isNewDay = today !== lastUpdateDate;

        if (isNewDay) {
            console.log(`\n📅 NOU ZILĂ: ${today}`);
            console.log(`💰 Sold vechi: ${budget.currentBalance} RON`);
            console.log(`💰 Sold nou: ${newBalance} RON`);

            // Calculează profitul zilei precedente
            const dailyProfit = newBalance - budget.currentBalance;
            console.log(`${dailyProfit >= 0 ? '📈' : '📉'} Profit ieri: ${dailyProfit.toFixed(2)} RON\n`);

            // Reset pariuri zilnice
            budget.betsToday = [];
            budget.betsPlaced = 0;
        }

        // Update sold current
        budget.currentBalance = newBalance;
        budget.dailyBudget = newBalance;

        this.writeBudget(budget);

        console.log('✅ Budget actualizat pentru astăzi');
        console.log(`   Sold disponibil: ${newBalance.toFixed(2)} RON`);
        console.log(`   Miză per pariu (5%): ${(newBalance * 0.05).toFixed(2)} RON\n`);

        return true;
    }

    /**
     * Calculează suma pentru următorul pariu (5% din sold)
     */
    getNextBetStake() {
        const budget = this.readBudget();

        if (!budget || budget.currentBalance <= 0) {
            console.error('❌ Sold insuficient');
            return 0;
        }

        const stake = budget.currentBalance * 0.05;

        // Rotunjește la 2 zecimale
        return Math.floor(stake * 100) / 100;
    }

    /**
     * Înregistrează pariu plasat
     */
    recordBet(betData) {
        const budget = this.readBudget();

        if (!budget) return false;

        const bet = {
            id: betData.betId || `bet_${Date.now()}`,
            timestamp: new Date().toISOString(),
            match: betData.match,
            event: betData.event,
            odd: betData.odd,
            stake: betData.stake,
            potentialReturn: betData.stake * betData.odd,
            status: 'PENDING' // PENDING, WON, LOST
        };

        budget.betsToday.push(bet);
        budget.betsPlaced++;
        budget.statistics.totalBets++;
        budget.statistics.totalStake += betData.stake;

        // Scade suma pariată din sold
        budget.currentBalance -= betData.stake;

        this.writeBudget(budget);

        console.log('✅ Pariu înregistrat în budget:');
        console.log(`   ID: ${bet.id}`);
        console.log(`   Miză: ${bet.stake.toFixed(2)} RON`);
        console.log(`   Cotă: ${bet.odd.toFixed(2)}`);
        console.log(`   Câștig potențial: ${bet.potentialReturn.toFixed(2)} RON`);
        console.log(`   Sold rămas: ${budget.currentBalance.toFixed(2)} RON\n`);

        return bet;
    }

    /**
     * Update status pariu (câștigat/pierdut)
     */
    updateBetStatus(betId, status, returnAmount = 0) {
        const budget = this.readBudget();

        if (!budget) return false;

        const bet = budget.betsToday.find(b => b.id === betId);

        if (!bet) {
            console.error(`❌ Pariu ${betId} nu există în budget`);
            return false;
        }

        bet.status = status;

        if (status === 'WON') {
            budget.currentBalance += returnAmount;
            budget.statistics.wonBets++;
            budget.statistics.totalReturn += returnAmount;
            budget.totalProfit += (returnAmount - bet.stake);

            console.log(`✅ Pariu ${betId} CÂȘTIGAT!`);
            console.log(`   Return: ${returnAmount.toFixed(2)} RON`);
            console.log(`   Profit: ${(returnAmount - bet.stake).toFixed(2)} RON`);
        } else if (status === 'LOST') {
            budget.statistics.lostBets++;
            budget.totalProfit -= bet.stake;

            console.log(`❌ Pariu ${betId} PIERDUT`);
            console.log(`   Pierdere: ${bet.stake.toFixed(2)} RON`);
        }

        this.writeBudget(budget);

        return true;
    }

    /**
     * Verifică dacă poate plasa pariu (safeguard)
     */
    canPlaceBet() {
        const budget = this.readBudget();

        if (!budget) return { allowed: false, reason: 'Nu pot citi budget' };

        // Verifică sold minim
        if (budget.currentBalance < 10) {
            return { allowed: false, reason: `Sold insuficient: ${budget.currentBalance.toFixed(2)} RON (minim 10 RON)` };
        }

        // Verifică limită pariuri pe zi (max 10)
        if (budget.betsPlaced >= 10) {
            return { allowed: false, reason: `Limită zilnică atinsă: ${budget.betsPlaced}/10 pariuri` };
        }

        const stake = this.getNextBetStake();

        return {
            allowed: true,
            stake: stake,
            balance: budget.currentBalance,
            betsToday: budget.betsPlaced
        };
    }

    /**
     * Generează raport statistici
     */
    getStatistics() {
        const budget = this.readBudget();

        if (!budget) return null;

        const winRate = budget.statistics.totalBets > 0
            ? Math.round((budget.statistics.wonBets / budget.statistics.totalBets) * 100)
            : 0;

        const avgStake = budget.statistics.totalBets > 0
            ? budget.statistics.totalStake / budget.statistics.totalBets
            : 0;

        const roi = budget.statistics.totalStake > 0
            ? ((budget.statistics.totalReturn - budget.statistics.totalStake) / budget.statistics.totalStake) * 100
            : 0;

        return {
            currentBalance: budget.currentBalance,
            totalProfit: budget.totalProfit,
            betsToday: budget.betsPlaced,
            totalBets: budget.statistics.totalBets,
            wonBets: budget.statistics.wonBets,
            lostBets: budget.statistics.lostBets,
            winRate: winRate,
            averageStake: avgStake,
            roi: roi.toFixed(2)
        };
    }
}

module.exports = new BudgetManager();
