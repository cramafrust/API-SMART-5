/**
 * PM2 Ecosystem Config — API SMART 5
 *
 * Beneficii:
 *  - Auto-restart la crash (instant, nu așteaptă următorul cron)
 *  - Restart programat zilnic 08:00 (înlocuiește cron-ul `0 8 * * *`)
 *  - Logs centralizate + rotație automată (cu pm2-logrotate)
 *  - Monitorizare uptime / memorie / restart count
 *
 * COMENZI UZUALE:
 *   pm2 start ecosystem.config.js     — pornește tot
 *   pm2 status                        — vede starea
 *   pm2 logs api-smart-5              — vede logs live
 *   pm2 restart api-smart-5           — restart manual
 *   pm2 reload api-smart-5            — restart zero-downtime
 *   pm2 stop api-smart-5              — oprește
 *   pm2 delete api-smart-5            — scoate din PM2
 *   pm2 save                          — salvează lista (pentru @reboot)
 *   pm2 startup                       — generează comanda pentru auto-start la boot
 */

module.exports = {
    apps: [
        {
            name: 'api-smart-5',
            script: 'API-SMART-5.js',
            args: 'all',
            cwd: '/home/florian/API SMART 5',

            // Auto-restart la crash
            autorestart: true,
            max_restarts: 10,          // după 10 restarturi rapide consecutive, oprește (probabil bug)
            min_uptime: '60s',         // dacă crapă în < 60s, contează ca instabil
            restart_delay: 5000,       // 5s între restarturi

            // Restart zilnic la 08:00 (înlocuiește cron-ul `0 8 * * *` care făcea pkill+start)
            cron_restart: '0 8 * * *',

            // Memorie: dacă depășește 1GB → restart (previne memory leaks)
            max_memory_restart: '1G',

            // Logs centralizate
            error_file: './logs/pm2/api-smart-5-error.log',
            out_file: './logs/pm2/api-smart-5-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            merge_logs: true,

            // Environment (poate fi override-uit cu .env)
            env: {
                NODE_ENV: 'production',
            },

            // Watch dezactivat (sistemul are propriul lifecycle)
            watch: false,
        },
    ],
};
