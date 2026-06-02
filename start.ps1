Write-Host "Starting CampusGPT..." -ForegroundColor Cyan

# Start Backend in a new PowerShell window
Write-Host "Starting Backend (FastAPI)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; .\venv\Scripts\python.exe -m uvicorn app.main:app --reload --host ::" -WindowStyle Normal

# Start Frontend in a new PowerShell window
Write-Host "Starting Frontend (Next.js)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -WindowStyle Normal

Write-Host "Both services have been launched in separate windows." -ForegroundColor Cyan
Write-Host "- Backend: http://localhost:8000" -ForegroundColor Yellow
Write-Host "- Frontend: http://localhost:3000" -ForegroundColor Yellow
