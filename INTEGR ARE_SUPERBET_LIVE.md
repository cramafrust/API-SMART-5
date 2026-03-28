# 🎯 INTEGRARE SUPERBET LIVE ODDS

## ✅ IMPLEMENTARE COMPLETĂ

Integrare realizată pentru a adăuga **cote LIVE** de la Superbet în notificările email ale API SMART 5.

---

## 📁 FIȘIERE MODIFICATE/ADĂUGATE

### 1. **Fișiere noi create:**

#### `/home/florian/superbet-analyzer/SUPERBET_LIVE_ODDS.js`
- Modul principal pentru extragerea cotelor LIVE de la Superbet
- Funcționalități:
  - Găsește Event ID pentru meci (cu cache 10 minute)
  - Extrage cote LIVE via API SSE
  - Determină cote relevante pentru pattern-uri detectate
  - Extrage statistici curente (goluri, cornere, cartonașe)

#### `/home/florian/API SMART 5/SUPERBET_ODDS_INTEGRATION.js`
- Wrapper pentru integrare cu API SMART 5
- Compatibil cu interfața `BettingOdds` existentă
- Convertește formatul cotelor pentru email-notifier

### 2. **Fișiere modificate:**

#### `/home/florian/API SMART 5/email-notifier.js`
- **Linia 10-11:** Înlocuit `BETTING_ODDS_SCRAPER` cu `SUPERBET_ODDS_INTEGRATION`
- **Linii 245-289 (x3 apariții):** Modificat afișarea cotelor în HTML pentru a include:
  - Cote LIVE relevante pentru fiecare pattern
  - Descriere eveniment (ex: "Încă un gol (peste 1.5)")
  - Valoare curentă (ex: "Acum: 1 gol")
  - Statistici curente meci (goluri, cornere, cartonașe)

---

## 🎯 EVENIMENTE SUPORTATE

Sistemul extrage automat cote pentru următoarele evenimente:

### 1. **ÎNCĂ UN GOL MARCAT**
- Detectare: Pattern conține "gol", "scor" sau "marc"
- Cotă extrasă: `PESTE (goluri_actuale + 0.5)`
- Exemplu: Dacă scorul e 0-0, extrage cota pentru "Peste 0.5 goluri"
- Exemplu: Dacă scorul e 2-1 (3 goluri), extrage "Peste 3.5 goluri"

### 2. **GOL MARCAT DE ECHIPA 1/2**
- Detectare: Pattern pentru echipă specifică (gazda/oaspete)
- Cotă extrasă: "Echipa X marchează - DA"
- Afișare: Nume echipă + cotă

### 3. **AMBELE MARCHEAZĂ (GG)**
- Detectare: Pattern general de goluri
- Cotă extrasă: "Ambele echipe marchează - DA"

### 4. **ÎNCĂ UN CARTONAȘ GALBEN**
- Detectare: Pattern conține "cartonaș" sau "card"
- Cotă extrasă: `PESTE (cartonase_actuale + 0.5)`
- Exemplu: Dacă sunt 3 cartonașe, extrage "Peste 3.5 cartonașe"

### 5. **ÎNCĂ 2 CORNERE**
- Detectare: Pattern conține "corner" sau "cornere"
- Cotă extrasă: `PESTE (cornere_actuale + 1.5)`
- Exemplu: Dacă sunt 5 cornere, extrage "Peste 6.5 cornere"

---

## 📊 EXEMPLU OUTPUT EMAIL

```
📊 PATTERN_5.5: Echipa gazdă are multe cornere
   Probabilitate: 85%
   Tier: TOP_1-5 (Poziție 3)

   💰 COTE LIVE SUPERBET:

   📌 Încă un gol (peste 1.5) (Acum: 1 gol)
      Cotă: 1.78

   📌 Manchester City marchează
      Cotă: 1.45

   📌 Încă 2 cornere (peste 8.5) (Acum: 7 cornere)
      Cotă: 1.62

   📊 Situație actuală: 1 gol, 7 cornere, 2 cartonașe
```

---

## 🔄 WORKFLOW

