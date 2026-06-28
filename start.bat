@echo off
setlocal enabledelayedexpansion
title DeutschPath Launcher

cd /d "%~dp0"
set "ROOT=%~dp0"
if "!ROOT:~-1!"=="\" set "ROOT=!ROOT:~0,-1!"
set "BACKEND=!ROOT!\backend"
set "FRONTEND=!ROOT!\frontend"
set "LOG=!ROOT!\setup.log"

echo.
echo  ============================================
echo    DeutschPath - German Learning Platform
echo  ============================================
echo.

:: ── Detect first-run / needs setup ──────────────────────────────────────────
set "NEEDS_SETUP=0"
if not exist "!BACKEND!\venv\Scripts\python.exe"  set "NEEDS_SETUP=1"
if not exist "!FRONTEND!\node_modules"             set "NEEDS_SETUP=1"
set "HAS_KEY=0"
if exist "!BACKEND!\.env" (
  for /f "tokens=2 delims==" %%K in ('findstr /b "GEMINI_API_KEY=" "!BACKEND!\.env" 2^>nul') do (
    set "_k=%%K"
    set "_k=!_k: =!"
    if not "!_k!"=="" (
      if not "!_k!"=="your-gemini-api-key-here" set "HAS_KEY=1"
    )
  )
)
if "!HAS_KEY!"=="0" set "NEEDS_SETUP=1"

:: ── 1. Python ────────────────────────────────────────────────────────────────
echo  [1/5] Checking Python...
set "PYTHON_CMD="
for %%P in (python python3 py) do (
  if "!PYTHON_CMD!"=="" (
    where %%P >nul 2>&1
    if !errorlevel!==0 (
      %%P -c "import sys; exit(0 if sys.version_info>=(3,10) else 1)" >nul 2>&1
      if !errorlevel!==0 set "PYTHON_CMD=%%P"
    )
  )
)

if "!PYTHON_CMD!"=="" (
  echo.
  echo  Python 3.10+ not found. Trying auto-install via winget...
  winget --version >nul 2>&1
  if !errorlevel!==0 (
    winget install --id Python.Python.3.11 --source winget --accept-source-agreements --accept-package-agreements
    echo.
    echo  Python installed. Please close this window and run start.bat again.
    echo  Windows needs a fresh session to pick up the new PATH.
    echo.
    pause
    exit /b 0
  ) else (
    echo.
    echo  -------------------------------------------------------
    echo   ACTION REQUIRED: Install Python manually
    echo.
    echo   1. Go to https://python.org/downloads
    echo   2. Download Python 3.11 or newer
    echo   3. Run the installer
    echo   4. CHECK "Add Python to PATH" on the first screen
    echo   5. Run start.bat again when done
    echo  -------------------------------------------------------
    echo.
    start https://python.org/downloads
    pause
    exit /b 1
  )
)
for /f "tokens=2" %%V in ('!PYTHON_CMD! --version 2^>^&1') do echo       Found Python %%V

:: ── 2. Node.js ───────────────────────────────────────────────────────────────
echo  [2/5] Checking Node.js...
where node >nul 2>&1
if !errorlevel! neq 0 (
  echo.
  echo  Node.js not found. Trying auto-install via winget...
  winget --version >nul 2>&1
  if !errorlevel!==0 (
    winget install --id OpenJS.NodeJS.LTS --source winget --accept-source-agreements --accept-package-agreements
    echo.
    echo  Node.js installed. Please close this window and run start.bat again.
    echo.
    pause
    exit /b 0
  ) else (
    echo.
    echo  -------------------------------------------------------
    echo   ACTION REQUIRED: Install Node.js manually
    echo.
    echo   1. Go to https://nodejs.org
    echo   2. Download the LTS version
    echo   3. Run the installer (keep all defaults)
    echo   4. Run start.bat again when done
    echo  -------------------------------------------------------
    echo.
    start https://nodejs.org
    pause
    exit /b 1
  )
)
for /f "tokens=1" %%V in ('node --version 2^>^&1') do echo       Found Node.js %%V

