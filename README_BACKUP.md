# 📦 SISTEM BACKUP - API SMART 5

## 📋 Ce Este Sistemul de Backup?

Sistemul de backup crează **arhive complete** ale întregului API SMART 5:
- ✅ **Cod sursă** (toate fișierele .js)
- ✅ **Documentație** (toate fișierele .md)
- ✅ **Date** (JSON-uri cu notificări, meciuri, validări)
- ✅ **Configurare** (package.json, .env, NOTIFICATION_CONFIG.js)
- ✅ **Log-uri** (ultimele 7 zile)

**Arhiva:** `.tar.gz` comprimată (7-10 MB)

---

## 🚀 UTILIZARE RAPIDĂ

### Creare Backup
```bash
cd "/home/florian/API SMART 5"
./BACKUP_SYSTEM.sh
```

**Rezultat:**
- Arhivă: `~/API_SMART_5_BACKUPS/API_SMART_5_backup_YYYYMMDD_HHMMSS.tar.gz`
- Dimensiune: ~7-10 MB
- Conținut: Tot sistemul (cod + date + config)

### Restaurare Backup
```bash
cd "/home/florian/API SMART 5"
./RESTORE_BACKUP.sh
```

**Pași:**
1. Selectează backup-ul din listă
2. Confirmă restaurarea (scrie `yes`)
3. Verifică fișierele restaurate
4. Repornește sistemul

---

## 📊 Ce Conține Backup-ul?

### 1. Cod Sursă (~151 fișiere .js)
```
API-SMART-5.js
STATS_MONITOR.js
ODDS_MONITOR_SIMPLE.js
NOTIFICATION_TRACKER.js
EMAIL_SERVICE.js
TOP_LEAGUES.js
flashscore-api.js
+ toate celelalte module
+ superbet-analyzer/*.js
```

### 2. Documentație (~55 fișiere .md)
```
DOCUMENTATIE-COMPLETA-API-SMART-5.md (3320+ linii)
README_API_SMART_5.md
CHANGELOG_01_02_2026.md
START_HERE.md
+ toate README-urile
+ toate RAPORT-urile
```

### 3. Date JSON (~17 fișiere)
```
notifications_tracking.json (CRITIC - toate notificările)
odds_validation_1.5.json (pronosticuri pentru validare)
JSON PROCENTE AUTOACTUAL.json (statistici pattern-uri)
meciuri-*.json (ultimele 7 zile)
verificari-*.json (ultimele 7 zile)
```

### 4. Configurare
```
package.json
NOTIFICATION_CONFIG.js (⚠️ CONFIDENȚIAL - conține parole)
.env (⚠️ CONFIDENȚIAL - dacă există)
```

### 5. Log-uri (ultimele 7 zile)
```
logs/combined.log
logs/api-smart-5-run.log
+ toate log-urile recente
```

---

## ⚙️ Funcții Avansate

### Cleanup Automat
Sistemul păstrează **maxim 10 backup-uri**. Când ajungi la 11, șterge automat cele mai vechi.

**Locație backup-uri:**
```bash
cd ~/API_SMART_5_BACKUPS
ls -lht
```

### Backup Manual cu Data Specifică
```bash
cd "/home/florian/API SMART 5"
./BACKUP_SYSTEM.sh
cp ~/API_SMART_5_BACKUPS/API_SMART_5_backup_*.tar.gz ./BACKUP_01_02_2026.tar.gz
```

### Verificare Conținut Backup (fără restaurare)
```bash
tar -tzf ~/API_SMART_5_BACKUPS/API_SMART_5_backup_20260201_015718.tar.gz | head -20
```

### Extragere Selectivă (doar anumite fișiere)
```bash
# Extrage doar notifications_tracking.json
tar -xzf backup.tar.gz --wildcards '*/notifications_tracking.json'

# Extrage doar documentația
tar -xzf backup.tar.gz --wildcards '*.md'
```

---

## 🔒 SECURITATE

### ⚠️ ATENȚIE - Fișiere Confidențiale

Backup-ul conține **PAROLE ȘI DATE SENSIBILE:**

1. **NOTIFICATION_CONFIG.js**
   - Email Gmail + App Password
   - ⚠️ NU urca pe GitHub
   - ⚠️ NU trimite prin email nesecurizat

2. **.env** (dacă există)
   - Variabile de mediu
   - Eventual API keys

### Recomandări Securitate

✅ **Păstrează backup-uri:**
- Pe hard disk local (nu cloud public)
- Pe stick USB extern (offline)
- Pe server privat (cu acces restricționat)

❌ **NU urca backup-uri:**
- Pe GitHub/GitLab public
- Pe Google Drive/Dropbox public
- Pe servicii cloud fără criptare

### Criptare Backup (opțional)

Pentru securitate maximă, criptează arhiva:

```bash
# Criptare cu GPG
gpg -c ~/API_SMART_5_BACKUPS/API_SMART_5_backup_20260201_015718.tar.gz

# Rezultat: API_SMART_5_backup_20260201_015718.tar.gz.gpg (criptat)

# Decriptare
gpg -d backup.tar.gz.gpg > backup.tar.gz
```

---

## 📅 Program Backup Automat (Cron)

### Setup Cron - Backup Zilnic la 03:00

```bash
# Editează crontab
crontab -e

# Adaugă linia (backup zilnic la 3 dimineața):
0 3 * * * cd "/home/florian/API SMART 5" && ./BACKUP_SYSTEM.sh >> /home/florian/backup.log 2>&1
```

