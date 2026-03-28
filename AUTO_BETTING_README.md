# 🤖 SISTEM AUTO BETTING - DOCUMENTAȚIE COMPLETĂ

## ⚠️ STATUS: MODUL SEPARAT - NU ESTE INTEGRAT

Acest sistem este **complet separat** de sistemul principal API SMART 5.
Va fi integrat doar după testare completă și validare.

---

## 📌 DESCRIERE

Sistem automat pentru plasarea pariurilor pe Superbet.ro cu:
- Login automat
- Verificare sold zilnic
- Plasare automată cu 5% din sold per pariu
- Un singur eveniment pe bilet
- Comportament uman (delay-uri, rate limiting)
- Management complet buget
- DRY RUN mode pentru testare

---

## 📁 FIȘIERE COMPONENTE

### 1. **BUDGET_MANAGER.js** ✅ FUNCȚIONAL
Management buget și statistici:
- Verifică sold dimineața
- Calculează 5% per pariu
- Înregistrează toate pariurile
- Safeguard-uri (sold minim, limită pariuri/zi)
- Statistici (win rate, ROI, profit total)

### 2. **SUPERBET_AUTO_BETTING.js** ⚠️ PARȚIAL
Modul principal auto betting:
- Login automat (API - NU implementat încă)
- Get balance (API - NU implementat încă)
- Place bet (API - NU implementat încă)
- Rate limiting (✅ funcțional)
- Comportament uman (✅ funcțional)
- DRY RUN mode (✅ funcțional)

### 3. **DISCOVER_BETTING_API.js** 🔍 TOOL
Tool pentru descoperirea endpoint-urilor API:
- Ghid pas-cu-pas pentru capturare request-uri
- Parser cURL → cod Node.js
- Generare automată cod API

### 4. **TEST_AUTO_BETTING_SYSTEM.js** 🧪 TEST
Script complet de testare:
- Test budget manager
- Test flow complet (login → betting)
- DRY RUN mode (fără pariuri reale)
- Raportare statistici

---

## 🚀 UTILIZARE - PAS CU PAS

### STEP 1: Descoperire API-uri Superbet

```bash
# Rulează tool-ul de discovery
node DISCOVER_BETTING_API.js
```

Urmează instrucțiunile afișate:
1. Deschide Chrome DevTools (F12)
2. Tab Network → Filtrează XHR/Fetch
3. Loghează-te pe Superbet.ro
4. Verifică sold
5. Plasează un pariu de test
6. Copiază request-urile ca cURL

Salvează în fișiere:
- `login-request.txt`
- `balance-request.txt`
- `place-bet-request.txt`

Apoi rulează:
```bash
node DISCOVER_BETTING_API.js --parse
```

Va genera: `SUPERBET_BETTING_API_GENERATED.js`

---

### STEP 2: Testare Budget Manager

```bash
node TEST_AUTO_BETTING_SYSTEM.js --budget
```

Verifică:
- ✅ Setare sold inițial
- ✅ Calculare 5% per pariu
- ✅ Înregistrare pariuri
- ✅ Safeguard-uri
- ✅ Statistici

---

### STEP 3: Testare Flow Complet (DRY RUN)

```bash
node TEST_AUTO_BETTING_SYSTEM.js --full
```

Va simula:
1. Login
2. Get balance
3. Update budget
4. Plasare 3 pariuri
5. Statistici

**NU VA PLASA PARIURI REALE!** (DRY RUN mode)

---

### STEP 4: Completare API-uri

După discovery, completează în `SUPERBET_AUTO_BETTING.js`:

```javascript
// TODO: Completează cu endpoint-urile descoperite

// Login
async login() {
    const response = await axios.post('ENDPOINT_AICI', {
        email: this.credentials.email,
        password: this.credentials.password
    });

    this.authToken = response.data.token;
    return true;
}

// Get Balance
async getBalance() {
    const response = await axios.get('ENDPOINT_AICI', {
        headers: { 'Authorization': `Bearer ${this.authToken}` }
    });

    return response.data.balance;
}

// Place Bet
async placeBet(betData) {
    const response = await axios.post('ENDPOINT_AICI', {
        selectionId: betData.selectionId,
        stake: betData.stake,
        oddValue: betData.odd
    }, {
        headers: { 'Authorization': `Bearer ${this.authToken}` }
    });

    return { success: true, betId: response.data.ticketId };
}
```

---

### STEP 5: Testare cu Cont Real (DRY RUN)

După completare API-uri, testează cu cont real dar **DRY RUN**:

```javascript
const SuperbetAutoBetting = require('./SUPERBET_AUTO_BETTING');

const betting = new SuperbetAutoBetting({
    dryRun: true, // IMPORTANT: true pentru testare!
    email: 'your@email.com',
    password: 'yourpassword'
});

(async () => {
    await betting.login();
    await betting.updateDailyBudget();

    // Test plasare pariu
    const result = await betting.placeBet({
        matchId: 'REAL_MATCH_ID',
        homeTeam: 'Real Team 1',
        awayTeam: 'Real Team 2',
        event: 'Real Event',
        odd: 1.75,
        selectionId: 'REAL_SELECTION_ID'
    });

    console.log(result);

    await betting.shutdown();
})();
```

---

### STEP 6: LIVE MODE (După Validare Completă)

**DOAR după ce ai verificat totul perfect:**

```javascript
const betting = new SuperbetAutoBetting({
    dryRun: false, // ⚠️ LIVE MODE!
    email: 'your@email.com',
    password: 'yourpassword'
});
```

---

## 🔄 FLOW COMPLET AUTOMAT (După Integrare)

