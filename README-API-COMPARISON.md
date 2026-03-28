# 🔍 COMPARAȚIE ACCESARE API - FlashScore vs Superbet

## 📊 FlashScore API (Ce folosim ACUM)

### ✅ METODA ACTUALĂ:

```javascript
// Direct HTTP request către API nedocumentat
const url = 'https://global.flashscore.ninja/2/x/feed/f_1_0_2_en_1';

const headers = {
    'X-Fsign': 'SW9D1eZo',  // Token special
    'User-Agent': '...',
    'Referer': 'https://www.flashscore.com/'
};

const response = await fetch(url, { headers });
```

### 📋 Caracteristici:

- ✅ **API public** (nedocumentat dar accesibil)
- ✅ **Nu necesită browser** - simple HTTP requests
- ✅ **Format custom** (~, ¬, ÷ separatori)
- ✅ **Token simplu** (`X-Fsign: SW9D1eZo`)
- ✅ **Răspuns instant** (<1 secundă)
- ✅ **100% funcțional** pentru meciuri + statistici

### 🎯 Endpoints folosite:

```
Main feed:      https://global.flashscore.ninja/2/x/feed/f_1_0_2_en_1
Match details:  https://global.flashscore.ninja/2/x/feed/dc_1_{matchId}
Match stats:    https://2.flashscore.ninja/2/x/feed/df_st_1_{matchId}
```

---

## 🔍 Superbet API (În investigare)

### ⚠️ SITUAȚIA ACTUALĂ:

**Testare automată:**
- ❌ Endpoint-uri ghicite (`/api/sports`, `/api/odds`) returnează HTML, nu JSON
- ❌ Subdomeniile (`api.superbet.ro`, `feed.superbet.ro`) nu există
- ⚠️ Site-ul folosește JavaScript pentru încărcare dinamică

**Concluzie:** API-ul Superbet NU e accesibil direct ca FlashScore.

### 🎯 3 OPȚIUNI pentru Cote Superbet:

---

## OPȚIUNEA 1: Browser Automation (Puppeteer) ⭐ RECOMANDAT

### 📖 Concept:

Automatizăm un browser real care:
1. Deschide Superbet.ro
2. Caută meciul
3. Extrage cotele din DOM
4. Returnează datele

### 💻 Cod exemplu:

```javascript
const puppeteer = require('puppeteer');

async function getSuperbetOdds(homeTeam, awayTeam) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Mergi pe pagina de fotbal
    await page.goto('https://www.superbet.ro/fotbal');

    // Caută meciul
    await page.type('#search', `${homeTeam} ${awayTeam}`);
    await page.keyboard.press('Enter');
    await page.waitForSelector('.match-odds');

    // Extrage cotele din pagină
    const odds = await page.evaluate(() => {
        const overUnder25 = document.querySelector('[data-market="over_under_2_5"]');
        const btts = document.querySelector('[data-market="btts"]');

        return {
            over_2_5: parseFloat(overUnder25?.querySelector('.odd-value')?.textContent),
            btts_yes: parseFloat(btts?.querySelector('.odd-yes')?.textContent)
        };
    });

    await browser.close();
    return odds;
}
```

### ✅ Avantaje:
- ✅ **100% cote reale** (exact ce vezi pe site)
- ✅ **Funcționează garantat** (robotizăm browserul)
- ✅ **Nu depinde de API-uri ascunse**

### ❌ Dezavantaje:
- ⚠️ **Mai lent** (3-5 secunde per meci)
- ⚠️ **Consumă resurse** (browser în background)
- ⚠️ **Poate fi blocat** (CAPTCHA, rate limiting)

### 💰 Cost:
- **Gratis** (doar rulează local)

---

## OPȚIUNEA 2: Reverse Engineering Manual (DevTools)

### 📖 Pași:

1. **Deschide Chrome** → https://www.superbet.ro/fotbal
2. **F12** → Tab "Network"
3. **Filtrează** → XHR/Fetch
4. **Caută meci** → Click pe un meci live
5. **Observă requests:**
   ```
   Exemplu ce căutăm:

   Request URL: https://sportapi.superbet.ro/v2/events/12345/odds
   Headers:
     Authorization: Bearer eyJhbGc...
     X-Client-Id: web-app

   Response:
   {
     "markets": [
       { "name": "Match Winner", "odds": [1.85, 3.40, 4.20] },
       { "name": "Over/Under 2.5", "odds": [1.70, 2.10] }
     ]
   }
   ```

6. **Copy request** → Click dreapta → "Copy as cURL"
7. **Testează în cod:**
   ```javascript
   const response = await fetch('URL_GASIT', {
       headers: {
           'Authorization': 'Bearer TOKEN_GASIT',
           'X-Client-Id': 'web-app'
       }
   });
   ```

