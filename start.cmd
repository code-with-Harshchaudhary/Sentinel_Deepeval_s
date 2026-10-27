@echo off
setlocal
pushd "%~dp0"

rem Let Python and Rich print DeepEval's Unicode progress symbols on Windows.
chcp 65001 >nul
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"

rem Ignore a stale GitHub Desktop PATH entry that can make pip fail on Windows.
set "BROKEN_GITHUB_PATH=%LOCALAPPDATA%\GitHubDesktop\bin"
call set "PATH=%%PATH:%BROKEN_GITHUB_PATH%;=%%"
call set "PATH=%%PATH:;%BROKEN_GITHUB_PATH%=%%"

set "VENV_PY=venv\Scripts\python.exe"
set "DEEPEVAL=venv\Scripts\deepeval.exe"

echo.
echo DeepEval + Gemini quick start
echo =============================

if not exist "%VENV_PY%" goto setup
"%VENV_PY%" -c "import deepeval; import google.genai; import win32file" >nul 2>&1
if errorlevel 1 goto setup
goto configure

:setup
echo [1/3] Preparing Python and installing the project...

if not exist "%VENV_PY%" (
    py -V:Astral/CPython3.11.15 -m venv venv >nul 2>&1
    if errorlevel 1 py -3.11 -m venv venv >nul 2>&1
    if errorlevel 1 python -m venv venv
    if errorlevel 1 goto failed
)

"%VENV_PY%" -m pip install --upgrade pip
if errorlevel 1 goto failed

"%VENV_PY%" -m pip install -e . google-genai "portalocker[win32]"
if errorlevel 1 goto failed

:configure
echo [2/3] Checking Gemini configuration...

if /I "%~1"=="key" goto prompt_key
findstr /R /C:"^GOOGLE_API_KEY=." .env.local >nul 2>&1
if errorlevel 1 goto prompt_key

"%DEEPEVAL%" set-gemini --model gemini-3.5-flash-lite --save=dotenv:.env.local --quiet
if errorlevel 1 goto failed
goto verify_key

:prompt_key
echo.
echo Paste your NEW Gemini API key at the hidden prompt, then press Enter.
echo Nothing will appear while you paste or type. This is normal.
echo The key will be stored only in the git-ignored .env.local file.
"%DEEPEVAL%" set-gemini --model gemini-3.5-flash-lite --prompt-api-key --save=dotenv:.env.local
if errorlevel 1 goto failed

:verify_key
echo.
echo Verifying the key directly with Google...
"%VENV_PY%" scripts\verify_gemini_key.py
if errorlevel 1 goto invalid_key

:run
echo.
echo [3/3] Running the example evaluation...
"%DEEPEVAL%" test run test_ai_agent.py
set "RUN_RESULT=%ERRORLEVEL%"

echo.
if "%RUN_RESULT%"=="0" (
    echo Finished successfully.
) else (
    echo The evaluation did not pass. Review the message above.
)

popd
exit /b %RUN_RESULT%

:invalid_key
echo.
echo Copy the secret VALUE using the Copy API key button in Google AI Studio.
echo Then run: start.cmd key
popd
exit /b 1

:failed
echo.
echo Setup could not be completed. Review the error above and run start.cmd again.
popd
exit /b 1
