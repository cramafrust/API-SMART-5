#!/bin/bash
# Auto-push zilnic pe GitHub — rulat de cron
# Salvează datele noi colectate (season files, procente, tracking)

cd "/home/florian/API SMART 5" || exit 1

# Verifică dacă sunt modificări
if [ -z "$(git status --porcelain)" ]; then
    echo "$(date '+%Y-%m-%d %H:%M') — Nicio modificare de comis"
    exit 0
fi

# Stage doar fișierele importante (nu totul)
git add data/seasons/*.json
git add data/procente/*.json
git add data/*.json
git add notifications_tracking.json
git add *.js
git add *.md
git add .gitignore

# Commit cu data
DATE=$(date '+%Y-%m-%d')
MATCHES=$(find data/seasons -name "*.json" -newer .git/refs/heads/main 2>/dev/null | wc -l)
git commit -m "Daily update ${DATE} — ${MATCHES} fișiere actualizate

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>" 2>/dev/null

# Push
git push origin main 2>&1

echo "$(date '+%Y-%m-%d %H:%M') — Push realizat"
