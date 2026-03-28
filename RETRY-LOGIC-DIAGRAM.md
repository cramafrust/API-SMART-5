# 🔄 RETRY LOGIC - Extragere Cote Superbet

## Flow Complet

```
┌─────────────────────────────────────────────────────────┐
│  NOTIFICARE PATTERN LA PAUZĂ (HT)                      │
│  Email Notifier → getOddsForMatch()                    │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  FAZA 1: GĂSIRE EVENT ID                               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                         │
│  🔍 Încercare 1/6 (imediat)                           │
│     ↓ EȘEC → Așteptare 30s                            │
│  🔍 Încercare 2/6                                     │
│     ↓ EȘEC → Așteptare 30s                            │
│  🔍 Încercare 3/6                                     │
│     ↓ EȘEC → Așteptare 30s                            │
│  🔍 Încercare 4/6                                     │
│     ↓ EȘEC → Așteptare 30s                            │
│  🔍 Încercare 5/6                                     │
│     ↓ EȘEC → Așteptare 30s                            │
│  🔍 Încercare 6/6 (ULTIMA)                            │
│     ↓ EȘEC → RENUNȚĂ                                  │
│                                                         │
│  TIMEOUT: 3 minute MAX                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                         │
│  ✅ SUCCESS → Event ID găsit (ex: 5746382)            │
│     → MERGE LA FAZA 2                                  │
│                                                         │
│  ❌ EȘEC → Email FĂRĂ cote                            │
│     → "⚠️ Cote indisponibile"                         │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  FAZA 2: EXTRAGERE COTE LIVE                          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                         │
│  💰 Încercare 1/15 (imediat)                          │
│     ↓ EȘEC → Așteptare 40s                            │
│  💰 Încercare 2/15                                    │
│     ↓ EȘEC → Așteptare 40s                            │
│  💰 Încercare 3/15                                    │
│     ↓ EȘEC → Așteptare 40s                            │
│  💰 Încercare 4/15                                    │
│     ↓ EȘEC → Așteptare 40s                            │
│  💰 Încercare 5/15                                    │
│     ↓ ... (continuă până la 15)                       │
│  💰 Încercare 15/15 (ULTIMA)                          │
│     ↓ EȘEC → RENUNȚĂ                                  │
│                                                         │
│  TIMEOUT: 10 minute MAX                                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                         │
│  ✅ SUCCESS → Cote extrase                            │
│     → Email CU cote (FULL INFO)                        │
│                                                         │
│  ❌ EȘEC → Email FĂRĂ cote                            │
│     → "⚠️ Nu am putut extrage cote LIVE"              │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  EMAIL TRIMIS                                          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                         │
│  Varianta A: Email CU cote                            │
│  ✅ Pattern identificat: PATTERN_1.1                  │
│  📊 Probabilitate: 85%                                 │
│  💰 Cotă LIVE: 1.75 (Încă un gol peste 2.5)          │
│  📈 Situație: 2 goluri deja marcate                   │
│                                                         │
│  Varianta B: Email FĂRĂ cote                          │
│  ✅ Pattern identificat: PATTERN_1.1                  │
│  📊 Probabilitate: 85%                                 │
│  ⚠️  Cote indisponibile (Meciul nu găsit pe Superbet)│
└─────────────────────────────────────────────────────────┘
```

## ⚙️ Configurare Actuală (Optimizată)

### FAZA 1: Event ID
```javascript
MAX_RETRIES = 6
RETRY_DELAY = 30000ms (30s)
TIMEOUT_PER_REQUEST = 3000ms (3s)
TOTAL_MAX = 6 × 30s = 3 minute
```

### FAZA 2: Cote LIVE
```javascript
MAX_RETRIES = 15
RETRY_DELAY = 40000ms (40s)
TIMEOUT_PER_REQUEST = 3000ms (3s)
TOTAL_MAX = 15 × 40s = 10 minute
```

### TOTAL PROCES
```
WORST CASE: 3min + 10min = 13 minute
BEST CASE: < 10 secunde (găsește totul la prima)
AVERAGE CASE: 1-3 minute (găsește după 2-3 retry-uri)
```

## 🎯 De ce 2 faze separate?

1. **Event ID poate lipsi** dacă:
   - Meciul nu e disponibil pe Superbet
   - Numele echipelor diferă (ex: "Man United" vs "Manchester Utd")
   - Meciul e la pauză și Superbet l-a scos temporar

2. **Cotele pot lipsi** dacă:
   - Meciul e găsit, dar cotele nu sunt publicate încă
   - Superbet a oprit pariurile temporar (suspendare)
   - API-ul Superbet are lag

## 🛡️ Fail-Safe Mechanism

**Email se trimite ÎNTOTDEAUNA**, chiar dacă:
- ❌ Event ID nu e găsit → Email cu pattern, FĂRĂ cote
- ❌ Cotele nu sunt găsite → Email cu pattern, FĂRĂ cote
- ✅ Totul OK → Email COMPLET cu pattern ȘI cote

**Niciodată nu pierdem o notificare!**

## 📊 Statistici Observate (Real-World)

Din log-urile de aseară:
```
✅ SUCCESS RATE Event ID: ~80% (4/5 încercări)
✅ SUCCESS RATE Cote: ~60% (3/5 încercări când Event ID există)
⏱️  Timp mediu: 1-2 minute per notificare
```

**Probleme întâlnite:**
- Meciul nu găsit automat → Se repetă căutarea
- Timeout la extragere cote → Retry după 40s
- Cote incomplete → Se trimite ce s-a găsit

## 🔧 Îmbunătățiri Posibile

### Opțiune 1: Reduce timp TOTAL (mai agresiv)
```javascript
// Event ID
MAX_RETRIES = 4  // 4 × 20s = 80 secunde
RETRY_DELAY = 20000ms

// Cote
MAX_RETRIES = 8  // 8 × 30s = 4 minute
RETRY_DELAY = 30000ms

TOTAL = 80s + 4min = 5 minute MAX
```

### Opțiune 2: Backoff exponențial
```javascript
// Primul retry: 10s
// Al doilea: 20s
// Al treilea: 40s
// etc.
RETRY_DELAY = Math.min(10000 * Math.pow(2, attempt), 60000)
```

### Opțiune 3: Early exit când găsește
```javascript
// Oprește imediat când găsește cotele principale
// Nu mai așteaptă toate cotele
if (relevantOdds.length >= 1) return immediately;
```

## 📝 Concluzie

**Sistemul actual (13 minute MAX) este CONSERVATIV și SAFE:**
- ✅ Oferă timp suficient pentru găsire Event ID
- ✅ Oferă timp suficient pentru extragere cote
- ✅ Nu blochează alte notificări (procesare paralelă)
- ⚠️  Dar e LENT când toate retry-urile eșuează

**Pentru optimizare, recomand Opțiunea 1 (5 minute MAX).**
