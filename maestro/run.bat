@echo off
REM Maestro 실행 헬퍼 — JAVA_HOME 을 JDK21 로 고정
setlocal
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
set "MAESTRO=C:\Users\1\maestro\maestro\bin\maestro.bat"

if "%~1"=="" (
  echo Usage: run.bat ^<flow.yaml^>
  echo   e.g. run.bat flows\smoke_login.yaml
  exit /b 1
)

"%MAESTRO%" test %*
