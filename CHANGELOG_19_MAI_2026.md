# Changelog — 18-19 mai 2026

Documentație completă a tuturor modificărilor făcute în sesiunea din 18-19 mai 2026.

---

## 🐛 BUG-URI REPARATE

### 1. Scraper Flashscore — case-sensitive (CRITIC, istoric)

**Problemă**: `STATS_MAPPING` în `STATS_MONITOR.js` avea chei case-sensitive. Flashscore folosea litere mici:
- `Corner Kicks` → `Corner kicks` (schimbat ianuarie 2026)
- `Expected Goals (xG)` → `Expected goals (xG)` (lowercase dintotdeauna)
- `Ball Possession` → `Ball possession` (lowercase dintotdeauna)
- `Yellow Cards`, `Red Cards`, `Goalkeeper Saves` — toate cu majuscule în cod, lowercase în API

**Impact**: Din 3045 fișiere HT analizate:
- xG: **0% extras** vreodată
- Posesie: **0% extrasă** vreodată
- Cornere: 95-99% până dec 2025, **0% din ian 2026**

**Consecință**: Pattern-urile P10/P11/P12/P13/P18 (care depind de xG/posesie) **nu s-au activat NICIODATĂ** în istoria sistemului.

**Fișiere modificate**: `STATS_MONITOR.js` (case-insensitive lookup)

**Verificare meciul de referință**: Manchester City vs Brentford, 09.05.2026 (matchId `4IfWN9Ha`). La pauză avea 15 șuturi vs 1, xG 1.13 vs 0.01, posesie 69%-31%, dar sistemul vedea xG/posesie null și activa doar PATTERN_2.5 cu 73.33%.

---

### 2. Duplicate raport prematch

**Problemă 1 — Deduplicare insuficientă**: Cheia era `matchId + patternId + team + date`. Dar S15/S16/S17 sunt pattern-uri diferite care produc același pronostic logic ("10+ șuturi"). Au generat duplicate.

**Problemă 2 — Race condition**: Flag-ul `isDailyEmailSent` era scris DUPĂ trimitere. Pe 08.04, două procese paralele (cron `0 8` + restart manual) au trecut amândouă de check.

**Fișiere modificate**:
- `PREMATCH_TRACKER.js` — dedup pe team+category+side
- `PRE_MATCH_STREAKS.js` — lock atomic, flag scris ÎNAINTE

**Curățare istorică**: 68 duplicate eliminate din `data/tracking/prematch.json` (2920 → 2852).

---

### 3. Duplicate raport zilnic HT (Atletico Madrid vs Girona, 17.05)

**Problemă**: Pentru meciuri care satisfac multiple pattern-uri (ex: PATTERN_22 nivel meci + PATTERN_1.3 pe oaspete), `saveNotification` salva o înregistrare SEPARATĂ în tracking pentru fiecare. Email-ul real era unul singur, dar raportul citea N rânduri.

**Impact dublu**:
- Confuzie în raport (același pronostic de N ori)
- Acuratețe distorsionată (1 win se număra de N ori)

**Fișiere modificate**:
- `core/notifications.js` — salvează DOAR pattern-ul cu probabilitatea maximă per meci
- `NOTIFICATION_TRACKER.js` — dedup logic pe matchId + tipPredicție
- `DAILY_REPORT_GENERATOR.js` — dedup la afișare (plasă de siguranță pentru date istorice)
- `PATTERN_DESCRIPTOR.js` — helper `getPredictionKey()` pentru clasificare

**Curățare istorică**: 114 duplicate eliminate din `notifications_tracking.json` (735 → 620).

**Validare**: Raport 17.05 — înainte 42 notificări (cu duplicate) → după 36 unice, success rate REAL 85.7%.

---

### 4. Enunțuri pattern P21-P25 neclare

**Problemă**: P21-P25 nu existau în `formatExplicitMessage`. Foloseau fallback generic ("MECI A ÎNDEPLINIT PATTERN-UL PATTERN_22, ECHIPA ÎN CAUZĂ A MARCAT") — nimic concret, greșit gramatical pentru pattern-uri nivel meci.

