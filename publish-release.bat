@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo =====================================================
echo  SANTIYE PATRONU - YENI SURUM YAYINLAMA
echo =====================================================
where git >nul 2>nul
if errorlevel 1 (echo Git bulunamadi.&goto :fail)
where node >nul 2>nul
if errorlevel 1 (echo Node.js 24 LTS kurulu olmali.&goto :fail)
if not exist ".git" (echo Git deposu yok. Ilk once SETUP_GITHUB.bat calistir.&goto :fail)
set /p VER=Yeni surum numarasi (orn. 1.0.1):
if "%VER%"=="" goto :fail
set /p NOTES=Bu surumdeki degisiklik (tek satir):
if "%NOTES%"=="" set "NOTES=Oyun guncellendi."
set "NEWVER=%VER%"
set "RELEASE_NOTES=%NOTES%"

node -e "const fs=require('fs');const p=require('./package.json');const v=process.env.NEWVER;if(!/^[0-9]+[.][0-9]+[.][0-9]+$/.test(v)){console.error('Surum X.Y.Z formatinda olmali.');process.exit(2)}if(p.repository?.url?.includes('YOUR_GITHUB_USERNAME')){console.error('Once SETUP_GITHUB.bat ile GitHub baglantisini yap.');process.exit(3)}const cp=require('child_process');try{cp.execFileSync('git',['rev-parse','-q','--verify','refs/tags/v'+v],{stdio:'ignore'});console.error('Bu surum etiketi zaten var. Yeni surum numarasi gir.');process.exit(4)}catch(e){}p.version=v;fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');fs.writeFileSync('VERSION.txt','Santiye Patronu Windows\nVersion: '+v+'\nBuild target: Windows 10/11 x64\n');const c='## '+v+' - '+new Date().toISOString().slice(0,10)+'\n- '+(process.env.RELEASE_NOTES||'Oyun guncellendi.')+'\n\n';const old=fs.existsSync('CHANGELOG.md')?fs.readFileSync('CHANGELOG.md','utf8'):'';fs.writeFileSync('CHANGELOG.md',c+old)"
if errorlevel 1 goto :fail

git add -A
git commit -m "Release v%VER%"
if errorlevel 1 goto :fail
git tag "v%VER%"
if errorlevel 1 goto :fail

echo.
echo Degisiklikler yerel Git deposuna kaydedildi.
git push origin main
if errorlevel 1 goto :pushfail
git push origin "refs/tags/v%VER%"
if errorlevel 1 goto :pushfail

echo.
echo v%VER% etiketi GitHub'a gonderildi.
echo GitHub Actions Windows kurulum EXE'sini uretip Releases bolumune yukleyecek.
echo Oyuncular uygulamayi acinca guncelleme bildirimi alacak.
pause
exit /b 0
:pushfail
echo.
echo Push basarisiz. Yerel commit ve etiket olustu; GitHub girisini kontrol et.
echo Tekrar denemek icin Komut Istemi'nde:
echo git push origin main ^&^& git push origin refs/tags/v%VER%
pause
exit /b 1
:fail
echo.
echo Yayin basarisiz. Surum formatini, GitHub baglantisini ve Git durumunu kontrol et.
pause
exit /b 1
