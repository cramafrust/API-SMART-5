/**
 * 📅 REPORT SCHEDULER - Programare Automată Rapoarte
 *
 * Verifică continuu data/ora și trimite automat:
 * - Raport LUNAR: 1 a fiecărei luni la 08:00
 * - Raport SĂPTĂMÂNAL: În fiecare Marți la 08:00
 *
 * UTILIZARE:
 *   const reportScheduler = require('./REPORT_SCHEDULER');
 *   reportScheduler.start();  // Pornește verificarea automată
 */

const { spawn } = require('child_process');
const path = require('path');

class ReportScheduler {
    constructor() {
        this.checkInterval = 60000; // Verifică la fiecare 60 secunde (1 minut)
        this.lastMonthlyCheck = null;
        this.lastWeeklyCheck = null;
        this.intervalId = null;
        this.isRunning = false;
    }

    /**
     * Pornește programatorul de rapoarte
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️  Report Scheduler deja pornit');
            return;
        }

        console.log('');
        console.log('='.repeat(60));
        console.log('📅 REPORT SCHEDULER - PORNIT');
        console.log('='.repeat(60));
        console.log('');
        console.log('   📊 Raport LUNAR:      1 a fiecărei luni la 08:00');
        console.log('   📊 Raport SĂPTĂMÂNAL: În fiecare Marți la 08:00');
        console.log('');
        console.log('   ⏰ Verificare: La fiecare 60 secunde');
        console.log('');
        console.log('='.repeat(60));
        console.log('');

        this.isRunning = true;

        // Verificare imediată la pornire
        this.checkAndSendReports();

        // Setează verificare periodică
        this.intervalId = setInterval(() => {
            this.checkAndSendReports();
        }, this.checkInterval);
    }

    /**
     * Oprește programatorul de rapoarte
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            this.isRunning = false;
            console.log('📅 Report Scheduler oprit');
        }
    }

    /**
     * Verifică dacă trebuie să trimită rapoartele
     */
    checkAndSendReports() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentDay = now.getDate();
        const currentDayOfWeek = now.getDay(); // 0 = Duminică, 1 = Luni, 2 = Marți, etc.
        const currentDateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;

        // Verifică RAPORT LUNAR (1 a lunii, între 08:00-08:10)
        if (currentDay === 1 && currentHour === 8 && currentMinute >= 0 && currentMinute < 10) {
            if (this.lastMonthlyCheck !== currentDateKey) {
                this.lastMonthlyCheck = currentDateKey;
                this.sendMonthlyReport();
            }
        }

        // Verifică RAPORT SĂPTĂMÂNAL (Marți = 2, între 08:00-08:10)
        if (currentDayOfWeek === 2 && currentHour === 8 && currentMinute >= 0 && currentMinute < 10) {
            if (this.lastWeeklyCheck !== currentDateKey) {
                this.lastWeeklyCheck = currentDateKey;
                this.sendWeeklyReport();
            }
        }
    }

    /**
     * Trimite raportul lunar
     */
    sendMonthlyReport() {
        console.log('');
        console.log('='.repeat(60));
        console.log('📊 TRIMITERE AUTOMATĂ RAPORT LUNAR');
        console.log('='.repeat(60));
        console.log(`   Data: ${new Date().toLocaleString('ro-RO')}`);
        console.log('');

        const scriptPath = path.join(__dirname, 'SEND_MONTHLY_REPORT.js');

        const child = spawn('node', [scriptPath], {
            cwd: __dirname,
            stdio: 'inherit'
        });

        child.on('error', (error) => {
            console.error(`❌ Eroare trimitere raport lunar: ${error.message}`);
        });

        child.on('close', (code) => {
            if (code === 0) {
                console.log('');
                console.log('✅ Raport lunar trimis cu succes!');
                console.log('='.repeat(60));
                console.log('');
            } else {
                console.error(`❌ Raport lunar eșuat cu codul: ${code}`);
            }
        });
    }

    /**
     * Trimite raportul săptămânal
     */
    sendWeeklyReport() {
        console.log('');
        console.log('='.repeat(60));
        console.log('📊 TRIMITERE AUTOMATĂ RAPORT SĂPTĂMÂNAL');
        console.log('='.repeat(60));
        console.log(`   Data: ${new Date().toLocaleString('ro-RO')}`);
        console.log('');

        const scriptPath = path.join(__dirname, 'SEND_WEEKLY_REPORT.js');

        const child = spawn('node', [scriptPath], {
            cwd: __dirname,
            stdio: 'inherit'
        });

        child.on('error', (error) => {
            console.error(`❌ Eroare trimitere raport săptămânal: ${error.message}`);
        });

        child.on('close', (code) => {
            if (code === 0) {
                console.log('');
                console.log('✅ Raport săptămânal trimis cu succes!');
                console.log('='.repeat(60));
                console.log('');
            } else {
                console.error(`❌ Raport săptămânal eșuat cu codul: ${code}`);
            }
        });
    }

    /**
     * Returnează statusul curent
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            checkInterval: this.checkInterval,
            lastMonthlyCheck: this.lastMonthlyCheck,
            lastWeeklyCheck: this.lastWeeklyCheck
        };
    }
}

// Export singleton
module.exports = new ReportScheduler();
