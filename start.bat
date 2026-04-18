@echo off
echo Starting Steam Account Manager...

cd backend
start cmd /k "node server.js"

cd ../frontend
start cmd /k "npm run dev"

echo Both servers are starting. The frontend should open in your browser shortly (usually http://localhost:5173).
pause
