/**
 * LIFECYCLE MANAGER
 *
 * Gestionare centralizată pentru TOATE timer-ele (setInterval/setTimeout)
 * Rezolvă problema memory leaks (91 timers fără cleanup)
 *
 * Features:
 * - Tracking automat pentru toate interval-ele/timeout-urile
 * - Previne duplicate (cleanup automat la re-pornire)
 * - Cleanup global la SIGINT/SIGTERM
 * - Monitoring activ timers
 */

class LifecycleManager {
    constructor() {
        this.intervals = new Map();
        this.timeouts = new Map();
        this.isShuttingDown = false;

        // Setup cleanup handlers
        this.setupCleanupHandlers();
    }

    /**
     * Setează interval cu tracking automat
     * @param {string} name - Nume identificator unic
     * @param {function} callback - Funcția de executat
     * @param {number} delay - Delay în ms
     * @returns {NodeJS.Timeout} - Timer ID
     */
    setInterval(name, callback, delay) {
        // Cleanup existent dacă există
        if (this.intervals.has(name)) {
            console.warn(`⚠️  Interval '${name}' există deja - cleanup automat`);
            clearInterval(this.intervals.get(name));
        }

        const id = setInterval(callback, delay);
        this.intervals.set(name, id);
        console.log(`✅ Interval pornit: ${name} (${delay}ms)`);
        return id;
    }

    /**
     * Setează timeout cu tracking automat
     * @param {string} name - Nume identificator unic
     * @param {function} callback - Funcția de executat
     * @param {number} delay - Delay în ms
     * @returns {NodeJS.Timeout} - Timer ID
     */
    setTimeout(name, callback, delay) {
        // Cleanup existent dacă există
        if (this.timeouts.has(name)) {
            console.warn(`⚠️  Timeout '${name}' există deja - cleanup automat`);
            clearTimeout(this.timeouts.get(name));
        }

        const id = setTimeout(() => {
            callback();
            // Auto-remove după executare
            this.timeouts.delete(name);
        }, delay);

        this.timeouts.set(name, id);
        console.log(`⏲️  Timeout setat: ${name} (${delay}ms)`);
        return id;
    }

    /**
     * Oprește un interval specific
     * @param {string} name - Numele interval-ului
     */
    clearInterval(name) {
        if (this.intervals.has(name)) {
            clearInterval(this.intervals.get(name));
            this.intervals.delete(name);
            console.log(`🛑 Interval oprit: ${name}`);
            return true;
        }
        return false;
    }

    /**
     * Oprește un timeout specific
     * @param {string} name - Numele timeout-ului
     */
    clearTimeout(name) {
        if (this.timeouts.has(name)) {
            clearTimeout(this.timeouts.get(name));
            this.timeouts.delete(name);
            console.log(`🛑 Timeout oprit: ${name}`);
            return true;
        }
        return false;
    }

    /**
     * Returnează lista timer-elor active
     */
    getActiveTimers() {
        return {
            intervals: Array.from(this.intervals.keys()),
            timeouts: Array.from(this.timeouts.keys()),
            total: this.intervals.size + this.timeouts.size
        };
    }

    /**
     * Afișează statistici timers activi
     */
    displayStats() {
        console.log('\n📊 LIFECYCLE MANAGER - Timers activi:');
        console.log(`   Intervals: ${this.intervals.size}`);
        if (this.intervals.size > 0) {
            console.log(`   └─ ${Array.from(this.intervals.keys()).join(', ')}`);
        }
        console.log(`   Timeouts: ${this.timeouts.size}`);
        if (this.timeouts.size > 0) {
            console.log(`   └─ ${Array.from(this.timeouts.keys()).join(', ')}`);
        }
        console.log(`   Total: ${this.intervals.size + this.timeouts.size}\n`);
    }

    /**
     * Cleanup TOATE timer-ele
     */
    clearAll() {
        console.log(`\n🧹 LIFECYCLE MANAGER - Cleanup total...`);
        console.log(`   Opresc ${this.intervals.size} interval(e)`);
        console.log(`   Opresc ${this.timeouts.size} timeout(uri)`);

        // Clear intervals
        this.intervals.forEach((id, name) => {
            clearInterval(id);
            console.log(`   ✓ Interval oprit: ${name}`);
        });
        this.intervals.clear();

        // Clear timeouts
        this.timeouts.forEach((id, name) => {
            clearTimeout(id);
            console.log(`   ✓ Timeout oprit: ${name}`);
        });
        this.timeouts.clear();

        console.log(`✅ Cleanup complet!\n`);
    }

    /**
     * Setup cleanup handlers pentru SIGINT/SIGTERM
     */
    setupCleanupHandlers() {
        const cleanup = () => {
            if (this.isShuttingDown) {
                return; // Prevent multiple cleanup calls
            }

            this.isShuttingDown = true;
            console.log('\n\n🛑 OPRIRE SISTEM - Cleanup timers...\n');
            this.clearAll();

            // Exit după cleanup
            setTimeout(() => {
                process.exit(0);
            }, 100);
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        // Optional: cleanup la uncaughtException
        process.on('uncaughtException', (error) => {
            console.error('❌ UNCAUGHT EXCEPTION:', error);
            cleanup();
        });

        // Handler pentru unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ UNHANDLED REJECTION:', reason);
        });
    }
}

// Export singleton
module.exports = new LifecycleManager();
