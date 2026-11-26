@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo ================================================
echo   SANTIYE PATRONU - WINDOWS BUILD
echo ================================================
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 veya ustu bulunamadi. https://nodejs.org/ adresinden kurun.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm bulunamadi. Node.js kurulumunu kontrol edin.
  pause
  exit /b 1
)
echo [1/3] Bagimliliklar kuruluyor...
call npm install
if errorlevel 1 goto :fail
echo [2/3] Windows kurulum paketi uretiliyor...
call npm run dist:win
if errorlevel 1 goto :fail
echo [3/3] Tamamlandi.
echo Kurulum dosyasi dist klasorunde.
explorer "%~dp0dist"
pause
exit /b 0
:fail
echo Derleme basarisiz oldu. Yukaridaki hata mesajini kontrol edin.
pause
exit /b 1