:: ── 3. Python virtual environment ────────────────────────────────────────────
echo  [3/5] Setting up Python environment...
if not exist "!BACKEND!\venv\Scripts\python.exe" (
  echo       Creating virtual environment (first run)...
  !PYTHON_CMD! -m venv "!BACKEND!\venv"
  if errorlevel 1 (
    echo  ERROR: Could not create virtual environment.
    pause
    exit /b 1
  )
)
echo       Installing Python packages...
"!BACKEND!\venv\Scripts\pip" install -q --upgrade pip >>"!LOG!" 2>&1
"!BACKEND!\venv\Scripts\pip" install -q -r "!BACKEND!\requirements.txt" >>"!LOG!" 2>&1
if errorlevel 1 (
  echo  ERROR: pip install failed. Check setup.log for details.
  pause
  exit /b 1
)
echo       Python packages ready

:: ── 4. Node.js packages ──────────────────────────────────────────────────────
echo  [4/5] Setting up Node.js packages...
if not exist "!FRONTEND!\node_modules" (
  echo       Installing npm packages (first run - about 1 minute)...
  cd /d "!FRONTEND!"
  call npm install >>"!LOG!" 2>&1
  if errorlevel 1 (
    echo  ERROR: npm install failed. Check setup.log for details.
    cd /d "!ROOT!"
    pause
    exit /b 1
  )
  cd /d "!ROOT!"
  echo       npm packages installed
) else (
  echo       npm packages already installed
)

:: ── Environment file ──────────────────────────────────────────────────────────
if not exist "!BACKEND!\.env" (
  echo GEMINI_API_KEY=> "!BACKEND!\.env"
  echo FRONTEND_URL=http://localhost:3000>> "!BACKEND!\.env"
)

:: ── 5. Free ports ────────────────────────────────────────────────────────────
echo  [5/5] Freeing ports 8000 and 3000...
for /f "tokens=5" %%A in ('netstat -ano 2^>nul ^| findstr ":8000 " ^| findstr "LISTENING"') do (
  taskkill /F /PID %%A >nul 2>&1
)
for /f "tokens=5" %%A in ('netstat -ano 2^>nul ^| findstr ":3000 " ^| findstr "LISTENING"') do (
  taskkill /F /PID %%A >nul 2>&1
)
timeout /t 1 /nobreak >nul
echo       Ports cleared

:: ── Write launcher scripts to TEMP ───────────────────────────────────────────
set "BACK_LAUNCH=%TEMP%\dp_backend.bat"
set "FRONT_LAUNCH=%TEMP%\dp_frontend.bat"

(
echo @echo off
echo title DeutschPath Backend
echo cd /d "!BACKEND!"
echo call venv\Scripts\activate.bat
echo echo.
echo echo  DeutschPath Backend  -  http://localhost:8000
echo echo  Press Ctrl+C to stop.
echo echo.
echo uvicorn main:app --reload --port 8000
echo pause
) > "!BACK_LAUNCH!"

(
echo @echo off
echo title DeutschPath Frontend
echo cd /d "!FRONTEND!"
echo echo.
echo echo  DeutschPath Frontend  -  http://localhost:3000
echo echo  Press Ctrl+C to stop.
echo echo.
echo npm run dev
echo pause
) > "!FRONT_LAUNCH!"

:: ── Start servers ─────────────────────────────────────────────────────────────
echo.
echo  Starting backend...
start "DeutschPath Backend" cmd /k "!BACK_LAUNCH!"
timeout /t 2 /nobreak >nul

echo  Starting frontend...
start "DeutschPath Frontend" cmd /k "!FRONT_LAUNCH!"

:: ── Open browser ──────────────────────────────────────────────────────────────
echo.
if "!NEEDS_SETUP!"=="1" (
  echo  Opening setup wizard...
  timeout /t 2 /nobreak >nul
  start "" "!ROOT!\setup.html"
) else (
  echo  Waiting for app to start...
  set /a "tries=0"
  :waitloop
  timeout /t 2 /nobreak >nul
  set /a "tries+=1"
  curl -s -o nul -m 1 http://localhost:3000 2>nul
  if not errorlevel 1 goto :ready
  if !tries! lss 30 goto :waitloop
  :ready
  start http://localhost:3000
)

echo.
echo  ============================================
echo   DeutschPath is running!
echo.
echo   Frontend : http://localhost:3000
echo   Backend  : http://localhost:8000
echo.
echo   Close the two server windows to stop.
echo  ============================================
echo.
pause
endlocal