```
08:00 - Update Buget Zilnic
  ↓
Login automat Superbet
  ↓
Obține sold → Calculează 5% per pariu
  ↓
========== MONITORIZARE MECIURI ==========
  ↓
Primește notificare (cota 1.50 sau 2.00)
  ↓
Verifică:
  - Sold disponibil?
  - Sub 10 pariuri azi?
  - Rate limiting OK?
  ↓
Plasează pariu automat:
  - Selecție: Eveniment din notificare
  - Miză: 5% din sold curent
  - Un singur eveniment pe bilet
  ↓
Delay aleatoriu 30-120s
  ↓
Continuă monitorizare
```

---

## 💰 MANAGEMENT BUGET

### Regulă 5% per Pariu

**Exemplu cu sold 1000 RON:**

| Pariu | Sold Înainte | Miză (5%) | Câștig (odd 1.80) | Sold După Câștig |
|-------|--------------|-----------|-------------------|------------------|
| 1     | 1000 RON     | 50 RON    | 90 RON            | 1040 RON         |
| 2     | 1040 RON     | 52 RON    | 93.60 RON         | 1081.60 RON      |
| 3     | 1081.60 RON  | 54.08 RON | 97.34 RON         | 1124.86 RON      |

**Avantaje:**
- ✅ Risc controlat (max 5% per pariu)
- ✅ Protecție la pierderi consecutive
- ✅ Creștere progresivă la câștiguri
- ✅ Nu rămâi fără bani rapid

---

## 🛡️ SAFEGUARD-URI

### 1. Sold Minim
```javascript
if (sold < 10 RON) {
    return { allowed: false, reason: 'Sold insuficient' };
}
```

### 2. Limită Pariuri/Zi
```javascript
if (pariuriAzi >= 10) {
    return { allowed: false, reason: 'Limită zilnică atinsă' };
}
```

### 3. Rate Limiting
```javascript
minDelayBetweenBets = 30s // Minim între pariuri
maxDelayBetweenBets = 120s // Maxim
```

### 4. Comportament Uman
- Delay-uri aleatorii (2-7 secunde)
- Timp variabil între pariuri
- Simulare pattern natural

### 5. DRY RUN Mode
```javascript
dryRun: true // NU plasează pariuri reale
```

---

## 📊 STATISTICI ȘI RAPORTARE

### Budget Manager Stats:
```javascript
const stats = BudgetManager.getStatistics();

{
    currentBalance: 1124.86,
    totalProfit: 124.86,
    betsToday: 3,
    totalBets: 15,
    wonBets: 9,
    lostBets: 6,
    winRate: 60, // %
    averageStake: 52.45,
    roi: 12.49 // %
}
```

### Session Stats:
```javascript
const stats = betting.getSessionStats();

{
    duration: '45.32 min',
    betsPlaced: 5,
    betsSuccess: 5,
    betsFailed: 0,
    successRate: 100
}
```

---

## ⚠️ RISCURI ȘI CONSIDERAȚII

### 1. Termeni și Condiții
- ⚠️ Superbet poate interzice boturile în T&C
- ⚠️ Risc blocare cont + confiscare fonduri
- ⚠️ Folosește pe propria răspundere

### 2. Mitigare Risc
- ✅ Rate limiting (30-120s între pariuri)
- ✅ Delay-uri aleatorii
- ✅ Max 10 pariuri/zi
- ✅ Comportament uman simulat
- ✅ DRY RUN extensive testing

### 3. Responsabilitate Financiară
- ⚠️ Gambling = risc financiar
- ⚠️ NU este garantat profit
- ⚠️ Joacă responsabil
- ⚠️ Setează limite clare

---

## 🔮 INTEGRARE ÎN SISTEMUL PRINCIPAL (VIITOR)

După validare completă, va fi integrat în `NOTIFICATION_MONITOR.js`:

```javascript
// Când cota ajunge la 1.50 sau 2.00
if (currentOdd >= 1.50 && notification.minute_odd_1_50 === null) {
    // Trimite email ⚡
    await Odd150Notifier.sendOdd150Notification(...);

    // PLASEAZĂ PARIU AUTOMAT 🤖
    const betResult = await AutoBetting.placeBet({
        matchId: notification.matchId,
        homeTeam: notification.homeTeam,
        awayTeam: notification.awayTeam,
        event: notification.event,
        odd: currentOdd,
        selectionId: oddData.selectionId
    });

    if (betResult.success) {
        console.log(`✅ Pariu plasat automat! ID: ${betResult.betId}`);
    }
}
```

---

## ✅ CHECKLIST IMPLEMENTARE

- [x] Budget Manager (COMPLET)
- [x] Auto Betting module (SKELETON)
- [x] Discovery tool (COMPLET)
- [x] Test suite (COMPLET)
- [x] Documentație (COMPLET)
- [x] DRY RUN mode (COMPLET)
- [ ] API endpoints discovery (MANUAL)
- [ ] API implementation (DUPĂ DISCOVERY)
- [ ] Testare cu cont real DRY RUN
- [ ] Validare completă
- [ ] Integrare în sistemul principal

---

## 📝 FIȘIERE GENERATE

- `budget_data.json` - Date buget și statistici
- `betting_logs/` - Log-uri pariuri plasate (viitor)
- `SUPERBET_BETTING_API_GENERATED.js` - API generat după discovery

---

**© 2025 - API SMART 5 Auto Betting System**
**Versiune:** 1.0 BETA
**Status:** SEPARAT - NU INTEGRAT
**Data:** 3 Decembrie 2025

**⚠️ DISCLAIMER:** Acest sistem este pentru uz educațional. Folosește pe propria răspundere.
