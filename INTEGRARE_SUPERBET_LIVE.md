# 🎯 INTEGRARE SUPERBET LIVE ODDS - DOCUMENTAȚIE COMPLETĂ

## ✅ IMPLEMENTARE COMPLETĂ ȘI ACTUALIZATĂ

Integrare realizată pentru a adăuga **cote LIVE** de la Superbet în notificările email ale API SMART 5.

**Data ultimei actualizări:** 3 Decembrie 2025

---

## 📁 FIȘIERE MODIFICATE/ADĂUGATE

### 1. **Fișiere principale:**

#### `/home/florian/superbet-analyzer/SUPERBET_LIVE_ODDS.js`
- Modul principal pentru extragerea cotelor LIVE de la Superbet
- Funcționalități:
  - Găsește Event ID pentru meci (cu cache 10 minute)
  - Extrage cote LIVE via API SSE
  - Determină cote relevante pentru pattern-uri detectate
  - Extrage statistici curente (goluri total, goluri echipă 1, goluri echipă 2, cornere, cartonașe)
  - Logică cu priorități exclusive pentru fiecare tip de pattern

#### `/home/florian/API SMART 5/SUPERBET_ODDS_INTEGRATION.js`
- Wrapper pentru integrare cu API SMART 5
- Compatibil cu interfața `BettingOdds` existentă
- Convertește formatul cotelor pentru email-notifier

#### `/home/florian/API SMART 5/email-notifier.js`
- **Linia 10-11:** Înlocuit `BETTING_ODDS_SCRAPER` cu `SUPERBET_ODDS_INTEGRATION`
- **Linii 245-289 (x3 apariții):** Modificat afișarea cotelor în HTML pentru a include:
  - Cote LIVE relevante pentru fiecare pattern
  - Descriere eveniment (ex: "Echipa 1 peste 1.5 goluri")
  - Valoare curentă (ex: "Acum: 1 gol")
  - Statistici curente meci (goluri total, goluri echipe, cornere, cartonașe)

### 2. **Scripturi de test:**

#### `test-both-teams.js`
- Test complet pentru cote ambele echipe
- Verifică toate tipurile de pattern-uri

#### `debug-available-odds.js`
- Afișează toate cotele disponibile pe Superbet
- Util pentru debugging

#### `investigate-all-markets.js`
- Afișează TOATE piețele Superbet pentru un meci
- Identifică piețe noi disponibile

---

## 🎯 EVENIMENTE SUPORTATE

Sistemul extrage automat cote pentru următoarele evenimente, folosind o **logică cu priorități exclusive**:

### **PRIORITATE 1: CORNERE**
- Detectare: Pattern conține "corner" sau "cornere"
- Cotă extrasă: `PESTE (cornere_actuale + 1.5)`
- Exemplu: Dacă sunt 5 cornere, extrage "Peste 6.5 cornere"
- Descriere afișată: "Încă 2 cornere (peste 6.5)"

### **PRIORITATE 2: CARTONAȘE**
- Detectare: Pattern conține "cartonaș" sau "card"
- Cotă extrasă: `PESTE (cartonase_actuale + 0.5)`
- Exemplu: Dacă sunt 3 cartonașe, extrage "Peste 3.5 cartonașe"
- Descriere afișată: "Încă un cartonaș (peste 3.5)"

### **PRIORITATE 3: GOL MARCAT DE ECHIPA GAZDĂ**
- Detectare: `pattern.team === 'gazda'`
- **IMPORTANT**: Folosește "Total goluri echipa 1" în loc de "Echipa marchează DA"
- Cotă extrasă: `TOTAL GOLURI ECHIPA 1 PESTE (goluri_actuale_echipa_1 + 0.5)`
- Exemplu: Dacă echipa gazdă are 1 gol, extrage "Echipa 1 peste 1.5 goluri"
- Descriere afișată: "Manchester City peste 1.5 goluri"
- **Motivație**: Cota "Echipa marchează DA" dispare după ce echipa a marcat deja

