# 🐛 PROBLEME IDENTIFICATE - RAPOARTE LUNARE + SĂPTĂMÂNALE

**Data:** 31 ianuarie 2026
**Status:** ⚠️ BUG CRITIC IDENTIFICAT

---

## ❌ PROBLEMA #1: WEEKLY_REPORT_GENERATOR.js - COD IDENTIC CU MONTHLY

### Descriere:
WEEKLY_REPORT_GENERATOR.js a fost creat prin copy-paste din MONTHLY_REPORT_GENERATOR.js și convertit cu `sed`, dar conversia a fost INCOMPLETĂ!

### Cod problematic:

**Linii 26-32:** Funcție `getCurrentMonth()` - AR TREBUI `getCurrentWeek()`
```javascript
// ❌ GREȘIT:
function getCurrentMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

// ✅ CORECT:
function getLastWeekStart() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Duminică, 1 = Luni, ..., 6 = Sâmbătă
    const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 + 7;
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - daysToLastMonday);

    const year = lastMonday.getFullYear();
    const month = String(lastMonday.getMonth() + 1).padStart(2, '0');
    const day = String(lastMonday.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`; // Format: 2026-01-20
}
```

---

**Linii 37-50:** Funcție `getMonthName()` - AR TREBUI `getWeekName()`
```javascript
// ❌ GREȘIT:
function getMonthName(yearMonth) {
    const monthNames = { '01': 'Ianuarie', ... };
    const [year, month] = yearMonth.split('-');
    return `${monthNames[month]} ${year}`;
}

// ✅ CORECT:
function getWeekPeriod(weekStart) {
    const startDate = new Date(weekStart);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6); // +6 zile = Duminică

    const formatDate = (d) => {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}.${month}.${year}`;
    };

    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

function getWeekName(weekStart) {
    return `Săptămâna ${getWeekPeriod(weekStart)}`;
}
```

---

**Linii 61-82:** Funcție `isInMonth()` - AR TREBUI `isInWeek()`
```javascript
// ❌ GREȘIT:
function isInMonth(notification, targetMonth) {
    // Verifică dacă notificarea este în luna specificată
    if (notification.timestamp) {
        const notifDate = new Date(notification.timestamp);
        const notifMonth = `${notifDate.getFullYear()}-${String(notifDate.getMonth() + 1).padStart(2, '0')}`;
        return notifMonth === targetMonth;
    }
    return false;
}

// ✅ CORECT:
function isInWeek(notification, weekStart) {
    if (!notification.timestamp) return false;

    const notifDate = new Date(notification.timestamp);
    const startDate = new Date(weekStart);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6); // +6 zile = Duminică
    endDate.setHours(23, 59, 59, 999); // Până la sfârșitul zilei

    return notifDate >= startDate && notifDate <= endDate;
}
```

---

### Efectul:
- ❌ WEEKLY_REPORT_GENERATOR.js generează rapoarte LUNARE în loc de SĂPTĂMÂNALE
- ❌ Dacă rulezi `node WEEKLY_REPORT_GENERATOR.js`, primești TOATE notificările din LUNA curentă
- ❌ SEND_WEEKLY_REPORT.js trimite rapoarte LUNARE în loc de SĂPTĂMÂNALE

---

## ❌ PROBLEMA #2: SEND_WEEKLY_REPORT.js - REFERINȚE INCORECTE

### Cod problematic:

**Linia ~20:** Funcție `getPreviousMonth()` - AR TREBUI `getPreviousWeek()`
```javascript
// ❌ GREȘIT:
function getPreviousMonth() {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = lastMonth.getFullYear();
    const month = String(lastMonth.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

// ✅ CORECT:
function getPreviousWeek() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 + 7;
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - daysToLastMonday);

    const year = lastMonday.getFullYear();
    const month = String(lastMonday.getMonth() + 1).padStart(2, '0');
    const day = String(lastMonday.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}
```