### Setup Cron - Backup Săptămânal (Duminica 02:00)

```bash
0 2 * * 0 cd "/home/florian/API SMART 5" && ./BACKUP_SYSTEM.sh >> /home/florian/backup.log 2>&1
```

### Verificare Cron Jobs

```bash
crontab -l
```

---

## 🔧 Troubleshooting

### Problema: Script nu rulează
```bash
chmod +x BACKUP_SYSTEM.sh
chmod +x RESTORE_BACKUP.sh
```

### Problema: "Permission denied"
```bash
# Verifică permisiuni
ls -l BACKUP_SYSTEM.sh

# Dă permisiuni execuție
chmod 755 BACKUP_SYSTEM.sh
```

### Problema: Backup prea mare
Backup-ul include log-uri din ultimele 7 zile. Pentru backup mai mic:

```bash
# Editează BACKUP_SYSTEM.sh, linia cu -mtime:
find "${SCRIPT_DIR}/logs" -name "*.log" -mtime -3  # doar 3 zile

# Sau exclude log-urile complet (comentează secțiunea 5)
```

### Problema: Lipsesc fișiere în backup
Verifică conținutul arhivei:

```bash
tar -tzf backup.tar.gz | grep "notifications_tracking"
```

---

## 📈 Monitorizare Backup-uri

### Verificare Ultimul Backup
```bash
ls -lht ~/API_SMART_5_BACKUPS/ | head -5
```

### Spațiu Ocupat
```bash
du -sh ~/API_SMART_5_BACKUPS/
```

### Număr Backup-uri
```bash
ls -1 ~/API_SMART_5_BACKUPS/*.tar.gz | wc -l
```

---

## 🎯 Scenarii de Utilizare

### Scenariul 1: Înainte de Update/Modificări
```bash
# Crează backup ÎNAINTE de modificări majore
./BACKUP_SYSTEM.sh

# Modifică cod
nano ODDS_MONITOR_SIMPLE.js

# Dacă ceva merge prost → restaurează
./RESTORE_BACKUP.sh
```

### Scenariul 2: Migrare pe Alt Server
```bash
# Server vechi
./BACKUP_SYSTEM.sh
scp ~/API_SMART_5_BACKUPS/backup.tar.gz user@new-server:/tmp/

# Server nou
mkdir -p "/home/user/API SMART 5"
cd "/home/user/API SMART 5"
tar -xzf /tmp/backup.tar.gz --strip-components=1
node API-SMART-5.js full
```

### Scenariul 3: Recovery după Crash
```bash
# Restaurează ultimul backup
./RESTORE_BACKUP.sh

# Selectează cel mai recent (1)
# Confirmă: yes

# Verifică fișiere
ls -la

# Repornește sistem
node API-SMART-5.js full
```

---

## 📋 Checklist Backup

### Înainte de Backup
- [ ] Oprește sistemul (optional, pentru consistență): `pkill -f API-SMART-5`
- [ ] Verifică spațiu disk: `df -h`
- [ ] Verifică că există fișiere importante: `ls -la notifications_tracking.json`

### După Backup
- [ ] Verifică arhiva creată: `ls -lh ~/API_SMART_5_BACKUPS/`
- [ ] Test restaurare (pe director temporar)
- [ ] Documentează backup-ul (ce modificări conține)
- [ ] Copiază backup important pe USB/server extern

### Periodic (lunar)
- [ ] Șterge backup-uri foarte vechi (>3 luni)
- [ ] Test restaurare completă
- [ ] Verifică integritate arhive: `tar -tzf backup.tar.gz > /dev/null`

---

## 📊 Statistici

### Backup Curent (01.02.2026)

```
📦 Arhivă: API_SMART_5_backup_20260201_015718.tar.gz
📏 Dimensiune: 7.7 MB
📁 Locație: ~/API_SMART_5_BACKUPS/

📂 CONȚINUT:
   ✅ 151 fișiere JavaScript
   ✅ 55 fișiere Markdown
   ✅ 17 fișiere JSON
   ✅ 35 fișiere log
   ✅ Fișiere configurare
```

---

## 🎯 Referințe Rapide

### Comenzi Esențiale

```bash
# Creare backup
./BACKUP_SYSTEM.sh

# Restaurare backup
./RESTORE_BACKUP.sh

# Listare backup-uri
ls -lht ~/API_SMART_5_BACKUPS/

# Verificare conținut
tar -tzf backup.tar.gz | head -20

# Cleanup manual
rm ~/API_SMART_5_BACKUPS/API_SMART_5_backup_2026*.tar.gz
```

---

## 📝 Note Importante

1. **Backup-ul NU include:**
   - `node_modules/` (reinstalează cu `npm install`)
   - Fișiere temporare
   - Cache-uri

2. **După restaurare:**
   - Verifică NOTIFICATION_CONFIG.js (parole)
   - Verifică .env (dacă există)
   - Rulează `npm install` (dacă lipsesc dependințe)
   - Repornește sistemul

3. **Backup local vs Cloud:**
   - Local: Rapid, offline, control total
   - Cloud: Protecție împotriva pierderii disk-ului
   - **Recomandat:** Ambele (local + cloud privat criptat)

---

**Versiune:** 1.0
**Data:** 01.02.2026
**Status:** ✅ PRODUCTION READY

**💾 Backup regulat = Somn liniștit! 😴**
