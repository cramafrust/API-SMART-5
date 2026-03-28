/**
 * 📧 SEND_DAILY_REPORT.js
 *
 * Trimite raportul zilnic prin email
 *
 * USAGE:
 *   node SEND_DAILY_REPORT.js              # Raport pentru ieri
 *   node SEND_DAILY_REPORT.js 2026-01-25   # Raport pentru dată specifică
 */

const fs = require('fs');
const path = require('path');
const { generateDailyReport, getYesterdayDate } = require('./DAILY_REPORT_GENERATOR');
const emailService = require('./EMAIL_SERVICE');

/**
 * Trimite raportul zilnic prin email
 */
async function sendDailyReport(targetDate) {
    console.log(`\n📧 TRIMITERE RAPORT ZILNIC pentru ${targetDate}\n`);
    console.log('='.repeat(60));

    try {
        // Generează raportul
        const { html, stats, matches } = generateDailyReport(targetDate);

        // Subiect email
        let subject = `📊 Raport Zilnic ${targetDate}`;

        if (stats.total > 0) {
            subject += ` - ${stats.total} pronosticuri`;
            if (stats.validated > 0) {
                subject += ` | ${stats.successRate}% success rate`;
                if (stats.won > 0) subject += ` | ✅ ${stats.won} câștigate`;
                if (stats.lost > 0) subject += ` | ❌ ${stats.lost} pierdute`;
            }
        } else {
            subject += ` - Niciun pronostic`;
        }

        console.log(`📋 Subiect: ${subject}`);

        // Trimite email folosind serviciul centralizat
        const result = await emailService.send({
            from: '"API SMART 5 Reports" <smartyield365@gmail.com>',
            subject: subject,
            html: html
        });

        if (!result.success) {
            throw new Error(result.error || 'Email service unavailable');
        }

        console.log(`\n✅ Email trimis cu succes!`);
        console.log(`   Message ID: ${result.messageId}`);
        console.log('='.repeat(60));

        return {
            success: true,
            messageId: result.messageId,
            stats: stats
        };

    } catch (error) {
        console.error(`\n❌ EROARE la trimitere email: ${error.message}`);
        console.error(error.stack);
        console.log('='.repeat(60));

        return {
            success: false,
            error: error.message
        };
    }
}

// Export
module.exports = {
    sendDailyReport
};

// CLI usage
if (require.main === module) {
    const targetDate = process.argv[2] || getYesterdayDate();

    (async () => {
        const result = await sendDailyReport(targetDate);

        if (result.success) {
            console.log('\n✅ Raport trimis cu succes!\n');
            process.exit(0);
        } else {
            console.error('\n❌ Eroare la trimitere raport!\n');
            process.exit(1);
        }
    })();
}
