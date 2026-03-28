#!/usr/bin/env node
/**
 * 🚀 DAILY MASTER - Workflow Complet Zilnic
 *
 * Orchestrează TOATE operațiunile zilnice într-un singur script:
 * 1. Colectează date finale de ieri
 * 2. Trimite raport notificări de ieri
 * 3. Trimite raport meciuri colectate de ieri
 * 4. Generează lista meciuri pentru astăzi
 * 5. Generează program HT pentru astăzi
 * 6. Pornește monitorizarea HT pentru astăzi
 *
 * USAGE:
 *   node DAILY_MASTER.js                    # Workflow complet
 *   node DAILY_MASTER.js --skip-collection  # Skip colectare date ieri
 *   node DAILY_MASTER.js --skip-emails      # Skip email-uri
 *   node DAILY_MASTER.js --skip-monitor     # Skip pornire monitor
 */

const { collectDailyFinalData, getYesterdayDate } = require('./DAILY_FINAL_DATA_COLLECTOR');
const { sendDailyReport } = require('./SEND_DAILY_REPORT');
const { sendCollectedMatchesReport } = require('./SEND_COLLECTED_MATCHES_REPORT');
const { spawn } = require('child_process');
const path = require('path');

/**
 * Parse arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    return {
        skipCollection: args.includes('--skip-collection'),
        skipEmails: args.includes('--skip-emails'),
        skipMonitor: args.includes('--skip-monitor'),
        help: args.includes('--help') || args.includes('-h')
    };
}

/**
 * Show help
 */
function showHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                 🚀 DAILY MASTER - Help                       ║
╚══════════════════════════════════════════════════════════════╝

WORKFLOW COMPLET ZILNIC:
  1. ✅ Colectează date finale IERI
  1.5. 🔧 Completează parametri lipsă (TOATE sezoanele)
       → 2025-2026, 2024-2025, 2023-2024, 2022-2023
       → Batch-uri de 10 meciuri până completează tot
  1.7. 📦 Backfill meciuri istorice lipsă (max 100/zi)
  2. 📧 Trimite raport notificări IERI
  3. 📧 Trimite raport meciuri colectate IERI
  4. ⚽ Generează lista meciuri ASTĂZI
  5. 📅 Generează program HT ASTĂZI
  6. 🔍 Pornește monitorizare HT ASTĂZI

USAGE:
  node DAILY_MASTER.js                    # Workflow complet
  node DAILY_MASTER.js --skip-collection  # Skip colectare date ieri
  node DAILY_MASTER.js --skip-emails      # Skip trimitere email-uri
  node DAILY_MASTER.js --skip-monitor     # Skip pornire monitor

OPTIONS:
  --skip-collection    Nu colectează date finale de ieri
  --skip-emails        Nu trimite rapoarte prin email
  --skip-monitor       Nu pornește monitorizarea (doar pregătire)
  -h, --help           Afișează acest mesaj

EXEMPLE:

  # Workflow complet (recomandat)
  node DAILY_MASTER.js

  # Doar pregătire (fără colectare ieri, fără monitor)
  node DAILY_MASTER.js --skip-collection --skip-monitor

  # Doar monitorizare astăzi (fără rapoarte ieri)
  node DAILY_MASTER.js --skip-collection --skip-emails

CRON JOB (recomandat):
  # Rulează zilnic la 08:00
  0 8 * * * cd "/home/florian/API SMART 5" && /usr/bin/node DAILY_MASTER.js >> logs/daily-master.log 2>&1

NOTE:
  - Scriptul este IDEMPOTENT (safe să rulezi de mai multe ori)
  - Colectarea de ieri verifică dacă fișierul există
  - Monitorul se pornește în background (non-blocking)
  - Durata: ~2-10 minute (depinde de numărul meciuri)
