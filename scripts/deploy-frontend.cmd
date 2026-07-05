@echo off
setlocal DisableDelayedExpansion

if "%~1"=="" goto :usage
if not "%~2"=="" goto :usage

set "API_URL=%~1"
:trim_api_url
if not "%API_URL:~-1%"=="/" goto :api_url_ready
set "API_URL=%API_URL:~0,-1%"
goto :trim_api_url
:api_url_ready
if not defined API_URL goto :usage
set "API_BASE_URL=%API_URL%/api"

set "ROOT=%~dp0.."
set "ENV_FILE=%ROOT%\frontend\.env"
if not exist "%ENV_FILE%" goto :missing_env_file

set "VITE_GOOGLE_CLIENT_ID="
set "VITE_GOOGLE_MAPS_API_KEY="
for /f "usebackq tokens=1,* delims==" %%A in (`findstr /b /c:"VITE_GOOGLE_CLIENT_ID=" /c:"VITE_GOOGLE_MAPS_API_KEY=" "%ENV_FILE%"`) do set "%%A=%%B"

if not defined VITE_GOOGLE_CLIENT_ID goto :missing_client_id
if not defined VITE_GOOGLE_MAPS_API_KEY goto :missing_maps_key

echo Building and pushing citymind-frontend. Credential values will not be displayed.
gcloud builds submit "%ROOT%\frontend" --project "citymind-apac" --region "asia-south1" --config "%ROOT%\frontend\cloudbuild.yaml" --substitutions "_API_BASE_URL=%API_BASE_URL%,_GOOGLE_CLIENT_ID=%VITE_GOOGLE_CLIENT_ID%,_GOOGLE_MAPS_API_KEY=%VITE_GOOGLE_MAPS_API_KEY%"
if errorlevel 1 exit /b %errorlevel%

echo.
echo Build and push complete. Deployment was not run.
echo Run this command manually:
echo gcloud run deploy citymind-frontend --image=asia-south1-docker.pkg.dev/citymind-apac/citymind/citymind-frontend:latest --region=asia-south1 --platform=managed --allow-unauthenticated --port=8080
exit /b 0

:usage
echo Usage: deploy-frontend.cmd ^<api-base-url^>
exit /b 2

:missing_env_file
echo ERROR: frontend\.env was not found.
exit /b 3

:missing_client_id
echo ERROR: VITE_GOOGLE_CLIENT_ID is missing from frontend\.env.
exit /b 4

:missing_maps_key
echo ERROR: VITE_GOOGLE_MAPS_API_KEY is missing from frontend\.env.
exit /b 5
