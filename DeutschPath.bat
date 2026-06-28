@echo off
setlocal enabledelayedexpansion
title DeutschPath

echo ==============================================
echo   DeutschPath  --  German Learning Platform
echo ==============================================
echo.

:: ── Guard: don't run from inside a ZIP / temp folder ─────────────────────────
set "ROOT=%~dp0"
if "!ROOT:~-1!"=="\" set "ROOT=!ROOT:~0,-1!"

echo "!ROOT!" | findstr /i "\\AppData\\Local\\Temp\\" >nul 2>&1 && goto :zip_error
echo "!ROOT!" | findstr /i "\\Temp\\" >nul 2>&1          && goto :zip_error
if not exist "!ROOT!\launcher.py" goto :zip_error

:: ── [1/3]  Find Python 3.10+ ─────────────────────────────────────────────────
echo [1/3] Looking for Python 3.10+ ...
set "PYTHON="

for %%V in (313 312 311 310) do (
    if "!PYTHON!"=="" if defined LOCALAPPDATA (
        if exist "!LOCALAPPDATA!\Programs\Python\Python%%V\python.exe" (
            set "PYTHON=!LOCALAPPDATA!\Programs\Python\Python%%V\python.exe"
        )
    )
    if "!PYTHON!"=="" if exist "C:\Python%%V\python.exe" (
        set "PYTHON=C:\Python%%V\python.exe"
    )
    if "!PYTHON!"=="" if defined PROGRAMFILES (
        if exist "!PROGRAMFILES!\Python%%V\python.exe" (
            set "PYTHON=!PROGRAMFILES!\Python%%V\python.exe"
        )
    )
)

if "!PYTHON!"=="" (
    for /f "tokens=*" %%p in ('where python 2^>nul') do (
        if "!PYTHON!"=="" (
            echo "%%p" | findstr /i "WindowsApps" >nul 2>&1
            if errorlevel 1 (
                echo "%%p" | findstr /i "Deutschpath" >nul 2>&1
                if errorlevel 1 (
                    echo "%%p" | findstr /i "\\venv\\" >nul 2>&1
                    if errorlevel 1 set "PYTHON=%%p"
                )
            )
        )
    )
)

if "!PYTHON!"=="" goto :install_python
goto :verify_python

:: ── Install Python ────────────────────────────────────────────────────────────
:install_python
echo    Not found. Attempting automatic install...
echo    This takes 1-2 minutes and needs an internet connection.
echo.
winget --version >nul 2>&1
if not errorlevel 1 goto :python_via_winget

:python_direct
echo    winget not available. Downloading Python 3.11 installer directly...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Write-Host '   Downloading Python 3.11.9...'; Invoke-WebRequest 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe' -OutFile '%TEMP%\python_dp.exe' -UseBasicParsing; Write-Host '   Done.'"
if errorlevel 1 goto :python_manual
echo    Installing Python 3.11 silently...
"%TEMP%\python_dp.exe" /quiet InstallAllUsers=0 PrependPath=1 /norestart
del "%TEMP%\python_dp.exe" 2>nul
goto :python_post_install

:python_via_winget
winget install --id Python.Python.3.11 --source winget --accept-source-agreements --accept-package-agreements
goto :python_post_install

:python_manual
echo    Download failed. Opening python.org in your browser...
start "" "https://www.python.org/downloads/"
echo    Install Python 3.11 manually. IMPORTANT: tick "Add Python to PATH" on the first screen.
echo    Then run DeutschPath.bat again.
pause
exit /b 1

:python_post_install
if defined LOCALAPPDATA (
    if exist "!LOCALAPPDATA!\Programs\Python\Python311\python.exe" (
        set "PYTHON=!LOCALAPPDATA!\Programs\Python\Python311\python.exe"
    )
)
if "!PYTHON!"=="" (
    echo.
    echo    Python installed. Please close this window and run DeutschPath.bat again.
    echo    Windows needs a fresh terminal to see the new PATH.
    pause
    exit /b 0
)

:: ── Verify Python version ─────────────────────────────────────────────────────
:verify_python
"!PYTHON!" -c "import sys; sys.exit(0 if sys.version_info>=(3,10) else 1)" >nul 2>&1
if errorlevel 1 (
    echo    ERROR: Python at !PYTHON! is older than 3.10.
    echo    Please install Python 3.13 from https://www.python.org/downloads/
    pause
    exit /b 1
)
"!PYTHON!" -c "import sys; sys.exit(0 if sys.version_info.releaselevel=='final' else 1)" >nul 2>&1
if errorlevel 1 (
    for /f "tokens=*" %%v in ('"!PYTHON!" --version 2^>^&1') do echo    SKIP %%v -- pre-release, not supported
    echo.
    echo    Python pre-release versions are not supported.
    echo    Installing stable Python 3.13 via Windows Package Manager...
    winget install --id Python.Python.3.13 --source winget --accept-source-agreements --accept-package-agreements
    echo.
    echo    Please close this window and run DeutschPath.bat again.
    pause
    exit /b 0
)
for /f "tokens=*" %%v in ('"!PYTHON!" --version 2^>^&1') do echo    OK  %%v  ^(!PYTHON!^)

