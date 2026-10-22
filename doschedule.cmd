@echo off
setlocal
rem Started by double-click, the window closes when the program ends: on an error, wait so the message can be read.
where node >nul 2>nul || (echo DOSchedule needs Node.js 18 or newer, free from https://nodejs.org & pause & exit /b 1)
node "%~dp0doschedule.js" %*
set code=%ERRORLEVEL%
if not "%code%"=="0" pause
exit /b %code%
