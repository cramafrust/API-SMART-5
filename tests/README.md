# 🧪 API SMART 5 - Test Files

Fișiere de test pentru diferite componente ale sistemului.

## Test Files

### Integrare Superbet
- `test-superbet-integration.js` - Test integrare completă cu Superbet API
- `test-superbet-live-odds.js` - Test extragere cote LIVE de la Superbet
- `test-odd-notifications.js` - Test notificări când cotele ating praguri

### Pattern Detection
- `test-realistic-patterns.js` - Test pattern-uri realiste (GOLURI, CORNERE, CARTONAȘE)
- `test-both-teams.js` - Test pattern-uri pentru ambele echipe
- `test-pattern-6.js` - Test pattern specific #6 (CORNERE)

### Tracking System
- `test-tracking-system.js` - Test sistem de tracking notificări

## Rulare

```bash
# Individual
node tests/test-superbet-integration.js

# Toate testele
for test in tests/test-*.js; do
    echo "Running $test..."
    node "$test"
done
```

## Note

Toate testele folosesc date LIVE de la Superbet/FlashScore.
Unele pot eșua dacă nu există meciuri active.
