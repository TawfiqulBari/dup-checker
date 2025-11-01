@echo off
REM Windows Build Script for Dup-Checker Desktop
REM Run this script on Windows to create the Windows installer

echo ========================================
echo Dup-Checker Windows Build Script
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo Please download and install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

echo NPM version:
npm --version
echo.

REM Check if dependencies are installed
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to install dependencies!
        pause
        exit /b 1
    )
    echo.
)

echo Cleaning previous builds...
if exist "out\" rmdir /s /q "out"
if exist "release\" rmdir /s /q "release"
echo.

echo Building Electron app for Windows...
echo This may take 2-5 minutes...
echo.

call npm run build:electron:win

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo BUILD SUCCESSFUL!
    echo ========================================
    echo.
    echo Your Windows installers are ready in the 'release' folder:
    echo.
    dir /b release\*.exe 2>nul
    echo.
    echo - NSIS Installer: Dup-Checker Setup 0.1.0.exe
    echo - Portable: Dup-Checker 0.1.0.exe (no installation needed)
    echo.
    echo You can now distribute these files!
    echo.
) else (
    echo.
    echo ========================================
    echo BUILD FAILED!
    echo ========================================
    echo.
    echo Please check the error messages above.
    echo.
)

pause