### **PRIORITATE 4: GOL MARCAT DE ECHIPA OASPETE**
- Detectare: `pattern.team === 'oaspete'`
- **IMPORTANT**: Folosește "Total goluri echipa 2" în loc de "Echipa marchează DA"
- Cotă extrasă: `TOTAL GOLURI ECHIPA 2 PESTE (goluri_actuale_echipa_2 + 0.5)`
- Exemplu: Dacă echipa oaspete are 1 gol, extrage "Echipa 2 peste 1.5 goluri"
- Descriere afișată: "Liverpool peste 1.5 goluri"
- **Motivație**: Cota "Echipa marchează DA" dispare după ce echipa a marcat deja

### **PRIORITATE 5: ÎNCĂ UN GOL ÎN MECI (GENERAL)**
- Detectare: Pattern general (nu e nici gazda, nici oaspete, nici cornere, nici cartonașe)
- Cotă extrasă: `PESTE (goluri_totale_actuale + 0.5)`
- Exemplu: Dacă scorul e 2-1 (3 goluri), extrage "Peste 3.5 goluri"
- Descriere afișată: "Încă un gol (peste 3.5)"

---

## 🔄 LOGICĂ PRIORITĂȚI EXCLUSIVE

**IMPORTANT**: Fiecare pattern afișează DOAR o singură cotă, determinată de primul match din lanțul de priorități:

```javascript
if (pattern.name.includes('corner')) {
    // Afișează DOAR cotă cornere
} else if (pattern.name.includes('card')) {
    // Afișează DOAR cotă cartonașe
} else if (pattern.team === 'gazda') {
    // Afișează DOAR cotă total goluri echipa 1
} else if (pattern.team === 'oaspete') {
    // Afișează DOAR cotă total goluri echipa 2
} else {
    // Afișează DOAR cotă total goluri meci
}
```

Această logică previne afișarea multiplă de cote pentru același pattern (ex: un pattern de cornere nu va afișa și cote pentru goluri).

---

## 📊 PIEȚE SUPERBET UTILIZATE

### 1. **Total goluri meci**
- Nume piață: "Total goluri"
- Cote extrase: Peste 0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5
- Format key: `peste_X_5` (ex: `peste_2_5`)

### 2. **Total goluri echipa 1** (PIVOTAL)
- Nume piață: "Total goluri [Nume Echipă Gazdă]"
- Cote extrase: Peste 0.5, 1.5, 2.5
- Format key: `echipa_1_peste_X_5` (ex: `echipa_1_peste_1_5`)
- **Folosită pentru**: Pattern-uri echipă gazdă (indiferent dacă au marcat deja sau nu)

### 3. **Total goluri echipa 2** (PIVOTAL)
- Nume piață: "Total goluri [Nume Echipă Oaspete]"
- Cote extrase: Peste 0.5, 1.5, 2.5
- Format key: `echipa_2_peste_X_5` (ex: `echipa_2_peste_1_5`)
- **Folosită pentru**: Pattern-uri echipă oaspete (indiferent dacă au marcat deja sau nu)

### 4. **Ambele marchează (GG)**
- Nume piață: "Ambele echipe marchează"
- Cote extrase: DA, NU
- Format key: `gg_da`, `gg_nu`

### 5. **Total cornere**
- Nume piață: "Total cornere" (dacă există)
- Cote extrase: Peste X.5
- Format key: `cornere_peste_X_5`

### 6. **Total cartonașe**
- Nume piață: "Total cartonașe" (dacă există)
- Cote extrase: Peste X.5
- Format key: `cartonase_peste_X_5`

---

## 📊 EXEMPLU OUTPUT EMAIL

