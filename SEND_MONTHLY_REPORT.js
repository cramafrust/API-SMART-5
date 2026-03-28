/**
 * 📧 SEND MONTHLY REPORT
 *
 * Trimite raport lunar cu 4 PDF-uri atașate:
 * 1. TOATE notificările
 * 2. DOAR cele cu cotă 1.50
 * 3. DOAR cele cu cotă 2.00
 * 4. DOAR cele PIERDUTE
 *
 * PROGRAMARE: Automat la data de 1 a fiecărei luni (CRON)
 *
 * USAGE:
 *   node SEND_MONTHLY_REPORT.js              # Luna trecută
 *   node SEND_MONTHLY_REPORT.js 2026-01      # Luna specifică
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);

const emailService = require('./EMAIL_SERVICE');
const {
    generateMonthlyReport,
    getMonthName,
    getCurrentMonth
} = require('./MONTHLY_REPORT_GENERATOR');

/**
 * Obține luna anterioară în format YYYY-MM
 */
function getPreviousMonth() {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = lastMonth.getFullYear();
    const month = String(lastMonth.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

/**
 * Convertește HTML în PDF folosind wkhtmltopdf
 */
async function convertHTMLToPDF(htmlPath, pdfPath) {
    try {
        // Verifică dacă wkhtmltopdf este instalat
        try {
            await execPromise('which wkhtmltopdf');
        } catch (error) {
            console.log('   ⚠️  wkhtmltopdf nu este instalat');
            console.log('   💡 Instalare: sudo apt-get install wkhtmltopdf');
            console.log('   📄 Trimit fișiere HTML direct...');
            return null;
        }

        // Convertește HTML → PDF
        const command = `wkhtmltopdf --enable-local-file-access "${htmlPath}" "${pdfPath}"`;
        await execPromise(command);

        console.log(`   ✅ PDF generat: ${path.basename(pdfPath)}`);
        return pdfPath;

    } catch (error) {
        console.error(`   ❌ Eroare conversie PDF: ${error.message}`);
        return null;
    }
}

/**
 * Generează raport FILTRAT și salvează HTML
 */
function generateAndSaveFilteredReport(targetMonth, filterType, filterTitle, suffix) {
    const tracker = require('./NOTIFICATION_TRACKER');

    // Citește toate notificările
    const trackingData = tracker.readStorage();
    let allNotifications = trackingData.notifications || [];

    // Filtrează notificările din luna specificată
    allNotifications = allNotifications.filter(n => {
        if (n.timestamp) {
            const notifDate = new Date(n.timestamp);
            const notifMonth = `${notifDate.getFullYear()}-${String(notifDate.getMonth() + 1).padStart(2, '0')}`;
            return notifMonth === targetMonth;
        }
        if (n.date) {
            const [day, month, year] = n.date.split('.');
            const notifMonth = `${year}-${month}`;
            return notifMonth === targetMonth;
        }
        return false;
    });

    // Aplică filtru specific
    let monthNotifications = allNotifications;
    switch (filterType) {
        case 'odd_150':
            monthNotifications = allNotifications.filter(n => n.odd_150_sent === true || n.minute_odd_1_50);
            break;
        case 'odd_200':
            monthNotifications = allNotifications.filter(n => n.odd_200_sent === true || n.minute_odd_2_00);
            break;
        case 'lost':
            monthNotifications = allNotifications.filter(n =>
                n.validated === true && n.validation_result === 'lost'
            );
            break;
    }

    if (monthNotifications.length === 0) {
        return null;
    }

    // Sortează după dată
    monthNotifications.sort((a, b) => {
        const dateA = new Date(a.timestamp || a.date);
        const dateB = new Date(b.timestamp || b.date);
        return dateA - dateB;
    });

    // Calculează statistici
    const stats = {
        total: monthNotifications.length,
        validated: monthNotifications.filter(n => n.validated).length,
        won: monthNotifications.filter(n => n.validation_result === 'won').length,
        lost: monthNotifications.filter(n => n.validation_result === 'lost').length,
        pending: monthNotifications.filter(n => !n.validated).length,
        odd_150_reached: monthNotifications.filter(n => n.odd_150_sent || n.minute_odd_1_50).length,
        odd_200_reached: monthNotifications.filter(n => n.odd_200_sent || n.minute_odd_2_00).length
    };

    const successRate = stats.validated > 0
        ? ((stats.won / stats.validated) * 100).toFixed(1)
        : 0;

    // Generează HTML (folosind funcția din MONTHLY_REPORT_GENERATOR)
    const { generateHTML } = require('./MONTHLY_REPORT_GENERATOR');
    const html = generateHTML(targetMonth, monthNotifications, stats, successRate);

    // Înlocuim titlul cu cel custom
    const customHTML = html.replace(
        `<h1>📊 RAPORT LUNAR ${getMonthName(targetMonth)}</h1>`,
        `<h1>${filterTitle}</h1>`
    );

    // Salvează HTML
    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }

    const htmlFilename = `monthly-report-${targetMonth}-${suffix}.html`;
    const htmlPath = path.join(reportsDir, htmlFilename);
    fs.writeFileSync(htmlPath, customHTML, 'utf8');

    return {
        htmlPath,
        stats,
        successRate,
        count: monthNotifications.length
    };
}

/**
 * Generează toate cele 4 rapoarte (HTML și PDF)
 */
async function generateAllReports(targetMonth) {
    console.log(`\n📊 GENERARE RAPOARTE LUNARE: ${getMonthName(targetMonth)}\n`);
    console.log('='.repeat(60));

    const monthName = getMonthName(targetMonth);
    const reports = [];

    // 1️⃣ RAPORT COMPLET
    console.log('\n1️⃣  RAPORT COMPLET - TOATE NOTIFICĂRILE');
    const reportAll = generateMonthlyReport(targetMonth);
    if (reportAll) {
        const reportsDir = path.join(__dirname, 'reports');
        const htmlPath = path.join(reportsDir, `monthly-report-${targetMonth}.html`);
        fs.writeFileSync(htmlPath, reportAll.html, 'utf8');
        const pdfPath = htmlPath.replace('.html', '.pdf');
        await convertHTMLToPDF(htmlPath, pdfPath);
        reports.push({
            type: 'ALL',
            title: `📊 RAPORT COMPLET - ${monthName}`,
            htmlPath,
            pdfPath: fs.existsSync(pdfPath) ? pdfPath : htmlPath,
            count: reportAll.notifications.length
        });
    }

    // 2️⃣ RAPORT COTĂ 1.50
    console.log('\n2️⃣  RAPORT COTĂ 1.50');
    const report150 = generateAndSaveFilteredReport(
        targetMonth,
        'odd_150',
        `⚡ RAPORT COTĂ 1.50 - ${monthName}`,
        'cota-1.50'
    );
    if (report150) {
        const pdfPath = report150.htmlPath.replace('.html', '.pdf');
        await convertHTMLToPDF(report150.htmlPath, pdfPath);
        reports.push({
            type: 'COTĂ 1.50',
            title: `⚡ COTĂ 1.50 - ${monthName}`,
            htmlPath: report150.htmlPath,
            pdfPath: fs.existsSync(pdfPath) ? pdfPath : report150.htmlPath,
            count: report150.count
        });
    }

    // 3️⃣ RAPORT COTĂ 2.00
    console.log('\n3️⃣  RAPORT COTĂ 2.00');
    const report200 = generateAndSaveFilteredReport(
        targetMonth,
        'odd_200',
        `🚀 RAPORT COTĂ 2.00 - ${monthName}`,
        'cota-2.00'
    );
    if (report200) {
        const pdfPath = report200.htmlPath.replace('.html', '.pdf');
        await convertHTMLToPDF(report200.htmlPath, pdfPath);
        reports.push({
            type: 'COTĂ 2.00',
            title: `🚀 COTĂ 2.00 - ${monthName}`,
            htmlPath: report200.htmlPath,
            pdfPath: fs.existsSync(pdfPath) ? pdfPath : report200.htmlPath,
            count: report200.count
        });
    }

    // 4️⃣ RAPORT PIERDUTE
    console.log('\n4️⃣  RAPORT PIERDUTE');
    const reportLost = generateAndSaveFilteredReport(
        targetMonth,
        'lost',
        `❌ RAPORT PIERDUTE - ${monthName}`,
        'pierdute'
    );
    if (reportLost) {
        const pdfPath = reportLost.htmlPath.replace('.html', '.pdf');
        await convertHTMLToPDF(reportLost.htmlPath, pdfPath);
        reports.push({
            type: 'PIERDUTE',
            title: `❌ PIERDUTE - ${monthName}`,
            htmlPath: reportLost.htmlPath,
            pdfPath: fs.existsSync(pdfPath) ? pdfPath : reportLost.htmlPath,
            count: reportLost.count
        });
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Generate ${reports.length} rapoarte\n`);

    return reports;
}

/**
 * Trimite email cu rapoartele atașate
 */
async function sendMonthlyReportEmail(targetMonth, reports) {
    const monthName = getMonthName(targetMonth);

    console.log(`\n📧 TRIMITERE EMAIL RAPORT LUNAR: ${monthName}\n`);
    console.log('='.repeat(60));

    if (!reports || reports.length === 0) {
        console.log('\n⚠️  Nu există rapoarte de trimis');
        return { success: false, reason: 'No reports' };
    }

    // Calculează statistici generale
    const totalReport = reports.find(r => r.type === 'ALL');
    const stats = totalReport ? {
        total: totalReport.count,
        odd150: reports.find(r => r.type === 'COTĂ 1.50')?.count || 0,
        odd200: reports.find(r => r.type === 'COTĂ 2.00')?.count || 0,
        lost: reports.find(r => r.type === 'PIERDUTE')?.count || 0
    } : { total: 0, odd150: 0, odd200: 0, lost: 0 };

    // Subject
    const subject = `📊 RAPORT LUNAR ${monthName} - API SMART 5 (${stats.total} notificări)`;

    // Body HTML
    const htmlBody = `
<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            text-align: center;
            margin-bottom: 30px;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin: 30px 0;
        }
        .stat-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border-left: 4px solid #667eea;
        }
        .stat-card.success { border-left-color: #28a745; }
        .stat-card.info { border-left-color: #17a2b8; }
        .stat-card.danger { border-left-color: #dc3545; }
        .stat-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 8px;
        }
        .stat-value {
            font-size: 32px;
            font-weight: bold;
            color: #333;
        }
        .attachments {
            background: #fff3cd;
            border-left: 5px solid #ffc107;
            padding: 20px;
            margin: 30px 0;
            border-radius: 8px;
        }
        .attachments h3 {
            margin: 0 0 15px 0;
            color: #856404;
        }
        .attachment-list {
            list-style: none;
            padding: 0;
        }
        .attachment-list li {
            padding: 10px;
            margin: 8px 0;
            background: white;
            border-radius: 6px;
            border-left: 3px solid #ffc107;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e9ecef;
            color: #666;
            font-size: 13px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 RAPORT LUNAR ${monthName}</h1>
        <p>API SMART 5 - Sistem Automat Detectare Pattern-uri</p>
    </div>

    <p>Bună,</p>
    <p>Iți trimitem raportul lunar complet pentru <strong>${monthName}</strong>.</p>

    <div class="stats-grid">
        <div class="stat-card success">
            <div class="stat-label">Total Notificări</div>
            <div class="stat-value">${stats.total}</div>
        </div>
        <div class="stat-card info">
            <div class="stat-label">Cotă ≥1.50</div>
            <div class="stat-value">${stats.odd150}</div>
        </div>
        <div class="stat-card info">
            <div class="stat-label">Cotă ≥2.00</div>
            <div class="stat-value">${stats.odd200}</div>
        </div>
        <div class="stat-card danger">
            <div class="stat-label">Pierdute</div>
            <div class="stat-value">${stats.lost}</div>
        </div>
    </div>

    <div class="attachments">
        <h3>📎 FIȘIERE ATAȘATE (${reports.length})</h3>
        <ul class="attachment-list">
${reports.map((r, i) => `            <li>📄 <strong>${i + 1}. ${r.title}</strong> (${r.count} notificări)</li>`).join('\n')}
        </ul>
    </div>

    <p>Rapoartele sunt atașate la acest email în format ${reports[0].pdfPath.endsWith('.pdf') ? 'PDF' : 'HTML'}.</p>

    <p>Succes! 🚀</p>

    <div class="footer">
        🤖 <strong>API SMART 5</strong> - Raport generat automat<br>
        Trimis la ${new Date().toLocaleString('ro-RO')}
    </div>
</body>
</html>
    `;

    try {
        // Trimite email cu atașamente
        console.log(`\n   📧 Subject: ${subject}`);
        console.log(`   📎 Atașamente: ${reports.length}`);

        // IMPORTANT: Nodemailer suportă atașamente multiple
        const attachments = reports.map(r => ({
            filename: path.basename(r.pdfPath),
            path: r.pdfPath
        }));

        const result = await emailService.send({
            subject: subject,
            html: htmlBody,
            attachments: attachments
        });

        if (result.success) {
            console.log(`\n✅ Email trimis cu succes!`);
            console.log(`   Message ID: ${result.messageId}`);
            console.log(`   Atașamente trimise: ${attachments.length}`);
            return { success: true, messageId: result.messageId };
        } else {
            console.error(`\n❌ Eroare trimitere email: ${result.error}`);
            return { success: false, error: result.error };
        }

    } catch (error) {
        console.error(`\n❌ EROARE: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Main function
 */
async function main() {
    const args = process.argv.slice(2);
    const targetMonth = args[0] || getPreviousMonth();

    console.log('='.repeat(60));
    console.log('📧 SEND MONTHLY REPORT - API SMART 5');
    console.log('='.repeat(60));
    console.log(`\n🗓️  Luna raportată: ${getMonthName(targetMonth)}`);

    try {
        // Validează format lună
        if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
            console.error(`\n❌ Format invalid: ${targetMonth}`);
            console.error('   Format așteptat: YYYY-MM (ex: 2026-01)');
            process.exit(1);
        }

        // 1. Generează rapoartele
        const reports = await generateAllReports(targetMonth);

        if (reports.length === 0) {
            console.log('\n⚠️  Nu există notificări pentru această lună');
            console.log('='.repeat(60));
            process.exit(0);
        }

        // 2. Trimite email
        const result = await sendMonthlyReportEmail(targetMonth, reports);

        console.log('\n' + '='.repeat(60));
        if (result.success) {
            console.log('✅ RAPORT LUNAR TRIMIS CU SUCCES!');
        } else {
            console.log('❌ EROARE LA TRIMITERE RAPORT');
        }
        console.log('='.repeat(60));
        console.log('');

    } catch (error) {
        console.error(`\n❌ EROARE: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

// Export pentru utilizare ca modul
module.exports = {
    generateAllReports,
    sendMonthlyReportEmail,
    getPreviousMonth
};

// Rulează direct dacă e apelat ca script
if (require.main === module) {
    main();
}