---

**Import statements:** Import `generateMonthlyReport` - AR TREBUI `generateWeeklyReport`
```javascript
// ❌ GREȘIT:
const {
    generateMonthlyReport,
    getMonthName,
    getCurrentMonth
} = require('./MONTHLY_REPORT_GENERATOR');

// ✅ CORECT:
const {
    generateWeeklyReport,
    getWeekName,
    getLastWeekStart
} = require('./WEEKLY_REPORT_GENERATOR');
```

---

## 📋 LISTA COMPLETĂ ERORI

### WEEKLY_REPORT_GENERATOR.js:
1. ❌ Linia 26: `getCurrentMonth()` → Trebuie `getLastWeekStart()`
2. ❌ Linia 37: `getMonthName()` → Trebuie `getWeekName()` + `getWeekPeriod()`
3. ❌ Linia 61: `isInMonth()` → Trebuie `isInWeek()`
4. ❌ Linia 161: `generateMonthlyReport()` → Trebuie `generateWeeklyReport()`
5. ❌ Linia 661: `generateFilteredReport()` folosește `isInMonth` → Trebuie `isInWeek`
6. ❌ Linia 784: `main()` folosește `getCurrentMonth()` → Trebuie `getLastWeekStart()`
7. ❌ Linia 808: Apelează `generateMonthlyReport()` → Trebuie `generateWeeklyReport()`
8. ❌ Export module: `generateMonthlyReport` → Trebuie `generateWeeklyReport`

### SEND_WEEKLY_REPORT.js:
1. ❌ Linia ~20: `getPreviousMonth()` → Trebuie `getPreviousWeek()`
2. ❌ Import: `generateMonthlyReport` → Trebuie `generateWeeklyReport`
3. ❌ Import: `getMonthName` → Trebuie `getWeekName`
4. ❌ Import: `getCurrentMonth` → Trebuie `getLastWeekStart`
5. ❌ Linia ~50: `generateAndSaveFilteredReport()` folosește logică MONTHLY
6. ❌ Linia ~200: `generateAllReports()` apelează `generateMonthlyReport()`

---

## ✅ FIX RECOMANDAT

### Opțiunea 1: RESCRIE COMPLET WEEKLY_REPORT_GENERATOR.js
- Șterge fișierul actual
- Creează de la zero cu logică corectă pentru săptămână
- Testează cu date reale

### Opțiunea 2: PATCH MANUAL
- Citește WEEKLY_REPORT_GENERATOR.js
- Înlocuiește TOATE funcțiile cu variante corecte
- Testează

### Opțiunea 3: SIMPLIFICARE
- Folosește același generator (MONTHLY) dar cu parametru `type`
- `node REPORT_GENERATOR.js --type monthly|weekly`
- Un singur fișier, două moduri de funcționare

---

## 🧪 TESTARE NECESARĂ

După fix, testează:

```bash
# 1. Test MONTHLY (ar trebui să fie OK)
node MONTHLY_REPORT_GENERATOR.js

# 2. Test WEEKLY (momentan BUG - va afișa date LUNARE!)
node WEEKLY_REPORT_GENERATOR.js

# 3. Verifică număr notificări
# MONTHLY: ~150 notificări (toată luna)
# WEEKLY: ~30-40 notificări (doar săptămâna)

# Dacă WEEKLY afișează 150, BUG-ul e confirmat!
```

---

## 📊 IMPACT

**Severitate:** 🔴 CRITIC

**Efectul:**
- Raportul "săptămânal" trimite TOATE notificările din lună (duplicat cu lunar)
- Utilizatorul primește aceleași date de 2 ori
- Spam email inutilă (4 PDF-uri identice Marți + 1 a lunii)

**Soluție:** FIX URGENT înainte de prima rulare CRON (Marți)!

---

