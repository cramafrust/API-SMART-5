#!/bin/bash
cd "/home/florian/API SMART 5"
nohup node API-SMART-5.js full >> "/home/florian/API SMART 5/logs/api-smart-5.log" 2>&1 &
echo "PID: $!"
