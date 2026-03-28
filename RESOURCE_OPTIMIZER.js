/**
 * 🔧 RESOURCE_OPTIMIZER.js
 *
 * Optimizează consumul de resurse pentru a evita blocarea sistemului
 * 
 * MODIFICĂRI:
 * - Limită concurență Puppeteer (max 2 browsere simultan)
 * - Reduce memorie per browser
 * - Adaugă throttling pentru CPU
 * - Cleanup automat
 */

module.exports = {
    // Configurare Puppeteer optimizată
    puppeteerOptimized: {
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Reduce memory usage
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-blink-features=AutomationControlled',
            // LIMITĂRI RESURSE
            '--max-old-space-size=512', // Limită RAM la 512 MB per browser
            '--memory-pressure-off', // Reduce pressure on memory
            '--single-process' // Single process mode (reduce processes)
        ],
        protocolTimeout: 60000, // 60s timeout (mărit de la 30s pentru stabilitate)
        dumpio: false, // Don't pipe browser logs
        pipe: true // Use pipe instead of websocket (faster)
    },

    // Pool de browsere (max 2 concurrent)
    browserPool: {
        maxConcurrent: 2,
        timeout: 45000 // 45s max per operation
    },

    // Delay între operații pentru a reduce load
    delays: {
        betweenRequests: 2000, // 2s între requests
        betweenMatches: 3000, // 3s între meciuri
        onError: 5000 // 5s după eroare
    },

    // Cleanup settings
    cleanup: {
        closeOnError: true,
        maxRetries: 2,
        forceKillAfter: 60000 // Kill browser după 60s dacă nu se închide
    }
};
