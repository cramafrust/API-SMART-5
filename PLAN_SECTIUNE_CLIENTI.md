# PLAN — Secțiune Abonamente Clienți

## Obiectiv
Utilizatori externi se abonează și primesc notificările API SMART 5 pe email/Telegram.

---

## ARHITECTURĂ

```
SITE PUBLIC (smart.frust.ro — Vercel)
├── Landing page (prezentare + statistici publice)
├── Register / Login
├── Cont client (istoric, preferințe)
├── Pagina prețuri
└── API routes (Next.js)
        │
        ▼
BAZĂ DE DATE (Supabase — gratuit)
├── users
├── subscriptions
├── preferences
└── notifications_sent
        │
        ▼
API SMART 5 (WSL/VPS)
├── La fiecare notificare detectată:
│   1. Trimite la Florian (ca acum)
│   2. Apel webhook → Vercel → trimite la abonați
└── Sau: trimite direct la abonați din proces
```

---

## COMPONENTE

### 1. Bază de Date (Supabase)

**Tabel `users`:**
```sql
id UUID PRIMARY KEY
email TEXT UNIQUE NOT NULL
name TEXT
password_hash TEXT NOT NULL
created_at TIMESTAMP
last_login TIMESTAMP
active BOOLEAN DEFAULT true
```

**Tabel `subscriptions`:**
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users
plan TEXT ('free', 'basic', 'premium')
start_date DATE
end_date DATE
active BOOLEAN
stripe_subscription_id TEXT (opțional, pentru plăți)
```

**Tabel `preferences`:**
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users
leagues TEXT[] (ex: ['ENGLAND: Premier League', 'SPAIN: LaLiga'])
min_probability INTEGER DEFAULT 75
channels TEXT[] ('email', 'telegram')
telegram_chat_id TEXT
notify_prematch BOOLEAN DEFAULT true
notify_ht BOOLEAN DEFAULT true
notify_results BOOLEAN DEFAULT true
```

**Tabel `notifications_sent`:**
```sql
id UUID PRIMARY KEY
user_id UUID REFERENCES users
notification_type TEXT ('ht', 'prematch', 'result')
match_info JSONB
pattern TEXT
probability FLOAT
channel TEXT ('email', 'telegram')
sent_at TIMESTAMP
delivered BOOLEAN
```

### 2. Site Public (Next.js pe Vercel)

**Pagini:**

| Pagina | Descriere | Auth |
|--------|-----------|------|
| `/` | Landing page — statistici publice, cum funcționează | Nu |
| `/preturi` | Planuri (Free/Basic/Premium) | Nu |
| `/register` | Formular înregistrare | Nu |
| `/login` | Autentificare | Nu |
| `/dashboard` | Cont client — ultimele notificări primite | Da |
| `/dashboard/preferinte` | Setări: ligi, prag probabilitate, canale | Da |
| `/dashboard/istoric` | Istoric complet notificări + win rate personal | Da |

**Landing page conținut:**
- Win rate global: 69% (431 notificări)
- Exemplu notificare recentă (anonimizat)
- Ligi acoperite (51)
- Pattern-uri (95+)
- "Primește predicții bazate pe statistică, nu pe feeling"

### 3. Planuri

| Plan | Preț | Include |
|------|------|---------|
| **Free** | 0€ | 1 notificare/zi, doar email, fără filtre |
| **Basic** | 9.99€/lună | Toate notificările, email, filtre ligi |
| **Premium** | 19.99€/lună | Tot + Telegram instant + filtre avansate + raport zilnic |

### 4. Integrare cu API SMART 5

**Opțiunea A — Webhook (recomandat):**
```
API SMART 5 detectează pattern
  → POST https://smart.frust.ro/api/webhook/notification
  → Vercel primește, filtrează per user, trimite email/Telegram
```

**Opțiunea B — Direct din proces:**
```
API SMART 5 detectează pattern
  → Citește lista abonați din Supabase
  → Trimite direct (mai simplu, dar cuplat)
```

### 5. Telegram Bot

- Creezi bot pe @BotFather → primești token
- User-ul adaugă bot-ul, trimite /start
- Bot-ul salvează chat_id în preferences
- La fiecare notificare → `sendMessage(chat_id, text)`
- Gratuit, instant, fără spam folder

---

## PAȘI IMPLEMENTARE

| # | Pas | Efort | Prioritate |
|---|-----|-------|-----------|
| 1 | Creare proiect Next.js + deploy pe Vercel (`smart.frust.ro`) | 1h | 🔴 |
| 2 | Setup Supabase (baza de date + auth) | 1h | 🔴 |
| 3 | Landing page (prezentare + statistici publice) | 2h | 🔴 |
| 4 | Register / Login (Supabase Auth) | 2h | 🔴 |
| 5 | Dashboard client (ultimele notificări) | 3h | 🔴 |
| 6 | Preferințe client (ligi, prag, canale) | 2h | 🟡 |
| 7 | Webhook API SMART 5 → Vercel → trimite la abonați | 3h | 🔴 |
| 8 | Telegram Bot setup | 2h | 🟡 |
| 9 | Pagina prețuri + Stripe integration | 4h | 🟡 |
| 10 | Rapoarte personalizate (zilnic/săptămânal per user) | 3h | 🟢 |
| 11 | Admin panel (Florian — gestionare useri, statistici) | 3h | 🟢 |

**Total estimat:** ~26 ore

---

## ÎNTREBĂRI DE DECIS

1. **Gratuit sau doar plătit?** Free tier limitat + planuri plătite?
2. **Telegram sau doar email?** Telegram e mai rapid
3. **Stripe sau alt procesator plăți?** (pentru România)
4. **`smart.frust.ro` sau alt domeniu?**
5. **Supabase sau Neon + Prisma** (ca la site-ul FRUST)?

---

## NEXT STEPS

Când decizi răspunsurile → începem cu pasul 1 (proiect + deploy).