**Fișier modificat**: `PATTERN_DESCRIPTOR.js`

**Enunțuri noi** (stil ca P1-P10, cu fapte concrete):
- **P21** (egal ≥1-1 + 10+ șuturi pe poartă): "CELE DOUĂ ECHIPE AU MARCAT CÎTE UN GOL... MECIURI EXTREM DE DESCHISE..."
- **P22** (1 gol HT + 6+ șuturi): "S-A MARCAT UN SINGUR GOL... ORICARE DIN CELE DOUĂ ECHIPE A MAI MARCAT..."
- **P23** (2+ goluri HT + 8+ șuturi): "S-AU MARCAT 2+ GOLURI... MECIURI SPECTACULOASE..."
- **P24** (8+ cornere total HT): "8+ CORNERE... PRESIUNE OFENSIVĂ CONSTANTĂ..."
- **P25** (HT 2-0 sau 0-2): "CONDUCE CU 2-0... ACEST AVANTAJ EVIDENT... INDIFERENT DE CARE ECHIPĂ..."

---

## 🛡️ PREVENȚIE & MONITORIZARE

### 5. Verificare lunară schemă Flashscore

**Fișier nou**: `FLASHSCORE_SCHEMA_CHECK.js`

Verifică pe 10 meciuri recente dacă toate cheile așteptate (xG, posesie, cornere etc.) apar în răspunsul Flashscore. Sugerează renumiri parțiale dacă apar.

**Cron nou** (instalat automat):
```
0 10 1 * * cd "/home/florian/API SMART 5" && /usr/bin/node FLASHSCORE_SCHEMA_CHECK.js >> logs/flashscore-schema-check.log 2>&1
```

Email automat doar dacă găsește issues. Test acum: niciun issue ✓.

---

### 6. Backfill statistici HT istorice

**Fișier nou**: `BACKFILL_HT_STATS.js`

Recolectează xG/posesie/cornere reale pentru fișiere `stats-*-HT.json` afectate de bug.

**Rezultate**: 1706 OK / 52 fail / 1 skip (din 1759 candidate). Meciul de referință City vs Brentford acum are date reale.

---

## 🚀 BACKEND — SPRINT 2 (robustețe)

### 7. PM2 — Process Manager

**Fișier nou**: `ecosystem.config.js`

Configurație PM2 pentru:
- **Auto-restart la crash** (instant, nu așteaptă următorul cron)
- **Restart programat zilnic 08:00** (înlocuiește cron-ul `pkill + start` care era fragil)
- **Memory limit 1GB** (previne memory leaks)
- **Max 10 restarturi** consecutive (oprește dacă bug persistent)
- **Logs centralizate** în `logs/pm2/`

**Status**: NU activat (ar opri procesul live). Activare manuală:
```bash
cd "/home/florian/API SMART 5"
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # urmează instrucțiunile (cere sudo o singură dată)
```

### 8. Rate limiter Flashscore

**Fișier modificat**: `flashscore-api.js`

Coadă globală cu min 250ms între requests (~4 req/s peak). Previne IP ban când multiple module bat în paralel. Non-invaziv, transparent pentru codul existent.

### 9. Crash state auto-clear

**Fișier modificat**: `WATCHDOG.js`

Auto-clear pentru flag-uri `.crash-state.json` mai vechi de 24h. Bug istoric: crash din 08.04 rămânea SET permanent. Reset al fișierului.

### 10. Integrare cu Supabase

**Fișier modificat**: `SUBSCRIBER_MANAGER.js`

`notifyAll()` cheamă paralel webhook-ul Vercel `https://smart.frust.ro/api/webhook` după ce notifică abonații din JSON local. Eșecul nu afectează fluxul principal.

---

## 🎨 FRONTEND — SPRINT 1 (Smart Predictions — smart.frust.ro)

### 11. Sistem conturi complet