**Generat:** 31 ianuarie 2026
**Status:** ✅ REZOLVAT - 31 ianuarie 2026
**Prioritate:** ✅ COMPLETĂ
**Integrare:** ✅ SCHEDULER AUTOMAT INTEGRAT - 31 ianuarie 2026

---

## ✅ SOLUȚIA APLICATĂ

### Schimbări în WEEKLY_REPORT_GENERATOR.js:

1. **getLastWeekStart()** - Înlocuit getCurrentMonth(), calculează Luni săptămânii precedente (format YYYY-MM-DD)
2. **getWeekName()** + **getWeekPeriod()** - Înlocuit getMonthName(), returnează "Săptămâna DD.MM.YYYY - DD.MM.YYYY"
3. **isInWeek()** - Înlocuit isInMonth(), verifică dacă notificarea este între Luni-Duminică
4. **Toate variabilele** - targetMonth → targetWeek, monthNotifications → weekNotifications, monthName → weekName
5. **Validare format** - Schimbat din `^\d{4}-\d{2}$` în `^\d{4}-\d{2}-\d{2}$`
6. **Module exports** - Export getLastWeekStart, getWeekName, getWeekPeriod (nu getCurrentMonth, getMonthName)
7. **NotificationTracker import** - Fix: folosește singleton, nu constructor

### Schimbări în SEND_WEEKLY_REPORT.js:

1. **Imports** - Import getWeekName, getLastWeekStart, getWeekPeriod din WEEKLY_REPORT_GENERATOR
2. **getPreviousWeek()** - Apelează getLastWeekStart() din WEEKLY_REPORT_GENERATOR
3. **Toate variabilele** - targetMonth → targetWeek, monthName → weekName, monthNotifications → weekNotifications
4. **Filtrare săptămână** - Logică week-based în generateAndSaveFilteredReport() folosind interval Luni-Duminică
5. **Validare format** - Schimbat din `^\d{4}-\d{2}$` în `^\d{4}-\d{2}-\d{2}$`

### Testare:

```bash
node WEEKLY_REPORT_GENERATOR.js
```

**Rezultat:**
- ✅ 33 notificări pentru săptămâna 19-25 ianuarie (din 151 total)
- ✅ Format corect: "Săptămâna 19.01.2026 - 25.01.2026"
- ✅ Fișier generat: weekly-report-2026-01-19.html

**Confirmare:** Rapoartele săptămânale funcționează CORECT cu logică de săptămână (Luni-Duminică)!

---

## 🤖 INTEGRARE AUTOMATĂ - REPORT SCHEDULER

**Data:** 31 ianuarie 2026

### Implementare:

1. **REPORT_SCHEDULER.js** - Modul nou creat
   - Verificare automată la fiecare 60 secunde
   - Trimite LUNAR: 1 a lunii la 08:00
   - Trimite SĂPTĂMÂNAL: Marți la 08:00
   - Nu necesită CRON extern

2. **API-SMART-5.js** - Integrare completă
   - Import: `const reportScheduler = require('./REPORT_SCHEDULER');`
   - `commandFull()` - linia 547: `reportScheduler.start();`
   - `commandFullDay()` - linia 628: `reportScheduler.start();`
   - Pornește automat când rulezi `node API-SMART-5.js full`

3. **Testare:**
   ```bash
   node TEST_REPORT_SCHEDULER.js
   ```
   - ✅ Scheduler pornește corect
   - ✅ Status afișat: isRunning: true
   - ✅ Oprire clean: reportScheduler.stop()

### Utilizare:

```bash
# Pornire normală API SMART 5 (include scheduler automat)
node API-SMART-5.js full

# Scheduler-ul va rula în background și va trimite:
# - Raport LUNAR: 1 a fiecărei luni la 08:00
# - Raport SĂPTĂMÂNAL: Marți la 08:00
```

**NU mai este nevoie de CRON manual!** Rapoartele se trimit automat atâta timp cât API SMART 5 rulează.
