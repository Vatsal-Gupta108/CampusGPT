@echo off
echo Starting CampusGPT...

:: Start Backend in a new terminal window
echo Starting Backend (FastAPI)...
start "Backend Server" cmd /k "cd backend && venv\Scripts\python.exe -m uvicorn app.main:app --reload --host ::"

:: Start Frontend in a new terminal window
echo Starting Frontend (Next.js)...
start "Frontend Server" cmd /k "cd frontend && npm run dev"

echo Both services have been launched in separate terminal windows.
echo - Backend: http://localhost:8000
echo - Frontend: http://localhost:3000