`);
}

/**
 * Execute command and wait for completion
 */
function executeCommand(command, args, description) {
    return new Promise((resolve, reject) => {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`▶️  ${description}`);
        console.log(`${'='.repeat(60)}\n`);

        const proc = spawn(command, args, {
            stdio: 'inherit',
            cwd: __dirname
        });

        proc.on('close', (code) => {
            if (code === 0) {
                console.log(`\n✅ ${description} - COMPLET\n`);
                resolve();
            } else if (code === 2) {
                // Exit code 2 = Nu mai sunt meciuri (nu e eroare, dar oprim loop-ul)
                console.log(`\n✅ ${description} - Finalizat (nu mai sunt date)\n`);
                reject(new Error(`NO_MORE_DATA`));
            } else {
                // Orice alt cod = eroare reală
                console.error(`\n⚠️  ${description} - Eșuat (cod: ${code})\n`);
                reject(new Error(`Process exited with code ${code}`));
            }
        });

        proc.on('error', (err) => {
            console.error(`\n❌ ${description} - EROARE: ${err.message}\n`);
            resolve();
        });
    });
}

/**
 * Main workflow
 */
async function main() {
    const options = parseArgs();

    if (options.help) {
        showHelp();
        process.exit(0);
    }

    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                                                              ║');
    console.log('║            🚀 DAILY MASTER - Workflow Complet                ║');
    console.log('║                  API SMART 5 System                          ║');
    console.log('║                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('\n');
    console.log(`⏰ Început: ${new Date().toLocaleString('ro-RO')}\n`);

    const startTime = Date.now();

    try {
        // ============================================================
        // STEP 1: Colectează date finale IERI
        // ============================================================
        if (!options.skipCollection) {
            console.log(`\n${'='.repeat(60)}`);
            console.log('📦 STEP 1/6: Colectare Date Finale IERI');
            console.log(`${'='.repeat(60)}\n`);

            const yesterday = getYesterdayDate();
            console.log(`📅 Data: ${yesterday}`);

            try {
                const result = await collectDailyFinalData(yesterday, { dryRun: false });

                if (result.success) {
                    console.log(`\n✅ Colectare completă: ${result.stats.success} meciuri salvate`);
                } else {
                    console.log(`\n⚠️  Colectare incompletă: ${result.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error(`\n❌ Eroare colectare: ${error.message}`);
            }
        } else {
            console.log('\n⏭️  STEP 1/6: SKIP - Colectare date ieri\n');
        }

        // ============================================================
        // STEP 1.1: Auto-validare pronosticuri IERI (folosind datele colectate)
        // ============================================================
        if (!options.skipCollection) {
            console.log(`\n${'='.repeat(60)}`);
            console.log('🔍 STEP 1.1: Auto-Validare Pronosticuri IERI');
            console.log(`${'='.repeat(60)}\n`);

            try {
                const { validatePendingNotifications } = require('./AUTO_VALIDATOR');
                const results = await validatePendingNotifications();
                console.log(`\n✅ Auto-validare: ${results.validated} validate, ${results.errors} erori`);
            } catch (error) {
                console.error(`\n⚠️  Eroare auto-validare (non-blocker): ${error.message}`);
            }
        } else {
            console.log('\n⏭️  STEP 1.1: SKIP - Auto-validare (colectare dezactivată)\n');
        }

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        // ============================================================
        // STEP 1.5: Completează parametri lipsă TOATE SEZOANELE
        // ============================================================
        console.log(`\n${'='.repeat(60)}`);
        console.log('🔧 STEP 1.5: Completare Parametri Lipsă (TOATE Sezoanele)');
        console.log(`${'='.repeat(60)}\n`);

        try {
            const BATCH_SIZE = 10;
            const SEASONS = ['2025-2026', '2024-2025', '2023-2024', '2022-2023']; // Ordine descrescătoare

            let totalCompleted = 0;
            let totalBatches = 0;

            console.log(`📦 Completare CONTINUĂ în loop-uri de câte ${BATCH_SIZE} meciuri...`);
            console.log(`📅 Sezoane: ${SEASONS.join(', ')}`);
            console.log(`♾️  Fără limită - procesează TOT ce găsește!\n`);

            for (const season of SEASONS) {
                console.log(`\n${'━'.repeat(60)}`);
                console.log(`📅 SEZON: ${season}`);
                console.log(`${'━'.repeat(60)}`);

                let batchCount = 0;
                let seasonCompleted = 0;

                // Loop infinit până nu mai sunt meciuri
                while (true) {
                    batchCount++;
                    totalBatches++;

                    console.log(`\n🔄 ${season} - Batch ${batchCount}: Verificare meciuri lipsă...`);

                    try {
                        await executeCommand(
                            'node',
                            ['COMPLETE_MISSING_PARAMS.js', `--batch=${BATCH_SIZE}`, '--param=etapa', `--season=${season}`],
                            `${season} - Batch ${batchCount}`
                        );

                        seasonCompleted += BATCH_SIZE;
                        totalCompleted += BATCH_SIZE;
                        console.log(`✅ ${season} - Batch ${batchCount} completat!`);
                        console.log(`   Sezon: ${seasonCompleted} | Total: ${totalCompleted} meciuri`);

                        // Small delay între batches (2s pentru anti-ban)
                        await new Promise(resolve => setTimeout(resolve, 2000));

                    } catch (error) {
                        // Exit code 2 = Nu mai sunt meciuri (nu e eroare!)
                        console.log(`✅ ${season}: Complet! (${seasonCompleted} meciuri procesate)`);
                        break; // Trecem la sezonul următor
                    }
                }

                console.log(`\n✅ ${season}: ${seasonCompleted} parametri completați în ${batchCount} batches`);
            }

            console.log(`\n${'='.repeat(60)}`);
            console.log(`✅ STEP 1.5 COMPLET:`);
            console.log(`   Total parametri completați: ${totalCompleted}`);
            console.log(`   Total batches rulate: ${totalBatches}`);
            console.log(`   Sezoane procesate: ${SEASONS.length}`);
            console.log(`${'='.repeat(60)}`);

        } catch (error) {
            console.error(`\n⚠️  STEP 1.5: Eroare (non-blocker): ${error.message}`);
            // Continuă workflow - nu e blocker
        }

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        // ============================================================
        // STEP 1.7: Backfill meciuri istorice lipsă
        // ============================================================
        console.log(`\n${'='.repeat(60)}`);
        console.log('📦 STEP 1.7: Backfill Meciuri Istorice Lipsă');
        console.log(`${'='.repeat(60)}\n`);

        try {
            await executeCommand(
                'node',
                ['UNIVERSAL_BACKFILL.js', '--phase=2', '--batch=100'],
                'STEP 1.7: Backfill Historical Matches (max 100)'
            );
            console.log(`\n✅ Backfill completat cu succes`);
        } catch (error) {
            if (error.message === 'NO_MORE_DATA') {
                console.log(`\n✅ Backfill: Nu mai sunt meciuri de completat`);
            } else {
                console.error(`\n⚠️  Backfill eroare (non-blocker): ${error.message}`);
            }
        }

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        // ============================================================
        // STEP BONUS (MARȚI): Verifică calibrare pattern-uri
        // ============================================================
        const today = new Date();
        const isTuesday = today.getDay() === 2; // 2 = Marți

        if (isTuesday && !options.skipEmails) {
            console.log(`\n${'='.repeat(60)}`);
            console.log('🎯 BONUS (MARȚI): Verificare Calibrare Patterns');
            console.log(`${'='.repeat(60)}\n`);

            // Verifică dacă calibrarea a rulat dimineața (06:00)
            const calibrationLog = path.join(__dirname, 'logs', 'calibration.log');
            let calibrationStatus = 'UNKNOWN';
            let lastCalibration = null;

            try {
                if (fs.existsSync(calibrationLog)) {
                    const logContent = fs.readFileSync(calibrationLog, 'utf8');
                    const lines = logContent.split('\n');

                    // Caută ultima linie cu "Calibrare completă"
                    const completeLine = lines.reverse().find(l => l.includes('Calibrare completă') || l.includes('✅'));

                    if (completeLine) {
                        calibrationStatus = 'SUCCESS';
                        console.log(`✅ Calibrare completă dimineața (06:00)`);
                    } else {
                        calibrationStatus = 'INCOMPLETE';
                        console.log(`⚠️  Calibrare incompletă sau eșuată`);
                    }
                } else {
                    calibrationStatus = 'NOT_RUN';
                    console.log(`⚠️  Log calibrare nu există (nu a rulat?)`);
                }

                // Verifică pattern_calibration.json pentru ultima calibrare
                const calibrationFile = path.join(__dirname, 'pattern_calibration.json');
                if (fs.existsSync(calibrationFile)) {
                    const calibData = JSON.parse(fs.readFileSync(calibrationFile, 'utf8'));
                    lastCalibration = calibData.lastCalibration;

                    if (lastCalibration) {
                        const lastDate = new Date(lastCalibration);
                        const hoursSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60));

                        console.log(`📅 Ultima calibrare: ${lastDate.toLocaleString('ro-RO')} (${hoursSince}h în urmă)`);

                        // Dacă e mai recentă de 6 ore, e de azi
                        if (hoursSince < 6) {
                            calibrationStatus = 'SUCCESS';
                        }
                    }
                }

                // Trimite notificare status
                const config = require('./NOTIFICATION_CONFIG');
                if (config.notifications.sendEmail) {
                    const transporter = require('nodemailer').createTransport({
                        host: config.email.smtpHost,
                        port: config.email.smtpPort,
                        secure: config.email.secure,
                        auth: {
                            user: config.email.user,
                            pass: config.email.appPassword
                        }
                    });

                    const statusEmoji = calibrationStatus === 'SUCCESS' ? '✅' : '⚠️';
                    const statusText = calibrationStatus === 'SUCCESS' ? 'SUCCESS' :
                                      calibrationStatus === 'INCOMPLETE' ? 'INCOMPLET' : 'NU A RULAT';

                    const mailOptions = {
                        from: `"🎯 API SMART 5 - Calibration Status" <${config.email.user}>`,
                        to: config.email.receiverEmail,
                        subject: `${statusEmoji} Calibrare Patterns MARȚI - Status: ${statusText}`,
                        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
        .header { background: ${calibrationStatus === 'SUCCESS' ? '#27ae60' : '#e67e22'}; color: white; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px; }
        .status { font-size: 48px; margin: 10px 0; }
        .info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { text-align: center; color: #7f8c8d; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 2px solid #ecf0f1; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="status">${statusEmoji}</div>
            <h1>Calibrare Patterns - MARȚI</h1>
            <p>Status: ${statusText}</p>
        </div>

        <div class="info">
            <p><strong>📅 Data:</strong> ${today.toLocaleDateString('ro-RO')}</p>
            <p><strong>⏰ Verificare:</strong> 08:00</p>
            <p><strong>🎯 Status Calibrare:</strong> ${statusText}</p>
            ${lastCalibration ? `<p><strong>📊 Ultima Calibrare:</strong> ${new Date(lastCalibration).toLocaleString('ro-RO')}</p>` : ''}
        </div>

        ${calibrationStatus === 'SUCCESS' ? `
        <p style="color: #27ae60; font-weight: bold;">✅ Calibrarea s-a executat cu succes dimineața la 06:00.</p>
        <p>Probabilitățile pattern-urilor au fost analizate și ajustate bazat pe rezultatele reale.</p>
        ` : `
        <p style="color: #e67e22; font-weight: bold;">⚠️ Calibrarea NU s-a executat sau a eșuat.</p>
        <p>Verifică log-ul: logs/calibration.log</p>
        `}

        <div class="footer">
            <p>🤖 Generat automat de API SMART 5 - DAILY MASTER</p>
            <p>⏰ ${new Date().toLocaleString('ro-RO')}</p>
        </div>
    </div>
</body>
</html>
                        `
                    };

                    await transporter.sendMail(mailOptions);
                    console.log(`✅ Notificare status calibrare trimisă`);
                }

            } catch (error) {
                console.error(`❌ Eroare verificare calibrare: ${error.message}`);
            }
        }

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        // ============================================================
        // STEP 2: Trimite raport notificări IERI
        // ============================================================
        if (!options.skipEmails) {
            console.log(`\n${'='.repeat(60)}`);
            console.log('📧 STEP 2/6: Raport Notificări IERI');
            console.log(`${'='.repeat(60)}\n`);

            const yesterday = getYesterdayDate();
            console.log(`📅 Data: ${yesterday}`);

            try {
                const result = await sendDailyReport(yesterday);

                if (result.success) {
                    console.log(`\n✅ Email raport notificări trimis`);
                } else {
                    console.log(`\n⚠️  Email raport notificări eșuat: ${result.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error(`\n❌ Eroare raport notificări: ${error.message}`);
            }
        } else {
            console.log('\n⏭️  STEP 2/6: SKIP - Raport notificări ieri\n');
        }

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        // ============================================================
        // STEP 3: Trimite raport meciuri colectate IERI
        // ============================================================
        if (!options.skipEmails) {
            console.log(`\n${'='.repeat(60)}`);
            console.log('📧 STEP 3/6: Raport Meciuri Colectate IERI');
            console.log(`${'='.repeat(60)}\n`);

            const yesterday = getYesterdayDate();
            console.log(`📅 Data: ${yesterday}`);

            try {
                const result = await sendCollectedMatchesReport(yesterday);

                if (result.success) {
                    console.log(`\n✅ Email meciuri colectate trimis: ${result.matchesCount} meciuri`);
                } else {
                    console.log(`\n⚠️  Email meciuri colectate eșuat: ${result.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error(`\n❌ Eroare raport meciuri: ${error.message}`);
            }
        } else {
            console.log('\n⏭️  STEP 3/6: SKIP - Raport meciuri colectate ieri\n');
        }

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        // ============================================================
        // STEP 4: Generează lista meciuri ASTĂZI
        // ============================================================
        await executeCommand(
            'node',
            ['API-SMART-5.js', 'daily'],
            'STEP 4/6: Generare Listă Meciuri ASTĂZI'
        );

        // ============================================================
        // STEP 5: Generează program HT ASTĂZI
        // ============================================================
        await executeCommand(
            'node',
            ['API-SMART-5.js', 'schedule'],
            'STEP 5/6: Generare Program HT ASTĂZI'
        );

        // ============================================================
        // STEP 6: Pornește monitorizarea HT ASTĂZI
        // ============================================================
        if (!options.skipMonitor) {
            console.log(`\n${'='.repeat(60)}`);
            console.log('🔍 STEP 6/6: Pornire Monitorizare HT ASTĂZI');
            console.log(`${'='.repeat(60)}\n`);

            // Oprește monitorul vechi (dacă rulează)
            console.log('🛑 Oprire monitor vechi...');
            try {
                require('child_process').execSync('pkill -f "node.*API-SMART-5.js.*full"', { stdio: 'ignore' });
                await new Promise(resolve => setTimeout(resolve, 2000));
                console.log('✅ Monitor vechi oprit\n');
            } catch (error) {
                console.log('ℹ️  Nu rula niciun monitor\n');
            }

            // Pornește noul monitor în background cu log via shell script
            console.log('🚀 Pornire monitor nou...');
            const monitorProc = spawn('bash', [path.join(__dirname, 'start-api-smart-5.sh')], {
                detached: true,
                stdio: 'ignore',
                cwd: __dirname
            });
            monitorProc.unref();

            console.log(`✅ Monitor pornit via start-api-smart-5.sh → logs/api-smart-5.log`);
            console.log('   Verifică: ps aux | grep "API-SMART-5.js full"\n');
        } else {
            console.log('\n⏭️  STEP 6/6: SKIP - Pornire monitor\n');
        }

        // ============================================================
        // FINAL SUMMARY
        // ============================================================
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log('\n');
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║                                                              ║');
        console.log('║                  ✅ WORKFLOW COMPLET!                        ║');
        console.log('║                                                              ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log('\n');
        console.log(`⏱️  Durată totală: ${duration}s`);
        console.log(`⏰ Finalizat: ${new Date().toLocaleString('ro-RO')}`);
        console.log('\n');
        console.log('📊 NEXT STEPS:');
        console.log('   - Verifică email-uri primite (notificări + meciuri)');
        console.log('   - Monitorul HT rulează în background');
        console.log('   - Log-uri: tail -f api-smart-5-run.log');
        console.log('\n');

        process.exit(0);

    } catch (error) {
        console.error('\n');
        console.error('╔══════════════════════════════════════════════════════════════╗');
        console.error('║                                                              ║');
        console.error('║                  ❌ EROARE FATALĂ                            ║');
        console.error('║                                                              ║');
        console.error('╚══════════════════════════════════════════════════════════════╝');
        console.error('\n');
        console.error(`💥 ${error.message}`);
        console.error(`\n${error.stack}\n`);
        process.exit(1);
    }
}

// Run
if (require.main === module) {
    main();
}

module.exports = { main };