**Pagini noi**:
- `/register` — signup cu Supabase Auth (nume + email + parolă)
- `/login` — email + parolă + link "Am uitat parola"
- `/account` — dashboard user (plan, trial countdown, preferințe READ)
- `/account/preferences` — edit min_probability, notification_types, leagues
- `/reset-password` + `/reset-password/confirm` — recuperare parolă

**Tabele Supabase**:
- `subscriptions` (user_id, plan, active, expires_at)
- `preferences` (user_id, leagues[], min_probability, notification_types[])
- Trigger automat: la signup → creează trial 7 zile + preferences default
- RLS policies — userul vede doar propriile date

### 12. Pagini publice noi

- `/pricing` — Trial 7 zile vs Pro (Stripe TODO)
- `/faq` — 10 întrebări frecvente
- `/performance` — statistici lunare + trust signals
- `/terms` + `/privacy` — legal GDPR

### 13. Infrastructură UI

**Componente noi reutilizabile**:
- `Header.tsx` (server component) + `HeaderUserMenu.tsx` (client) — meniu cu logout
- `Footer.tsx` — footer comun pe toate paginile

**SEO**:
- `sitemap.ts` și `robots.ts` — sitemap.xml + robots.txt automat
- Metadata complete: OG tags, Twitter cards, keywords

---

## 🖥️ DASHBOARD ADMIN (localhost:3001)

### 14. Health check endpoint

**Fișier nou**: `src/app/api/health/route.ts`

Returnează în JSON starea reală a sistemului:
- Proces API SMART 5 (PID, uptime, RAM, count)
- Last log timestamp + healthy boolean
- Crash state actual
- Error count în ultimele 24h + ultima eroare
- Status cron jobs (daily-collector, master, report, git-push)
- Disk usage logs

### 15. HealthWidget pe dashboard

**Fișier nou**: `src/components/HealthWidget.tsx`

Plasat în pagina LIVE (sus). Semafor verde/roșu cu metrici live, refresh la 30s. Vezi instant dacă sistemul e sus.

### 16. Auth dashboard (PIN opțional)

**Fișiere noi**:
- `src/middleware.ts` — redirect la /login dacă nu e logat
- `src/app/login/page.tsx` — formular PIN
- `src/app/api/auth/route.ts` — validare PIN + setare cookie

**Status**: Auth e DEZACTIVAT dacă `DASHBOARD_PIN` lipsește din env. Activare:
```bash
echo "DASHBOARD_PIN=1234" >> /home/florian/api-smart-5-dashboard/.env.local
# apoi restart dashboard
```

---

## 📁 FIȘIERE NOI (sumar)

### API SMART 5
- `ecosystem.config.js` — PM2 config
- `FLASHSCORE_SCHEMA_CHECK.js` — verificare lunară
- `BACKFILL_HT_STATS.js` — backfill istoric
- `CHANGELOG_19_MAI_2026.md` — acest fișier

### Smart Predictions
- `src/app/pricing/page.tsx`
- `src/app/faq/page.tsx`
- `src/app/performance/page.tsx`
- `src/app/terms/page.tsx`
- `src/app/privacy/page.tsx`
- `src/app/register/page.tsx`
- `src/app/login/page.tsx`
- `src/app/account/page.tsx`
- `src/app/account/preferences/page.tsx`
- `src/app/account/preferences/PreferencesForm.tsx`
- `src/app/reset-password/page.tsx`
- `src/app/reset-password/confirm/page.tsx`
- `src/app/sitemap.ts`
- `src/app/robots.ts`
- `src/components/Header.tsx`
- `src/components/HeaderUserMenu.tsx`
- `src/components/Footer.tsx`
- `src/lib/supabase-browser.ts`
- `src/lib/supabase-server.ts`

### Dashboard admin
- `src/app/api/health/route.ts`
- `src/components/HealthWidget.tsx`
- `src/middleware.ts`
- `src/app/login/page.tsx`
- `src/app/api/auth/route.ts`