```
📊 PATTERN_SUTURI_GAZDA: Echipa gazdă are multe șuturi
   Probabilitate: 85%
   Tier: TOP_1-5 (Poziție 3)

   💰 COTE LIVE SUPERBET:

   📌 Manchester City peste 1.5 goluri
      Cotă: 1.70
      (Situație: 1 gol acum)

   📊 Situație actuală: 2 goluri total, 7 cornere, 2 cartonașe

---

📊 PATTERN_ATACURI_OASPETE: Echipa oaspete presează
   Probabilitate: 78%
   Tier: TOP_1-5 (Poziție 5)

   💰 COTE LIVE SUPERBET:

   📌 Liverpool peste 1.5 goluri
      Cotă: 1.50
      (Situație: 1 gol acum)

   📊 Situație actuală: 2 goluri total, 7 cornere, 2 cartonașe

---

📊 PATTERN_GOL_GENERAL: Meci deschis
   Probabilitate: 90%
   Tier: TOP_1-5 (Poziție 1)

   💰 COTE LIVE SUPERBET:

   📌 Încă un gol (peste 2.5)
      Cotă: 1.14
      (Situație: 2 goluri acum)

   📊 Situație actuală: 2 goluri total, 7 cornere, 2 cartonașe
```

---

## 🔄 WORKFLOW COMPLET

1. **API SMART 5 detectează pattern** (≥70% probabilitate)
2. **STATS_MONITOR.js** filtrează pattern-urile (păstrează doar cel cu probabilitate maximă per categorie+echipă)
3. **email-notifier.js** apelează `BettingOdds.getOddsForMatch(homeTeam, awayTeam, patterns)`
4. **SUPERBET_ODDS_INTEGRATION** primește cererea
5. **SUPERBET_LIVE_ODDS** extrage:
   - Găsește Event ID pe Superbet (cu cache 10 min)
   - Extrage cote LIVE via SSE
   - Extrage statistici curente:
     - `goals`: total goluri meci
     - `homeGoals`: goluri echipa gazdă
     - `awayGoals`: goluri echipa oaspete
     - `corners`: total cornere
     - `cards`: total cartonașe
   - Determină cote relevante pentru fiecare pattern folosind priorități exclusive
6. **email-notifier.js** formatează HTML-ul cu:
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
- Format cache key: `${team1.toLowerCase()}_${team2.toLowerCase()}`

### Timeout
- 5 secunde pentru fiecare request SSE
- Normal să dea timeout (SSE = stream continuu)
- Output-ul este capturat chiar la timeout via `error.stdout`

---

## 🧪 TESTARE

### Test complet cu ambele echipe:

```bash
cd "/home/florian/API SMART 5"
node test-both-teams.js
```

**Output așteptat:**
```
📌 [PATTERN_GAZDA_SUTURI]
   Independiente Petrolero peste 1.5 goluri
   Cotă: 1.70
   Situație: 1 acum

📌 [PATTERN_OASPETE_ATACURI]
   Guabira peste 1.5 goluri
   Cotă: 1.50
   Situație: 1 acum

📌 [PATTERN_GOL_MECI]
   Încă un gol (peste 2.5)
   Cotă: 1.14
   Situație: 2 acum
```

### Debug toate cotele disponibile:

```bash
node debug-available-odds.js
```

### Investigare toate piețele Superbet:

```bash
node investigate-all-markets.js
```

---

## 📝 NOTĂRI IMPORTANTE

### 1. Nume echipe
- Sistemul caută flexibil (acceptă orice ordine)
- Cache-urile folosesc nume lowercase
- Funcționează cu nume parțiale (primele 8 caractere)

### 2. Statistici curente
- Extrase din `inplay_stats` (SSE response)
- **Goluri total** = `home_team_score + away_team_score`
- **Goluri echipa 1** = `home_team_score`
- **Goluri echipa 2** = `away_team_score`
- **Cornere** = `home_team_corners + away_team_corners`
- **Cartonașe** = `home_team_yellow_cards + away_team_yellow_cards`

### 3. Cote dinamice - Calculare automată
- **Gol meci**: `Peste (goluri_totale + 0.5)`
- **Gol echipa 1**: `Total goluri echipa 1 peste (goluri_echipa_1 + 0.5)`
- **Gol echipa 2**: `Total goluri echipa 2 peste (goluri_echipa_2 + 0.5)`
- **Cornere**: `Peste (cornere_actuale + 1.5)` (pentru "încă 2 cornere")
- **Cartonașe**: `Peste (cartonase_actuale + 0.5)`