:: ── [2/3]  Find Node.js ───────────────────────────────────────────────────────
echo [2/3] Looking for Node.js ...
node --version >nul 2>&1
if errorlevel 1 goto :install_node
for /f "tokens=*" %%v in ('node --version 2^>nul') do echo    OK  Node.js %%v
goto :launch

:: ── Install Node.js ───────────────────────────────────────────────────────────
:install_node
echo    Not found. Attempting automatic install...
winget --version >nul 2>&1
if not errorlevel 1 goto :node_via_winget

:node_direct
echo    winget not available. Downloading Node.js 20 LTS installer directly...
set "PS=%TEMP%\dp_node.ps1"
echo $v = ((Invoke-RestMethod 'https://nodejs.org/dist/index.json') ^| Where-Object { $_.lts -and $_.version.StartsWith('v20.') } ^| Select-Object -First 1).version > "!PS!"
echo $u = "https://nodejs.org/dist/$v/node-$v-x64.msi" >> "!PS!"
echo Write-Host "   Downloading Node.js $v..." >> "!PS!"
echo Invoke-WebRequest -Uri $u -OutFile "$env:TEMP\node_dp.msi" -UseBasicParsing >> "!PS!"
echo Write-Host "   Done." >> "!PS!"
powershell -NoProfile -ExecutionPolicy Bypass -File "!PS!"
del "!PS!" 2>nul
if errorlevel 1 goto :node_manual
echo    Installing Node.js (a UAC prompt may appear)...
msiexec /i "%TEMP%\node_dp.msi" /passive /norestart
set MSIRC=!errorlevel!
del "%TEMP%\node_dp.msi" 2>nul
:: 0=success  3010=success+restart-recommended  1641=restart-initiated — all OK
if !MSIRC! equ 0    goto :node_msi_ok
if !MSIRC! equ 3010 goto :node_msi_ok
if !MSIRC! equ 1641 goto :node_msi_ok
:: Also accept if node.exe appeared despite unexpected exit code
if exist "C:\Program Files\nodejs\node.exe" goto :node_msi_ok
if exist "C:\Program Files (x86)\nodejs\node.exe" goto :node_msi_ok
echo    Installation failed or was cancelled (code !MSIRC!).
goto :node_manual
:node_msi_ok
:: Add Node.js to PATH for this session without waiting for a relaunch
if exist "C:\Program Files\nodejs\node.exe"        set "PATH=C:\Program Files\nodejs;!PATH!"
if exist "C:\Program Files (x86)\nodejs\node.exe"  set "PATH=C:\Program Files (x86)\nodejs;!PATH!"
:: If node is usable now, skip the relaunch and go straight to launch
node --version >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=*" %%v in ('node --version 2^>nul') do echo    OK  Node.js %%v
    goto :launch
)
goto :node_done

:node_via_winget
winget install --id OpenJS.NodeJS.20 --source winget --accept-source-agreements --accept-package-agreements
goto :node_done

:node_manual
echo    Opening nodejs.org in your browser...
start "" "https://nodejs.org/en/download/"
echo.
echo    Download Node.js 20 LTS (.msi for Windows) and install it.
echo    Press any key here when the installation is complete...
pause >nul
:: Refresh PATH with common Node.js install locations
if exist "C:\Program Files\nodejs\node.exe"        set "PATH=C:\Program Files\nodejs;!PATH!"
if exist "C:\Program Files (x86)\nodejs\node.exe"  set "PATH=C:\Program Files (x86)\nodejs;!PATH!"
node --version >nul 2>&1
if not errorlevel 1 (
    for /f "tokens=*" %%v in ('node --version 2^>nul') do echo    OK  Node.js %%v
    goto :launch
)
echo.
echo    Node.js not found yet. Run DeutschPath.bat again after restarting.
pause
exit /b 1

:node_done
echo.
echo    Node.js installed. Please close this window and run DeutschPath.bat again.
echo    Windows needs a fresh terminal to see the new PATH.
pause
exit /b 0

:: ── [3/3]  Launch ─────────────────────────────────────────────────────────────
:launch
echo [3/3] Starting DeutschPath...
echo.
echo    Browser will open automatically.
echo    This window closes once startup is complete.
echo    If something goes wrong, check launcher.log in this folder.
echo.

cd /d "!ROOT!"
"!PYTHON!" launcher.py 2>&1
set EXITCODE=!errorlevel!

if !EXITCODE! neq 0 (
    echo.
    echo    launcher.py exited with error code !EXITCODE!
    echo.
    if exist "!ROOT!\launcher.log" (
        echo    ---- launcher.log (last 40 lines) ----
        powershell -NoProfile -Command "Get-Content '!ROOT!\launcher.log' -Tail 40" 2>nul
        echo    ---- end of log ----
    ) else (
        echo    (launcher.log not found - the launcher may have crashed before writing it)
    )
    echo.
    pause
)
exit /b !EXITCODE!

:: ── Error screens ─────────────────────────────────────────────────────────────
:zip_error
echo.
echo  ERROR: DeutschPath is running from a temporary or ZIP folder.
echo.
echo  Steps to fix:
echo    1. Find the downloaded ZIP file
echo    2. Right-click it  ^>  Extract All
echo    3. Open the extracted folder
echo    4. Double-click DeutschPath.bat
echo.
pause
exit /b 1