### ✅ Avantaje:
- ✅ **API direct** (cel mai rapid dacă funcționează)
- ✅ **JSON curat** (ușor de parsat)
- ✅ **Performant** (sub 1 secundă)

### ❌ Dezavantaje:
- ⚠️ **Token-uri care expiră** (trebuie reînnoit)
- ⚠️ **API poate să se schimbe**
- ⚠️ **Poate necesita autentificare**

### 💰 Cost:
- **Gratis** (dacă găsim API-ul)

---

## OPȚIUNEA 3: The Odds API (Serviciu terț)

### 📖 Concept:

API comercial care oferă cote de la TOATE casele de pariuri.

### 💻 Cod exemplu:

```javascript
const apiKey = 'YOUR_API_KEY';
const url = `https://api.the-odds-api.com/v4/sports/soccer_romania_liga_1/odds/?apiKey=${apiKey}&regions=eu&markets=h2h,totals`;

const response = await fetch(url);
const data = await response.json();

// Găsește cote pentru Superbet
const superbetOdds = data.bookmakers.find(b => b.key === 'superbet');
```

### ✅ Avantaje:
- ✅ **Ultra simplu** (un singur request)
- ✅ **Stabil** (API oficial)
- ✅ **Multiple case** (Superbet, Netbet, etc.)
- ✅ **JSON perfect structurat**

### ❌ Dezavantaje:
- ❌ **COST** (~$50/lună pentru 10,000 requests)
- ⚠️ **Poate să nu aibă toate piețele** (cornere, cartonașe)
- ⚠️ **Limită requests** (500/lună pe plan gratuit)

### 💰 Cost:
- **Plan gratuit:** 500 requests/lună
- **Hobby:** $50/lună (10k requests)
- **Pro:** $200/lună (50k requests)

Website: https://the-odds-api.com

---

## 📊 COMPARAȚIE OPȚIUNI:

| Criteriu | Puppeteer | Reverse Engineering | The Odds API |
|----------|-----------|---------------------|--------------|
| **Gratis** | ✅ Da | ✅ Da | ⚠️ Limitat |
| **Viteză** | ⚠️ 3-5s | ✅ <1s | ✅ <1s |
| **Stabilitate** | ✅ Înaltă | ⚠️ Medie | ✅ Foarte înaltă |
| **Complexitate** | ⚠️ Medie | ⚠️ Mare | ✅ Simplă |
| **Cote reale** | ✅ 100% | ✅ 100% | ✅ 100% |
| **Blocare risc** | ⚠️ Posibil | ⚠️ Posibil | ✅ Nu |
| **Toate piețele** | ✅ Da | ✅ Da | ⚠️ Limitat |

---

## 🎯 RECOMANDAREA MEA:

### **Pentru TESTARE (acum):**
✅ **MOCK odds** - ce avem deja implementat

### **Pentru PRODUCȚIE (peste 1-2 săptămâni):**

**Faza 1:** Încearcă **Reverse Engineering** (manual în DevTools)
- Dacă găsim API-ul → Perfect! Implementăm în 30 minute
- Dacă nu → Mergem la Faza 2

**Faza 2:** Implementăm **Puppeteer** (browser automation)
- Gratis, stabil, funcționează garantat
- Mai lent dar sigur

**Faza 3 (opțional):** Dacă Puppeteer e prea lent
- Evaluăm **The Odds API** (cost vs beneficii)

---

## 🛠️ Instalare Puppeteer (pentru viitor):

```bash
cd "/home/florian/API SMART 5"
npm install puppeteer

# Test
node -e "console.log('Puppeteer instalat!')"
```

Apoi creez `SUPERBET_SCRAPER_PUPPETEER.js` cu implementare completă.

---

## 📝 NEXT STEPS:

### **ACUM (în 5 minute):**

Vrei să:
- **A)** Încerc să găsesc API-ul manual (DevTools în browser)?
- **B)** Implementez Puppeteer pentru scraping direct?
- **C)** Testăm The Odds API (trial gratuit)?
- **D)** Rămânem cu MOCK odds deocamdată?

### **După ce alegem:**

Implementez soluția completă și o integrez în sistemul de tracking.

---

## 💡 TIP IMPORTANT:

**FlashScore** funcționează perfect pentru că:
- Au un API nedocumentat dar public
- Token static simplu (`X-Fsign`)
- Nu au protecții anti-scraping agresive

**Superbet** e diferit pentru că:
- API-ul probabil e ascuns/protejat
- Pot folosi token-uri dinamice
- Pot avea CAPTCHA sau verificări

Dar **toate cele 3 opțiuni funcționează** - e doar o chestiune de timp de implementare și stabilitate.

---

**Ce vrei să facem? A, B, C sau D?**