1. **API SMART 5 detectează pattern** (≥70% probabilitate)
2. **email-notifier.js** apelează `BettingOdds.getOddsForMatch()`
3. **SUPERBET_ODDS_INTEGRATION** primește cererea
4. **SUPERBET_LIVE_ODDS** extrage:
   - Găsește Event ID pe Superbet
   - Extrage cote LIVE via SSE
   - Extrage statistici curente (goluri, cornere, cartonașe)
   - Determină cote relevante pentru pattern-uri
5. **email-notifier.js** formatează HTML-ul cu:
   - Descriere eveniment
   - Cotă LIVE
   - Situație curentă
   - Statistici meci

---

## ⚙️ CONFIGURARE

### Dependențe
- `curl` (pentru request-uri SSE)
- Module Node.js existente (nu sunt necesare instalări noi)

### Cache
- Event ID-urile sunt cache-uite 10 minute
- Reduce numărul de cereri către API

### Timeout
- 5 secunde pentru fiecare request SSE
- Normal să dea timeout (SSE = stream continuu)
- Output-ul este capturat chiar la timeout

---

## 🧪 TESTARE

### Test manual cu un meci LIVE:

```bash
cd /home/florian/superbet-analyzer
node -e "
const SuperbetLiveOdds = require('./SUPERBET_LIVE_ODDS');
const odds = new SuperbetLiveOdds();

(async () => {
    const patterns = [
        { name: 'PATTERN_5.5', team: 'gazda' }
    ];

    const result = await odds.getOddsForPatterns('Manchester City', 'Liverpool', patterns);
    console.log(JSON.stringify(result, null, 2));
})();
"
```

---

## 📝 NOTĂRI IMPORTANTE

### 1. Nume echipe
- Sistemul caută flexibil (acceptă orice ordine)
- Cache-urile folosesc nume lowercase
- Funcționează cu nume parțiale

### 2. Statistici curente
- Extrase din `inplay_stats` (SSE response)
- Goluri = home_team_score + away_team_score
- Cornere = home_team_corners + away_team_corners
- Cartonașe = home_team_yellow_cards + away_team_yellow_cards

### 3. Cote dinamice
- Se calculează automat pe baza statisticilor curente
- "Peste X.5" unde X = valoare curentă
- Pentru cornere: "Peste (X + 1.5)" pentru "încă 2 cornere"

### 4. Performanță
- Request SSE: ~5 secunde
- Cache Event ID: reduce cu ~2-3 secunde la check-uri ulterioare
- Nu blochează notificarea dacă cotele nu sunt disponibile

---

## 🚨 HANDLING ERORI

### Dacă meciul nu e găsit pe Superbet:
```
⚠️  Meci nu găsit pe Superbet
```
→ Notificarea se trimite FĂRĂ cote (pattern-ul este valid oricum)

### Dacă cotele nu sunt disponibile (suspendate):
```
⚠️  Nu am putut extrage cote LIVE
```
→ Notificarea se trimite FĂRĂ cote

### Dacă API-ul Superbet nu răspunde:
```
⚠️  Eroare extragere cote: [mesaj]
```
→ Notificarea se trimite FĂRĂ cote

**IMPORTANT:** Erori la extragere cote NU blochează trimiterea notificării!

---

## ✅ STATUS IMPLEMENTARE

- [x] Modul extragere cote LIVE (SUPERBET_LIVE_ODDS.js)
- [x] Modul integrare (SUPERBET_ODDS_INTEGRATION.js)
- [x] Modificare email-notifier.js
- [x] Detectare automată evenimente relevante
- [x] Afișare cote în email HTML
- [x] Afișare statistici curente
- [x] Cache Event ID
- [x] Handling erori
- [x] Documentație completă

---

## 🔮 ÎMBUNĂTĂȚIRI VIITOARE POSIBILE

1. **WebSocket în loc de SSE**
   - Conexiune persistentă
   - Update-uri în timp real
   - Mai rapid (~1-2s economie)

2. **Cote multiple case de pariuri**
   - Netbet, Betano, etc.
   - Comparare cote
   - Best odd highlight

3. **Istoric cote**
   - Salvare evoluție cote
   - Grafice trend
   - Alertă la schimbări mari

4. **ML pentru recomandări**
   - Pattern + cotă → probabilitate reală
   - Value bets detection
   - ROI calculation

---

**© 2025 - API SMART 5 + Superbet Live Odds Integration**
