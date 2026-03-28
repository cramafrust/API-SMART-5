# 🚀 QUICK START - AUTO BETTING SYSTEM

## ✅ CE AM CREAT (COMPLET SEPARAT)

### 📦 Module Noi:

1. **BUDGET_MANAGER.js** ✅
   - Management 5% per pariu
   - Safeguard-uri
   - Statistici complete

2. **SUPERBET_AUTO_BETTING.js** ⚠️
   - Login automat (API - de completat)
   - Get balance (API - de completat)
   - Place bet (API - de completat)
   - Rate limiting ✅
   - Comportament uman ✅

3. **DISCOVER_BETTING_API.js** 🔍
   - Tool pentru descoperirea endpoint-urilor API
   - Parser cURL → cod Node.js

4. **TEST_AUTO_BETTING_SYSTEM.js** 🧪
   - Test budget manager ✅
   - Test flow complet ✅
   - DRY RUN mode ✅

5. **AUTO_BETTING_README.md** 📖
   - Documentație completă
   - Ghid pas-cu-pas

---

## 🎯 NEXT STEPS - CE TREBUIE SĂ FACI:

### STEP 1: Descoperă API-urile Superbet

```bash
cd "/home/florian/API SMART 5"
node DISCOVER_BETTING_API.js
```

Urmează instrucțiunile afișate:
1. Deschide Chrome DevTools (F12)
2. Tab Network
3. Loghează-te pe Superbet.ro
4. Verifică sold
5. Plasează un pariu de test (miză mică!)
6. Copiază request-urile ca cURL în:
   - `login-request.txt`
   - `balance-request.txt`
   - `place-bet-request.txt`

Apoi:
```bash
node DISCOVER_BETTING_API.js --parse
```

---

### STEP 2: Testează Budget Manager

```bash
node TEST_AUTO_BETTING_SYSTEM.js --budget
```

Verifică că totul funcționează corect.

---

### STEP 3: Testează Flow Complet (DRY RUN)

```bash
node TEST_AUTO_BETTING_SYSTEM.js --full
```

**NU VA PLASA PARIURI REALE!** (DRY RUN mode)

---

### STEP 4: Completează API-urile

După discovery, completează endpoint-urile în `SUPERBET_AUTO_BETTING.js`:
- `login()` - linia ~79
- `getBalance()` - linia ~109
- `placeBet()` - linia ~244

---

### STEP 5: Testare cu Cont Real (DRY RUN)

```javascript
const SuperbetAutoBetting = require('./SUPERBET_AUTO_BETTING');

const betting = new SuperbetAutoBetting({
    dryRun: true, // IMPORTANT!
    email: 'your@email.com',
    password: 'yourpassword'
});
```

---

### STEP 6: Integrare în Sistemul Principal

**DOAR după validare completă**, integrează în `NOTIFICATION_MONITOR.js`:

```javascript
// La cota 1.50
if (currentOdd >= 1.50) {
    // Trimite email
    await Odd150Notifier.sendOdd150Notification(...);

    // Plasează pariu automat
    const AutoBetting = require('./SUPERBET_AUTO_BETTING');
    const betting = new AutoBetting({ dryRun: false });
    await betting.login();
    await betting.placeBet({...});
}
```

---

## 📊 CE FACE SISTEMUL:

### Dimineața (08:00):
1. Login automat Superbet
2. Obține sold curent
3. Actualizează budget (5% per pariu)

### Când primești notificare:
1. Verifică dacă poate plasa pariu (sold, limite)
2. Calculează miză (5% din sold)
3. Delay aleatoriu (comportament uman)
4. Plasează pariu automat
5. Înregistrează în budget
6. Update statistici

### Safeguard-uri:
- ✅ Sold minim 10 RON
- ✅ Max 10 pariuri/zi
- ✅ Rate limiting (30-120s între pariuri)
- ✅ Delay-uri aleatorii
- ✅ DRY RUN mode

---

## 💰 EXEMPLU MANAGEMENT BUGET:

**Sold inițial: 1000 RON**

| Pariu | Miză (5%) | Cotă | Rezultat | Sold După |
|-------|-----------|------|----------|-----------|
| 1     | 50 RON    | 1.80 | WIN      | 1040 RON  |
| 2     | 52 RON    | 1.65 | LOST     | 988 RON   |
| 3     | 49.40 RON | 2.00 | WIN      | 1086.80 RON |

---

## ⚠️ IMPORTANT:

1. **Testează FOARTE BINE** în DRY RUN mode
2. **Folosește cont secundar** pentru teste live
3. **Verifică T&C Superbet** (pot interzice boturile)
4. **Risc blocare cont** dacă detectează
5. **Joacă responsabil** - NU garantează profit

---

## 📁 FIȘIERE GENERATE:

- `budget_data.json` - Date buget (creat automat)
- `SUPERBET_BETTING_API_GENERATED.js` - După discovery

---

## 🆘 AJUTOR:

Pentru detalii complete, vezi:
- `AUTO_BETTING_README.md` - Documentație completă
- `TEST_AUTO_BETTING_SYSTEM.js` - Script testare
- `DISCOVER_BETTING_API.js` - Tool discovery

---

**© 2025 - API SMART 5 Auto Betting**
**Status:** SEPARAT - NU INTEGRAT ÎN SISTEMUL PRINCIPAL
**Versiune:** 1.0 BETA

**Creeat separat pentru testare și validare.**
**Va fi integrat doar după validare completă!**
