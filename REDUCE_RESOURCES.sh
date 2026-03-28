#!/bin/bash
# Reduce memory și CPU pentru procesele care rulează

# 1. Limitează prioritate procese Node (nice = mai puțin CPU)
for pid in $(pgrep -f "node.*API-SMART"); do
    renice +10 $pid 2>/dev/null && echo "✅ Redus prioritate PID $pid"
done

# 2. Limitează prioritate Chrome/Puppeteer
for pid in $(pgrep -f "chrome|chromium"); do
    renice +15 $pid 2>/dev/null && echo "✅ Redus prioritate Chrome PID $pid"
done

echo ""
echo "✅ Resurse optimizate - procesele vor consuma mai puțin CPU!"
