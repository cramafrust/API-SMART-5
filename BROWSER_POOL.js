/**
 * 🎯 BROWSER POOL MANAGER
 *
 * Limitează numărul de browsere Puppeteer care pot rula simultan
 * pentru a evita blocarea sistemului WSL
 *
 * LIMITĂ: MAX 2 browsere simultan (configurat în RESOURCE_OPTIMIZER)
 * FEATURES:
 * - Tracking real al instanțelor browser (Set)
 * - closeAll() închide efectiv toate browserele
 * - Timeout pe așteptare slot (max 30s)
 * - Guard pe close() — nu crashează dacă browser e deja închis
 * - Periodic GC la fiecare 50 lansări de browser
 * - Kill procese Chrome zombie
 */

const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const ResourceOptimizer = require('./RESOURCE_OPTIMIZER');

const GC_EVERY_N_LAUNCHES = 50; // Forțează GC la fiecare 50 lansări

class BrowserPool {
    constructor() {
        this.maxConcurrent = ResourceOptimizer.browserPool.maxConcurrent;
        this.activeBrowsers = new Set(); // Track real browser instances
        this.maxWaitMs = 30000; // Max 30s așteptare pentru slot liber
        this.launchCount = 0; // Counter total lansări
        console.log(`🔧 Browser Pool inițializat: MAX ${this.maxConcurrent} browsere simultan (GC la fiecare ${GC_EVERY_N_LAUNCHES} lansări)`);
    }

    /**
     * Lansează browser DOAR dacă nu depășește limita
     * Altfel așteaptă în coadă (max 30s)
     */
    async launchBrowser(options = {}) {
        const startWait = Date.now();

        // Așteaptă până când un slot devine disponibil (max 30s)
        while (this.activeBrowsers.size >= this.maxConcurrent) {
            if (Date.now() - startWait > this.maxWaitMs) {
                console.error(`❌ Browser Pool: Timeout ${this.maxWaitMs / 1000}s — niciun slot liber (${this.activeBrowsers.size}/${this.maxConcurrent})`);
                throw new Error(`Browser Pool timeout: ${this.activeBrowsers.size} browsere active, niciun slot liber după ${this.maxWaitMs / 1000}s`);
            }
            console.log(`⏳ Browser Pool: Aștept slot... (${this.activeBrowsers.size}/${this.maxConcurrent} active, ${Math.round((Date.now() - startWait) / 1000)}s)`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        this.launchCount++;

        // Periodic GC
        if (this.launchCount % GC_EVERY_N_LAUNCHES === 0) {
            console.log(`🧹 Browser Pool: GC trigger (lansare #${this.launchCount})`);
            this.performGC();
        }

        console.log(`🚀 Browser Pool: Lansare browser #${this.launchCount} (${this.activeBrowsers.size + 1}/${this.maxConcurrent})`);

        let browser;
        try {
            // Lansează browser cu configurare optimizată
            const launchOptions = {
                ...ResourceOptimizer.puppeteerOptimized,
                ...options
            };

            browser = await puppeteer.launch(launchOptions);
            this.activeBrowsers.add(browser);

            // Wrap close() pentru cleanup automat (inclusiv page.close)
            const originalClose = browser.close.bind(browser);
            browser.close = async () => {
                try {
                    // Închide toate paginile explicit înainte de browser
                    const pages = await browser.pages().catch(() => []);
                    for (const page of pages) {
                        await page.close().catch(() => {});
                    }
                    await originalClose();
                } catch (e) {
                    // Browser deja închis sau crashed — ignorăm
                }
                this.activeBrowsers.delete(browser);
                console.log(`✅ Browser Pool: Browser închis (${this.activeBrowsers.size}/${this.maxConcurrent} rămase)`);
            };

            return browser;

        } catch (error) {
            // Dacă browserul a fost creat dar a eșuat altceva, curățăm
            if (browser) {
                this.activeBrowsers.delete(browser);
                try { await browser.close(); } catch (_) {}
            }
            throw error;
        }
    }

    /**
     * Obține numărul de browsere active
     */
    getActiveCount() {
        return this.activeBrowsers.size;
    }

    /**
     * Forțează garbage collection și kill procese Chrome zombie
     */
    performGC() {
        // Forțează GC dacă e disponibil (node --expose-gc)
        if (global.gc) {
            global.gc();
            console.log('🧹 Browser Pool: Garbage collection forțat');
        }

        // Kill procese Chrome zombie (fără PID tracked)
        try {
            const result = execSync('pgrep -f "chrome.*--type=renderer" 2>/dev/null || true', { encoding: 'utf8' }).trim();
            if (result) {
                const zombiePids = result.split('\n').length;
                if (zombiePids > this.maxConcurrent * 5) {
                    console.log(`🧹 Browser Pool: Detectate ${zombiePids} procese Chrome renderer - cleanup...`);
                    execSync('pkill -f "chrome.*--type=renderer" 2>/dev/null || true');
                }
            }
        } catch (e) {
            // Ignore cleanup errors
        }

        console.log(`📊 Browser Pool: Stats - ${this.launchCount} lansări totale, ${this.activeBrowsers.size} active`);
    }

    /**
     * Închide EFECTIV toate browserele active
     */
    async closeAll() {
        console.log(`🧹 Browser Pool: Închidere ${this.activeBrowsers.size} browsere active...`);
        const closePromises = [];
        for (const browser of this.activeBrowsers) {
            closePromises.push(
                browser.close().catch(e => {
                    console.error(`⚠️  Browser Pool: Eroare la închidere browser: ${e.message}`);
                })
            );
        }
        await Promise.all(closePromises);
        this.activeBrowsers.clear();
        this.performGC();
        console.log(`✅ Browser Pool: Toate browserele închise`);
    }
}

// Export singleton
module.exports = new BrowserPool();
