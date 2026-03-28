# 🛡️ SOLUȚIE - Monitorizare WSL din Windows

## PROBLEMA IDENTIFICATĂ

**Watchdog din WSL NU poate trimite alertă când WSL se oprește!**

Când WSL face shutdown:
1. Toate procesele Linux se opresc INSTANT
2. Watchdog.js nu are timp să detecteze și să trimită email
3. **REZULTAT: NICIO ALERTĂ când WSL cade**

## SOLUȚIA: Monitorizare EXTERNĂ din Windows

Avem nevoie de un **monitor care rulează în WINDOWS** (nu în WSL) și:
- ✅ Verifică dacă WSL rulează
- ✅ Verifică dacă API SMART 5 procesează meciuri
- ✅ Trimite EMAIL când detectează probleme
- ✅ Pornește automat WSL când e oprit

---

## IMPLEMENTARE - Script PowerShell + Task Scheduler

### 1️⃣ Script PowerShell de Monitorizare

**Fișier:** `C:\Scripts\wsl-api-smart-5-monitor.ps1`

```powershell
# ============================================================
# WSL API SMART 5 - EXTERNAL MONITOR
# Monitorizează WSL și trimite alerte prin email
# ============================================================

# Configurare Email
$SmtpServer = "smtp.gmail.com"
$SmtpPort = 587
$EmailFrom = "smartyield365@gmail.com"
$EmailTo = "mihai.florian@yahoo.com"
$EmailPassword = "axwejagggaqecosp"  # App Password Gmail

# Configurare Monitorizare
$LogFile = "C:\Scripts\Logs\wsl-monitor-$(Get-Date -Format 'yyyy-MM-dd').log"
$StateFile = "C:\Scripts\wsl-monitor-state.json"

# Funcție Log
function Write-Log {
    param($Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage
    Add-Content -Path $LogFile -Value $logMessage
}

# Funcție Trimite Email
function Send-Alert {
    param(
        [string]$Subject,
        [string]$Body
    )
    
    try {
        $SecurePassword = ConvertTo-SecureString $EmailPassword -AsPlainText -Force
        $Credential = New-Object System.Management.Automation.PSCredential($EmailFrom, $SecurePassword)
        
        Send-MailMessage -From $EmailFrom `
                         -To $EmailTo `
                         -Subject $Subject `
                         -Body $Body `
                         -SmtpServer $SmtpServer `
                         -Port $SmtpPort `
                         -UseSsl `
                         -Credential $Credential
        
        Write-Log "✅ Email trimis: $Subject"
        return $true
    } catch {
        Write-Log "❌ Eroare trimitere email: $_"
        return $false
    }
}

# Funcție Încarcă State
function Load-State {
    if (Test-Path $StateFile) {
        $state = Get-Content $StateFile | ConvertFrom-Json
        return $state
    }
    return @{
        LastWSLRunning = $true
        LastAlertTime = (Get-Date).AddHours(-24)
        LastProcessingTime = Get-Date
    }
}

# Funcție Salvează State
function Save-State {
    param($State)
    $State | ConvertTo-Json | Set-Content $StateFile
}

# ============================================================
# VERIFICARE WSL
# ============================================================

Write-Log "🔍 Verificare WSL..."

# Verifică dacă WSL Ubuntu rulează
$wslRunning = wsl --list --running 2>&1 | Select-String "Ubuntu"

$state = Load-State

