#!/usr/bin/env node
/**
 * 🛡️ SAFE FILE WRITER - Protecție împotriva suprascrierilor accidentale
 *
 * FOLOSIRE în toate scripturile:
 *
 * const SafeFileWriter = require('./SAFE_FILE_WRITER');
 * const writer = new SafeFileWriter();
 *
 * // În loc de fs.writeFileSync(file, data)
 * writer.safeWrite(file, data, { backup: true, minSize: 10000 });
 */

const fs = require('fs');
const path = require('path');

class SafeFileWriter {
    constructor(options = {}) {
        this.backupDir = options.backupDir || path.join(__dirname, 'backups');
        this.createBackupDir();
    }

    /**
     * Creează director pentru backup-uri
     */
    createBackupDir() {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    /**
     * Obține timestamp pentru backup
     */
    getTimestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');
        const second = String(now.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day}_${hour}-${minute}-${second}`;
    }

    /**
     * Creează backup al fișierului existent
     */
    createBackup(filePath) {
        if (!fs.existsSync(filePath)) {
            return null; // Fișierul nu există, nu e nevoie de backup
        }

        const filename = path.basename(filePath);
        const timestamp = this.getTimestamp();
        const backupFilename = `${filename}.backup-${timestamp}`;
        const backupPath = path.join(this.backupDir, backupFilename);

        fs.copyFileSync(filePath, backupPath);
        console.log(`   💾 Backup creat: ${backupFilename}`);

        return backupPath;
    }

    /**
     * Verifică dacă fișierul nou este valid
     */
    validateNewData(newData, filePath, options = {}) {
        const minSize = options.minSize || 100; // minim 100 bytes
        const requireArray = options.requireArray || false;

        // Verifică dimensiunea
        const newDataStr = typeof newData === 'string' ? newData : JSON.stringify(newData);
        if (newDataStr.length < minSize) {
            throw new Error(`Date prea mici (${newDataStr.length} bytes, minim ${minSize})`);
        }

        // Pentru JSON, verifică structura
        if (options.requireArray) {
            let parsed;
            try {
                parsed = typeof newData === 'string' ? JSON.parse(newData) : newData;
            } catch (err) {
                throw new Error('Date JSON invalide');
            }

            // Dacă e un obiect cu .meciuri, verifică array-ul
            if (parsed.meciuri && Array.isArray(parsed.meciuri)) {
                if (parsed.meciuri.length === 0) {
                    throw new Error('Array-ul de meciuri este gol');
                }
            } else if (Array.isArray(parsed)) {
                if (parsed.length === 0) {
                    throw new Error('Array-ul este gol');
                }
            }
        }

        return true;
    }

    /**
     * Compară dimensiunea fișierului vechi cu cel nou
     */
    compareSize(oldPath, newData) {
        if (!fs.existsSync(oldPath)) {
            return { exists: false };
        }

        const oldSize = fs.statSync(oldPath).size;
        const newDataStr = typeof newData === 'string' ? newData : JSON.stringify(newData, null, 2);
        const newSize = newDataStr.length;

        const ratio = newSize / oldSize;

        return {
            exists: true,
            oldSize,
            newSize,
            ratio,
            significant_loss: ratio < 0.5 // pierdere > 50%
        };
    }

    /**
     * SCRIERE SIGURĂ - cu backup automat și validare
     *
     * @param {string} filePath - calea către fișier
     * @param {string|object} data - date de scris
     * @param {object} options - opțiuni
     *   - backup: true/false (default: true)
     *   - minSize: dimensiune minimă în bytes (default: 100)
     *   - requireArray: verifică dacă e array non-gol (default: false)
     *   - force: scrie fără validări (default: false)
     *   - warnOnly: doar avertizează, nu blochează (default: false)
     */
    safeWrite(filePath, data, options = {}) {
        const opts = {
            backup: true,
            minSize: 100,
            requireArray: false,
            force: false,
            warnOnly: false,
            ...options
        };

        console.log(`\n🛡️  SAFE WRITE: ${path.basename(filePath)}`);

        // 1. Validează datele noi
        if (!opts.force) {
            try {
                this.validateNewData(data, filePath, opts);
                console.log('   ✅ Validare date: OK');
            } catch (err) {
                if (opts.warnOnly) {
                    console.warn(`   ⚠️  Atenție: ${err.message}`);
                } else {
                    console.error(`   ❌ Validare eșuată: ${err.message}`);
                    throw new Error(`SAFE WRITE BLOCAT: ${err.message}`);
                }
            }
        }

        // 2. Compară dimensiunile
        const sizeComp = this.compareSize(filePath, data);
        if (sizeComp.exists) {
            console.log(`   📊 Dimensiune veche: ${(sizeComp.oldSize / 1024).toFixed(1)} KB`);
            console.log(`   📊 Dimensiune nouă: ${(sizeComp.newSize / 1024).toFixed(1)} KB`);
            console.log(`   📊 Raport: ${(sizeComp.ratio * 100).toFixed(0)}%`);

            if (sizeComp.significant_loss && !opts.force) {
                const msg = `PIERDERE SEMNIFICATIVĂ DE DATE (${(sizeComp.ratio * 100).toFixed(0)}% din dimensiunea originală)`;
                if (opts.warnOnly) {
                    console.warn(`   ⚠️  ${msg}`);
                } else {
                    console.error(`   ❌ ${msg}`);
                    throw new Error(`SAFE WRITE BLOCAT: ${msg}`);
                }
            }

            // Verificare număr meciuri: noul fișier nu poate avea MAI PUȚINE meciuri
            if (!opts.force) {
                try {
                    const oldData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    const newParsed = typeof data === 'string' ? JSON.parse(data) : data;
                    const oldCount = oldData.meciuri ? oldData.meciuri.length : 0;
                    const newCount = newParsed.meciuri ? newParsed.meciuri.length : 0;
                    if (oldCount > 10 && newCount < oldCount) {
                        console.error(`   ❌ NUMĂR MECIURI SCĂZUT: ${oldCount} → ${newCount} (pierdere ${oldCount - newCount} meciuri)`);
                        console.log(`   🔄 AUTO-RESTAURARE: caut cel mai bun backup...`);

                        // Caut cel mai bun backup (cel cu cele mai multe meciuri)
                        const filename = path.basename(filePath);
                        const backups = fs.readdirSync(this.backupDir)
                            .filter(f => f.startsWith(filename + '.backup'))
                            .sort().reverse();

                        let restored = false;
                        for (const b of backups.slice(0, 10)) {
                            try {
                                const bData = JSON.parse(fs.readFileSync(path.join(this.backupDir, b), 'utf8'));
                                const bCount = bData.meciuri ? bData.meciuri.length : 0;
                                if (bCount >= oldCount) {
                                    fs.copyFileSync(path.join(this.backupDir, b), filePath);
                                    console.log(`   ✅ RESTAURAT din ${b} (${bCount} meciuri)`);
                                    restored = true;
                                    break;
                                }
                            } catch (e) { /* skip bad backup */ }
                        }

                        if (!restored) {
                            console.log(`   ⚠️  Nu am găsit backup mai bun, păstrez fișierul vechi (${oldCount} meciuri)`);
                        }

                        // Merge: adaugă meciurile noi la fișierul restaurat/vechi
                        const currentData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                        const currentIds = new Set(currentData.meciuri.map(m => m.id_meci || m.matchId));
                        const newMatches = newParsed.meciuri ? newParsed.meciuri.filter(m => {
                            const id = m.id_meci || m.matchId;
                            return id && !currentIds.has(id);
                        }) : [];
                        if (newMatches.length > 0) {
                            currentData.meciuri.push(...newMatches);
                            data = currentData;
                            console.log(`   ➕ Merge: adăugat ${newMatches.length} meciuri noi → total ${currentData.meciuri.length}`);
                        } else {
                            throw new Error(`SAFE WRITE BLOCAT: pierdere meciuri prevenită, fișier restaurat`);
                        }
                    }
                } catch (parseErr) {
                    if (parseErr.message.startsWith('SAFE WRITE BLOCAT')) throw parseErr;
                    // Ignore parse errors on old file
                }
            }
        }

        // 3. Creează backup (dacă există fișierul vechi)
        if (opts.backup && sizeComp.exists) {
            this.createBackup(filePath);
        }

        // 4. Scrie fișierul
        const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        fs.writeFileSync(filePath, dataStr, 'utf8');
        console.log(`   ✅ Fișier salvat: ${path.basename(filePath)}\n`);

        return true;
    }

    /**
     * ADAUGĂ la array existent (pentru colectare date zilnice)
     *
     * @param {string} filePath - calea către fișier JSON cu array
     * @param {object|array} newMatches - meciuri noi de adăugat
     * @param {object} options - opțiuni
     *   - backup: true/false (default: true)
     *   - deduplicateBy: cheie pentru deduplicare (ex: 'id_meci')
     */
    appendToArray(filePath, newMatches, options = {}) {
        const opts = {
            backup: true,
            deduplicateBy: 'id_meci',
            ...options
        };

        console.log(`\n➕ APPEND TO ARRAY: ${path.basename(filePath)}`);

        // Încarcă fișierul existent sau creează array nou
        let existingData = { meciuri: [] };
        if (fs.existsSync(filePath)) {
            existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            console.log(`   📂 Fișier existent: ${existingData.meciuri.length} meciuri`);
        } else {
            console.log(`   📂 Fișier nou (nu există încă)`);
        }

        // Normalizează newMatches ca array
        const matchesToAdd = Array.isArray(newMatches) ? newMatches : [newMatches];
        console.log(`   ➕ Meciuri noi de adăugat: ${matchesToAdd.length}`);

        // Deduplicare
        const existingIds = new Set(
            existingData.meciuri.map(m => m[opts.deduplicateBy])
        );

        const uniqueMatches = matchesToAdd.filter(m => {
            return !existingIds.has(m[opts.deduplicateBy]);
        });

        if (uniqueMatches.length < matchesToAdd.length) {
            console.log(`   🔄 Duplicate găsite: ${matchesToAdd.length - uniqueMatches.length} ignorat(e)`);
        }

        // Adaugă meciurile unice
        existingData.meciuri.push(...uniqueMatches);
        console.log(`   ✅ Total după adăugare: ${existingData.meciuri.length} meciuri`);

        // Salvează folosind safeWrite
        return this.safeWrite(filePath, existingData, {
            backup: opts.backup,
            minSize: 200,
            requireArray: true
        });
    }

    /**
     * Curăță backup-urile vechi (păstrează doar ultimele N)
     */
    cleanOldBackups(keepLast = 10) {
        console.log(`\n🧹 Curățare backup-uri vechi (păstrare ultimele ${keepLast})...`);

        const files = fs.readdirSync(this.backupDir)
            .filter(f => f.includes('.backup-'))
            .map(f => ({
                name: f,
                path: path.join(this.backupDir, f),
                mtime: fs.statSync(path.join(this.backupDir, f)).mtime
            }))
            .sort((a, b) => b.mtime - a.mtime); // sort descrescător

        if (files.length <= keepLast) {
            console.log(`   ℹ️  Total backup-uri: ${files.length} (sub limită)`);
            return;
        }

        const toDelete = files.slice(keepLast);
        console.log(`   🗑️  Ștergere: ${toDelete.length} backup-uri vechi`);

        toDelete.forEach(f => {
            fs.unlinkSync(f.path);
            console.log(`      - ${f.name}`);
        });

        console.log(`   ✅ Backup-uri rămase: ${keepLast}\n`);
    }
}

module.exports = SafeFileWriter;

// Test dacă e rulat direct
if (require.main === module) {
    const writer = new SafeFileWriter();

    console.log('🛡️  SAFE FILE WRITER - Sistem de Protecție\n');
    console.log('Folosire în scripturi:');
    console.log('');
    console.log('const SafeFileWriter = require(\'./SAFE_FILE_WRITER\');');
    console.log('const writer = new SafeFileWriter();');
    console.log('');
    console.log('// Scriere sigură');
    console.log('writer.safeWrite(filePath, data, { backup: true, minSize: 10000 });');
    console.log('');
    console.log('// Adăugare la array');
    console.log('writer.appendToArray(filePath, newMatches, { deduplicateBy: \'id_meci\' });');
    console.log('');
}
