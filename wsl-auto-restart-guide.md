# WSL Auto-Restart - Ghid Soluție

## Problema
WSL nu se repornește automat când se oprește singur.
Dacă WSL face shutdown între 05:00-08:00, job-urile cron de dimineață nu rulează.

## Soluții Posibile:

### Opțiunea 1: Task Scheduler Windows (RECOMANDAT)
Creează un task în Windows care verifică dacă WSL rulează și îl pornește dacă e oprit.

**PowerShell Script:** `C:\Scripts\wsl-keepalive.ps1`
```powershell
# Verifică dacă WSL Ubuntu rulează
$wslRunning = wsl --list --running | Select-String "Ubuntu"

if (!$wslRunning) {
    Write-Host "$(Get-Date) - WSL oprit, pornesc..."
    wsl -d Ubuntu -u florian -e bash -c "echo WSL started"
}
```

**Task Scheduler:**
- Trigger: La fiecare 30 minute, 24/7
- Action: `powershell.exe -File C:\Scripts\wsl-keepalive.ps1`
- Run whether user is logged on or not
- Start: 00:00, repeat every 30 minutes

### Opțiunea 2: WSL Auto-Start Service
```powershell
# În PowerShell (Admin), adaugă în Task Scheduler:
$action = New-ScheduledTaskAction -Execute "wsl.exe" -Argument "-d Ubuntu"
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount
Register-ScheduledTask -TaskName "WSL-Ubuntu-AutoStart" -Action $action -Trigger $trigger -Principal $principal
```

### Opțiunea 3: Monitorizare în Python (pe Windows)
```python
# wsl-monitor.py (rulează pe Windows cu pythonw.exe în startup)
import subprocess
import time

while True:
    try:
        result = subprocess.run(["wsl", "--list", "--running"], 
                               capture_output=True, text=True)
        if "Ubuntu" not in result.stdout:
            print(f"{time.strftime('%Y-%m-%d %H:%M:%S')} - Starting WSL...")
            subprocess.run(["wsl", "-d", "Ubuntu", "-e", "echo", "started"])
    except:
        pass
    time.sleep(300)  # Check every 5 minutes
```

### Opțiunea 4: Detectare cauză shutdown repetitiv
Verifică ce a cauzat shutdown-urile la 05:12-05:17:

```bash
# În WSL, verifică log-urile
journalctl --since "2026-01-30 05:00" --until "2026-01-30 05:20" | grep -E "shutdown|reboot|killed"

# Verifică procese care au cerut shutdown
grep "shutdown" /var/log/syslog
```

## Cauze Posibile Shutdown WSL:
1. **Windows Update** - forțează restart WSL
2. **Script cu `shutdown` sau `reboot`** - verifică toate scripturile
3. **Out of Memory** - WSL oprește când Windows are memorie insuficientă
4. **Task Scheduler Windows** - task care oprește WSL
5. **Anti-virus** - unele AV-uri opresc WSL

## Acțiuni IMEDIATE:
1. ✅ Creează Task Scheduler în Windows (Opțiunea 1) - **5 minute setup**
2. 🔍 Investighează cauza shutdown-urilor de la 05:12-05:17
3. 📧 Configurează alertă când WSL se oprește