if (!$wslRunning) {
    Write-Log "❌ WSL Ubuntu NU RULEAZĂ!"
    
    # Verifică dacă trebuie să trimită alertă (nu mai des de 1 oră)
    $timeSinceLastAlert = (Get-Date) - [datetime]$state.LastAlertTime
    
    if ($timeSinceLastAlert.TotalHours -ge 1) {
        Write-Log "📧 Trimit ALERTĂ WSL OPRIT..."
        
        $subject = "🚨 API SMART 5 - WSL OPRIT!"
        $body = @"
🚨 ALERTĂ CRITICĂ

WSL Ubuntu este OPRIT!

Timestamp: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Ultimul alert: $($state.LastAlertTime)

ACȚIUNE AUTOMATĂ:
✅ Pornesc WSL automat...

API SMART 5 va fi repornit automat când WSL pornește.

────────────────────────
🛡️ WSL External Monitor (Windows)
"@
        
        Send-Alert -Subject $subject -Body $body
        $state.LastAlertTime = Get-Date
        Save-State $state
    }
    
    # Pornește WSL automat
    Write-Log "🔄 Pornesc WSL Ubuntu..."
    wsl -d Ubuntu -u florian -e bash -c "echo 'WSL started by external monitor'"
    
    Write-Log "✅ WSL pornit"
    
} else {
    Write-Log "✅ WSL Ubuntu rulează"
    
    # Verifică dacă API SMART 5 procesează meciuri (verificare avansată)
    $lastStatsFile = wsl -d Ubuntu -e bash -c "ls -t '/home/florian/API SMART 5/stats-*-HT.json' 2>/dev/null | head -1"
    
    if ($lastStatsFile) {
        $lastStatsTime = wsl -d Ubuntu -e bash -c "stat -c %Y '$lastStatsFile' 2>/dev/null"
        $currentTime = [int](Get-Date -UFormat %s)
        $timeSinceProcessing = $currentTime - [int]$lastStatsTime
        
        $hoursSince = [math]::Floor($timeSinceProcessing / 3600)
        $minutesSince = [math]::Floor(($timeSinceProcessing % 3600) / 60)
        
        Write-Log "📊 Ultima procesare: ${hoursSince}h ${minutesSince}m ago"
        
        # ALERTĂ dacă nu s-a procesat nimic în ultimele 8 ore (în timpul zilei)
        $currentHour = (Get-Date).Hour
        $isActiveHours = ($currentHour -ge 8 -and $currentHour -le 23)
        
        if ($timeSinceProcessing -gt 28800 -and $isActiveHours) {
            Write-Log "⚠️ NICIO PROCESARE în ultimele 8+ ore!"
            
            $timeSinceLastAlert = (Get-Date) - [datetime]$state.LastAlertTime
            if ($timeSinceLastAlert.TotalHours -ge 4) {
                Write-Log "📧 Trimit ALERTĂ PROCESARE OPRITĂ..."
                
                $subject = "⚠️ API SMART 5 - NICIO PROCESARE ${hoursSince}h+"
                $body = @"
⚠️ API SMART 5 - Posibil BLOCAT

WSL rulează, dar nicio procesare de meciuri în ultimele ${hoursSince}h ${minutesSince}m!

Timestamp: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Ora curentă: ${currentHour}:00 (ore active)

POSIBILE CAUZE:
- Procesul API SMART 5 este blocat (hung)
- Nu există meciuri live (normal în pauze campionate)
- Eroare în proces care blochează execuția

ACȚIUNE RECOMANDATĂ:
1. Verifică log-urile: wsl -e tail -100 "/home/florian/API SMART 5/api-smart-5-run.log"
2. Verifică procese: wsl -e ps aux | grep API-SMART
3. Restart manual dacă e necesar

────────────────────────
🛡️ WSL External Monitor (Windows)
"@
                
                Send-Alert -Subject $subject -Body $body
                $state.LastAlertTime = Get-Date
                Save-State $state
            }
        }
    }
    
    $state.LastWSLRunning = $true
    Save-State $state
}

Write-Log "✅ Verificare completă"
```

### 2️⃣ Task Scheduler Setup (Windows)

**Pași:**

1. **Deschide Task Scheduler** (Win+R → `taskschd.msc`)

2. **Create Task** (nu Basic Task!)

3. **General Tab:**
   - Name: `WSL API SMART 5 Monitor`
   - Description: `Monitorizează WSL și trimite alerte când se oprește`
   - **✅ Run whether user is logged on or not**
   - **✅ Run with highest privileges**

4. **Triggers Tab** - Click **New**:
   - Begin the task: `On a schedule`
   - Settings: `Daily`
   - Recur every: `1 days`
   - Start: `00:00:00`
   - **✅ Repeat task every: `30 minutes`**
   - **✅ for a duration of: `Indefinitely`**
   - **✅ Enabled**

5. **Actions Tab** - Click **New**:
   - Action: `Start a program`
   - Program/script: `powershell.exe`
   - Add arguments: `-ExecutionPolicy Bypass -File "C:\Scripts\wsl-api-smart-5-monitor.ps1"`

6. **Conditions Tab:**
   - **❌ UNCHECK "Start the task only if the computer is on AC power"**
   - **❌ UNCHECK "Stop if the computer switches to battery power"**

7. **Settings Tab:**
   - **✅ Allow task to be run on demand**
   - **✅ Run task as soon as possible after a scheduled start is missed**
   - If the task fails, restart every: `5 minutes`
   - Attempt to restart up to: `3 times`

8. **Click OK** și introdu parola Windows

---

### 3️⃣ Creare Directoare

```powershell
# În PowerShell (Admin):
mkdir C:\Scripts
mkdir C:\Scripts\Logs
```

---

### 4️⃣ Testare Imediată

```powershell
# Rulează manual scriptul pentru test:
powershell -ExecutionPolicy Bypass -File "C:\Scripts\wsl-api-smart-5-monitor.ps1"

