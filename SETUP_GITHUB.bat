@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo =====================================================
echo  SANTIYE PATRONU - ILK GITHUB BAGLANTISI
echo =====================================================
echo.
where git >nul 2>nul
if errorlevel 1 (
 echo Git bulunamadi. https://git-scm.com/download/win adresinden kur.
 goto :fail
)
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js bulunamadi. Node.js 24 LTS kur: https://nodejs.org/
 goto :fail
)
set /p GHUSER=GitHub kullanici adini yaz: 
if "%GHUSER%"=="" goto :fail
if not exist ".git" git init
if errorlevel 1 goto :fail
git branch -M main

for /f "delims=" %%A in ('git config user.name') do set "GITNAME=%%A"
if "%GITNAME%"=="" (
 set /p GITNAME=Git commitlerinde gorunecek adin: 
 if "%GITNAME%"=="" goto :fail
 git config user.name "%GITNAME%"
)
for /f "delims=" %%A in ('git config user.email') do set "GITEMAIL=%%A"
if "%GITEMAIL%"=="" (
 set /p GITEMAIL=Git commitlerinde kullanilacak e-posta: 
 if "%GITEMAIL%"=="" goto :fail
 git config user.email "%GITEMAIL%"
)

set "GHUSER=%GHUSER%"
node -e "const fs=require('fs');const p=require('./package.json');const u=process.env.GHUSER.trim();if(!/^[A-Za-z0-9-]+$/.test(u))throw Error('GitHub kullanici adi gecersiz');p.repository={type:'git',url:'https://github.com/'+u+'/santiye-patronu.git'};p.build.publish=[{provider:'github',owner:u,repo:'santiye-patronu',releaseType:'release'}];fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');console.log('GitHub sahibi package.json icine yazildi: '+u)"
if errorlevel 1 goto :fail

git remote get-url origin >nul 2>nul
if errorlevel 1 (
 git remote add origin "https://github.com/%GHUSER%/santiye-patronu.git"
) else (
 git remote set-url origin "https://github.com/%GHUSER%/santiye-patronu.git"
)
if errorlevel 1 goto :fail

git add -A
git commit -m "Initial Santiye Patronu Windows package v1.0.0"
if errorlevel 1 (
 echo.
 echo Ilk commit olusturulamadi. Git durumunu kontrol et.
 goto :fail
)
git push -u origin main
if errorlevel 1 (
 echo.
 echo GitHub yuklemesi basarisiz. Git Credential Manager ile tarayicidan giris yapip yeniden dene.
 goto :fail
)
echo.
echo Ilk kaynak kodu GitHub'a yuklendi.
echo Simdi build-windows.bat dosyasini calistirarak ilk EXE'yi olustur.
echo Sonraki her guncellemede publish-release.bat kullan.
pause
exit /b 0
:fail
echo.
echo Islem tamamlanamadi. Repository adinin santiye-patronu ve bos oldugunu kontrol et.
pause
exit /b 1
