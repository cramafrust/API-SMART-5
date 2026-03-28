# 🧪 SCRIPTURI DE TEST - INTEGRARE SUPERBET LIVE ODDS

## Descriere

Această documentație descrie scripturile de test pentru integrarea Superbet Live Odds cu API SMART 5.

---

## 📋 LISTA SCRIPTURI

### 1. **test-both-teams.js** ⭐ PRINCIPAL
**Scop:** Test complet pentru verificarea cotelor ambelor echipe și pattern-uri generale

**Folosire:**
```bash
cd "/home/florian/API SMART 5"
node test-both-teams.js
```

**Ce testează:**
- Pattern pentru echipa gazdă (team: 'gazda')
- Pattern pentru echipa oaspete (team: 'oaspete')
- Pattern general pentru meci (team: 'meci')

**Output așteptat:**
```
📌 [PATTERN_GAZDA_SUTURI]
   Independiente Petrolero peste 1.5 goluri
   Cotă: 1.70
   Situație: 1 acum
   Tip: team_1_total_goals

📌 [PATTERN_OASPETE_ATACURI]
   Guabira peste 1.5 goluri
   Cotă: 1.50
   Situație: 1 acum
   Tip: team_2_total_goals

📌 [PATTERN_GOL_MECI]
   Încă un gol (peste 2.5)
   Cotă: 1.14
   Situație: 2 acum
   Tip: any_goal
```

**Modificare pentru alte meciuri:**
```javascript
// Linia 10-11
const homeTeam = 'Manchester City';  // Schimbă cu echipa gazdă
const awayTeam = 'Liverpool';        // Schimbă cu echipa oaspete
```

---

### 2. **debug-available-odds.js**
**Scop:** Afișează TOATE cotele extrase din API pentru un meci

**Folosire:**
```bash
node debug-available-odds.js
```

**Output:**
```
💰 TOATE COTELE DISPONIBILE (allOdds):
   peste_2_5: 1.14
   peste_3_5: 1.80
   echipa_1_peste_1_5: 1.70
   echipa_1_peste_2_5: 4.05
   echipa_2_peste_1_5: 1.50
   echipa_2_peste_2_5: 3.30
   gg_da: 2.65
   gg_nu: 1.42
```

**Când să folosești:**
- Debugging - când cotele nu apar în test
- Verificare disponibilitate cote specifice
- Înțelegere format keys

---

### 3. **investigate-all-markets.js**
**Scop:** Afișează TOATE piețele disponibile pe Superbet pentru un eventId

**Folosire:**
```bash
node investigate-all-markets.js
```

**Output:**
```
1. Final
   - 1 (Independiente Petrolero câştigă meciul): 3.00
   - X (Egalitate): 2.65
   - 2 (Guabira câştigă meciul): 2.55

4. Total goluri Independiente Petrolero
   - Sub 1.5: 2.05
   - Peste 1.5: 1.65
   - Sub 2.5: 1.14
   - Peste 2.5: 3.95

5. Total goluri Guabira
   - Sub 1.5: 2.22
   - Peste 1.5: 1.53
   ...
```

**Când să folosești:**
- Căutare piețe noi pentru a le adăuga în sistem
- Verificare exactă a numelor piețelor
- Debugging când o piață nu e găsită

**Modificare eventId:**
```javascript
// Linia 13
const eventId = '11359110';  // Schimbă cu eventId-ul dorit
```

---

### 4. **test-realistic-patterns.js**
**Scop:** Test cu pattern-uri generale și pattern pentru echipa gazdă

**Folosire:**
```bash
node test-realistic-patterns.js
```

**Ce testează:**
- Pattern general (va afișa "Încă un gol")
- Pattern pentru gazda (va afișa "Total goluri echipa 1")
- Pattern cu team: 'general' (va afișa "Încă un gol")

**Când să folosești:**
- Verificare rapidă funcționalitate de bază
- Test după modificări în cod

---

### 5. **test-superbet-integration.js**
**Scop:** Test inițial de integrare (mai simplu, folosit pentru debugging)

**Folosire:**
```bash
node test-superbet-integration.js
```

**Când să folosești:**
- Verificare conexiune la API Superbet
- Test rapid după restart sistem
- Debugging probleme de conectivitate

---

## 🔧 MODIFICARE MECIURI DE TEST

### Pentru toate scripturile care folosesc nume echipe:

**1. Găsește meciul LIVE:**
```bash
# Afișează meciuri LIVE pe Superbet
curl -s "https://production-superbet-offer-ro.freetls.fastly.net/v2/ro-RO/events/by-date?offerState=live&startDate=$(date +%Y-%m-%d)%2000:00:00&endDate=$(date +%Y-%m-%d)%2023:59:59&sportId=5" | python3 -m json.tool | grep -A 2 "matchName"
```