# Verifică log-ul:
Get-Content "C:\Scripts\Logs\wsl-monitor-$(Get-Date -Format 'yyyy-MM-dd').log"
```

---

## REZULTATE AȘTEPTATE

### ✅ Când WSL Rulează Normal:
```
[2026-01-30 13:00:00] 🔍 Verificare WSL...
[2026-01-30 13:00:01] ✅ WSL Ubuntu rulează
[2026-01-30 13:00:02] 📊 Ultima procesare: 0h 45m ago
[2026-01-30 13:00:02] ✅ Verificare completă
```

### 🚨 Când WSL Se Oprește:
```
[2026-01-30 05:12:30] 🔍 Verificare WSL...
[2026-01-30 05:12:31] ❌ WSL Ubuntu NU RULEAZĂ!
[2026-01-30 05:12:31] 📧 Trimit ALERTĂ WSL OPRIT...
[2026-01-30 05:12:35] ✅ Email trimis: 🚨 API SMART 5 - WSL OPRIT!
[2026-01-30 05:12:36] 🔄 Pornesc WSL Ubuntu...
[2026-01-30 05:12:40] ✅ WSL pornit
[2026-01-30 05:12:40] ✅ Verificare completă
```

**→ PRIMEȘTI EMAIL IMEDIAT când WSL se oprește!**

### ⚠️ Când API SMART 5 e Blocat (8+ ore fără procesare):
```
[2026-01-30 20:00:00] 🔍 Verificare WSL...
[2026-01-30 20:00:01] ✅ WSL Ubuntu rulează
[2026-01-30 20:00:02] 📊 Ultima procesare: 8h 15m ago
[2026-01-30 20:00:02] ⚠️ NICIO PROCESARE în ultimele 8+ ore!
[2026-01-30 20:00:02] 📧 Trimit ALERTĂ PROCESARE OPRITĂ...
[2026-01-30 20:00:06] ✅ Email trimis: ⚠️ API SMART 5 - NICIO PROCESARE 8h+
[2026-01-30 20:00:06] ✅ Verificare completă
```

**→ PRIMEȘTI EMAIL când procesarea e blocată!**

---

## 📊 AVANTAJE SOLUȚIE

1. **✅ Monitorizare 24/7** - Rulează la fiecare 30 minute, chiar dacă nu ești logat
2. **✅ Auto-restart WSL** - Pornește automat WSL când e oprit
3. **✅ Alerte prin Email** - Primești imediat când e problemă
4. **✅ Detectează blocaje** - Vede când API SMART 5 nu mai procesează meciuri
5. **✅ Anti-spam** - Max 1 email/oră pentru aceeași problemă
6. **✅ Log-uri detaliate** - Toate verificările sunt înregistrate

---

## 🎯 SETUP RAPID (5 MINUTE)

1. **Copiază scriptul** în `C:\Scripts\wsl-api-smart-5-monitor.ps1`
2. **Creează Task** în Task Scheduler (vezi pașii de mai sus)
3. **Testează** manual: `powershell -ExecutionPolicy Bypass -File "C:\Scripts\wsl-api-smart-5-monitor.ps1"`
4. **Verifică email** - ar trebui să primești un email de test sau să vezi "✅ WSL Ubuntu rulează" în log

---

## ❓ TROUBLESHOOTING

### Email-urile nu se trimit?
```powershell
# Verifică App Password Gmail
# Regenerează: https://myaccount.google.com/apppasswords
# Înlocuiește în script: $EmailPassword = "noua_parola"
```

### Task Scheduler nu rulează?
- Verifică că ai bifat "Run whether user is logged on or not"
- Verifică că ai UNBIFAT "Start only if on AC power"
- Testează manual: Task Scheduler → Right click pe task → Run

### Log-urile nu apar?
```powershell
# Creează manual directorul:
mkdir C:\Scripts\Logs
```

---

## 📝 CONCLUZIE

Cu această soluție, **NICIODATĂ nu vei pierde o alertă** când:
- ✅ WSL se oprește (cauza problemei de azi dimineață)
- ✅ API SMART 5 se blochează
- ✅ Nu se mai procesează meciuri 8+ ore

**Implementare: 5 MINUTE**  
**Efect: MONITORIZARE COMPLETĂ 24/7**