### 4. De ce "Total goluri echipă" în loc de "Echipa marchează DA"?
**Problemă identificată:**
- Cota "Echipa marchează - DA" dispare de pe Superbet după ce echipa a marcat deja
- Dacă pattern-ul apare după ce echipa a marcat, nu găseam cotă

**Soluție:**
- Folosim piața "Total goluri echipă peste X.5"
- Această piață rămâne disponibilă INDIFERENT dacă echipa a marcat sau nu
- Pentru echipă cu 1 gol → "peste 1.5" = mai marchează încă un gol
- Pentru echipă cu 0 goluri → "peste 0.5" = marchează primul gol
- Funcționează pentru orice scor!

### 5. Performanță
- Request SSE: ~5 secunde
- Cache Event ID: reduce cu ~2-3 secunde la check-uri ulterioare (10 min cache)
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

### Dacă nu există cota specifică (ex: "peste 4.5 cornere" nu e disponibilă):
```
⚠️  Nu s-au găsit cote relevante pentru pattern-urile detectate
```
→ Notificarea se trimite cu pattern-ul dar fără cotă

**IMPORTANT:** Erori la extragere cote NU blochează trimiterea notificării! Pattern-urile rămân valide și se trimit indiferent de disponibilitatea cotelor.

---

## ✅ STATUS IMPLEMENTARE

- [x] Modul extragere cote LIVE (SUPERBET_LIVE_ODDS.js)
- [x] Modul integrare (SUPERBET_ODDS_INTEGRATION.js)
- [x] Modificare email-notifier.js
- [x] Detectare automată evenimente relevante
- [x] Afișare cote în email HTML
- [x] Afișare statistici curente (total + echipe separate)
- [x] Cache Event ID (10 minute)
- [x] Handling erori
- [x] Logică priorități exclusive (un pattern = o singură cotă)
- [x] Extragere "Total goluri echipă" pentru echipe specifice
- [x] Rezolvare problemă "Echipa marchează DA" dispare după gol
- [x] Documentație completă
- [x] Scripturi de test complete

---

## 🔧 SCRIPTURI UTILE

### Testare rapidă integrare:
```bash
node test-both-teams.js
```

### Verificare cote disponibile pentru un meci:
```bash
node debug-available-odds.js
# Modifică homeTeam și awayTeam în fișier
```

### Explorare piețe Superbet:
```bash
node investigate-all-markets.js
# Vezi TOATE piețele disponibile pentru un eventId
```

### Test pattern-uri realiste:
```bash
node test-realistic-patterns.js
```

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

5. **Optimizare cache**
   - Cache cote (nu doar Event ID)
   - TTL configurabil
   - Invalidare la schimbări semnificative

6. **Support pentru mai multe sporturi**
   - Baschet (total puncte, handicap)
   - Tenis (seturi, game-uri)
   - Hockey (total goluri)

---

## 📞 SUPORT ȘI TROUBLESHOOTING

### Cotele nu apar în email:
1. Verifică că meciul este LIVE pe Superbet
2. Rulează `debug-available-odds.js` pentru a vedea cotele disponibile
3. Verifică că pattern-ul are `team` setat corect ('gazda', 'oaspete', sau altceva)
4. Verifică logs-urile în consolă pentru erori

### Event ID nu se găsește:
1. Verifică că numele echipelor din pattern match cu numele de pe Superbet
2. Cache-ul poate fi învechit - așteaptă 10 minute sau restartează sistemul
3. Meciul poate să nu fie încă LIVE pe Superbet

### Cota "peste X.5" lipsește:
1. Superbet poate să nu ofere acea linie specifică (ex: "peste 8.5 cornere")
2. Piața poate fi suspendată temporar
3. Verifică cu `investigate-all-markets.js` ce piețe sunt disponibile

---

**© 2025 - API SMART 5 + Superbet Live Odds Integration**
**Versiune:** 2.0 (actualizată cu Total goluri echipă)
**Data:** 3 Decembrie 2025