---

## 📋 TODO — Ce mai avem de făcut

### 🔴 Priority HIGH

- [ ] **Stripe integration** — `/pricing` cu checkout real (necesită cont Stripe + decizie prețuri)
- [ ] **Activare PM2** — `pm2 start ecosystem.config.js && pm2 save` (înlocuiește cron-ul de restart)
- [ ] **Welcome email** — la signup, trimite email "Cum funcționează sistemul"
- [ ] **API stats publică** — `/performance` să citească date live, nu hardcodate
- [ ] **Custom SMTP Supabase** — email-urile de confirmare să vină de la `notifications@frust.ro` (acum vin de la Supabase default)

### 🟠 Priority MEDIUM

- [ ] **Activare PIN dashboard** — adaugă `DASHBOARD_PIN` în `.env.local`
- [ ] **Cloudflare Tunnel** — acces remote la dashboard de pe telefon (token-ul e în așteptare)
- [ ] **Onboarding wizard** — după signup, wizard setări preferințe (acum sare la /account)
- [ ] **Resend confirmation email** — buton când userul nu primește email
- [ ] **Account deletion** — buton "Șterge cont" în /account
- [ ] **Logout din toate device-urile** — buton dedicat
- [ ] **Dashboard quick actions** — ban user, retrimite notificare, force refresh
- [ ] **Search & export abonați** — pe `/abonati` în dashboard

### 🟡 Priority LOW

- [ ] **Reorganizare stats files** — mută 3050 `stats-*-HT.json` în `data/daily/YYYY-MM-DD/stats/` (atenție backup-uri!)
- [ ] **Logs rotation** — `pm2 install pm2-logrotate` (după activare PM2)
- [ ] **Tests** — Jest pentru pattern-checker, edge cases dedup
- [ ] **Testimoniale + case studies** — pe landing page
- [ ] **Welcome banner** pentru useri noi în primul login pe `/account`

### 🚫 Decizii Florian (NU se face automat)

- Cont Stripe — necesar input user
- Pricing planuri Pro — decizie business
- Activare PM2 + PIN dashboard — preferă să decidă când

---

## 🔐 Acces & credentiale

### Supabase
- **Proiect**: `btgurcfnzlkxrynhvngm` (EU West Ireland, Free tier)
- **Cont owner**: Florian (Google login)
- **Tabele**: `auth.users` (managed), `subscriptions`, `preferences`
- **Trigger**: `create_user_defaults` la INSERT pe auth.users
- **RLS**: activ pe ambele tabele
- **Chei**: salvate în `/home/florian/smart-predictions/.env.local` + Vercel env vars

⚠️ **Cheile au fost vizibile în chat**. Recomandare: rotește service_role în Supabase → Settings → API → Reset secret key. Update apoi în `.env.local` + Vercel.

### Vercel
- Proiect `smart-predictions` (cramafrust)
- Domeniu: `smart.frust.ro`
- ENV: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Auto-deploy din `main` branch GitHub

### GitHub
- `cramafrust/API-SMART-5` — backend
- `cramafrust/smart-predictions` — frontend

### Cron-uri existente (nemodificate)
```
@reboot           sleep 30 + start API-SMART-5 all
0 7 * * *         collectyesterday
0 9 * * *         collectyesterday retry
0 11 * * *        collectyesterday retry
0 8 * * *         restart API-SMART-5 (înlocuibil cu PM2)
0 16 * * *        safety net daily collector
0 8 * * *         daily-report + daily-master + collected-report
0 9 * * 2         weekly report (marți)
0 9 1 * *         monthly report (ziua 1)
0 2 * * 0         cleanup backups (>30 zile)
5 2 * * 0         cleanup logs (>90 zile)
0 2 * * *         auto git push
0 10 1 * *        FLASHSCORE_SCHEMA_CHECK (NOU)
@reboot           dashboard + start-tunnel
```

---

**Generat**: 19 mai 2026
**Sesiune Claude Opus 4.7 (1M context)**