**2. Modifică scriptul:**
```javascript
const homeTeam = 'Numele Echipei Gazdă';  // Exact ca pe Superbet
const awayTeam = 'Numele Echipei Oaspete';
```

**3. Rulează testul:**
```bash
node test-both-teams.js
```

---

## 📊 INTERPRETARE REZULTATE

### ✅ Test reușit:
```
✅ Event ID găsit: 11359110
✅ Găsite 3 cote relevante
```

### ⚠️ Meci nu găsit:
```
⚠️  Meci nu găsit pe Superbet
```
**Soluții:**
- Verifică spelling-ul numelor echipelor
- Verifică că meciul este LIVE pe Superbet
- Încearcă cu nume parțiale

### ⚠️ Cote nu găsite:
```
⚠️  Nu s-au găsit cote relevante pentru pattern-urile detectate
```
**Soluții:**
- Rulează `investigate-all-markets.js` să vezi ce piețe sunt disponibile
- Verifică că piața "Total goluri [echipă]" există
- Verifică că threshold-ul calculat există (ex: "peste 4.5" poate să nu existe)

### ❌ Eroare API:
```
❌ Eroare extragere cote: [mesaj]
```
**Soluții:**
- Verifică conexiunea internet
- Așteaptă câteva secunde și reîncearcă
- Verifică că API-ul Superbet este disponibil

---

## 🎯 FLOW DE TESTARE RECOMANDAT

### 1. Test rapid (după modificări):
```bash
node test-both-teams.js
```

### 2. Debugging (dacă cotele lipsesc):
```bash
node debug-available-odds.js
```

### 3. Investigare profundă (dacă o piață lipsește):
```bash
node investigate-all-markets.js
```

### 4. Test pattern-uri specifice:
```bash
node test-realistic-patterns.js
```

---

## 💡 TIPS & TRICKS

### Găsire rapidă Event ID:
```bash
# Caută meci specific
curl -s "https://production-superbet-offer-ro.freetls.fastly.net/v2/ro-RO/events/by-date?offerState=live&startDate=$(date +%Y-%m-%d)%2000:00:00&endDate=$(date +%Y-%m-%d)%2023:59:59&sportId=5" | python3 -m json.tool | grep -B 5 "Liverpool"
```

### Testare manuală cu curl:
```bash
# Verifică cote LIVE pentru un eventId
curl -s --max-time 5 "https://production-superbet-offer-ro.freetls.fastly.net/v3/subscription/ro-RO/events?events=11359110" \
  -H "Accept: text/event-stream" \
  -H "Accept-Language: ro-RO" \
  -H "Origin: https://superbet.ro" \
  --compressed 2>&1 | head -20
```

### Verificare cache:
Cache-ul se păstrează în memorie pentru 10 minute. Pentru a reseta cache-ul, restartează scriptul.

---

## 🐛 TROUBLESHOOTING COMMON

### Problema: "SyntaxError: Identifier 'awayTeamPart' has already been declared"
**Soluție:** Actualizează la versiunea nouă a `SUPERBET_LIVE_ODDS.js` (acest bug a fost rezolvat)

### Problema: Cotele afișează gol când pattern-ul e pentru cornere
**Soluție:** Actualizează la versiunea cu priorități exclusive (acest bug a fost rezolvat)

### Problema: "echipa_1_marcheaza_da" nu există
**Soluție:** Actualizează la versiunea care folosește "Total goluri echipă" în loc de "Marchează DA"

### Problema: Testul durează mult timp
**Normal:** Request-ul SSE are timeout de 5 secunde. Timpul total ~5-8 secunde.

---

## 📝 CREARE TEST NOU

Template pentru un test nou:

```javascript
/**
 * TEST: Descriere scurtă
 */

const SuperbetOdds = require('./SUPERBET_ODDS_INTEGRATION');

async function testNume() {
    console.log('\\n' + '='.repeat(80));
    console.log('🧪 TEST DESCRIERE');
    console.log('='.repeat(80) + '\\n');

    const homeTeam = 'Echipa Gazdă';
    const awayTeam = 'Echipa Oaspete';

    const patterns = [
        {
            name: 'PATTERN_TEST',
            team: 'gazda',  // sau 'oaspete', 'meci', 'general'
            probability: 85
        }
    ];

    const result = await SuperbetOdds.getOddsForMatch(homeTeam, awayTeam, patterns);

    if (!result.available) {
        console.log('❌ Cote indisponibile\\n');
        return;
    }

    // Afișează rezultate
    console.log(JSON.stringify(result.superbet.relevantOdds, null, 2));
}

testNume().then(() => {
    console.log('🏁 Test finalizat\\n');
    process.exit(0);
}).catch(error => {
    console.error('❌ EROARE:', error.message);
    process.exit(1);
});
```

---

**© 2025 - API SMART 5 Testing Suite**
**Data:** 3 Decembrie 2025
