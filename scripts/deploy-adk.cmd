@echo off
setlocal
if "%~1"=="" goto :usage
set "API_URL=%~1"
set "PROJECT_ID=citymind-apac"
set "REGION=asia-south1"
set "REPOSITORY=citymind"
set "SERVICE=citymind-adk"
set "SERVICE_ACCOUNT=citymind-runtime@citymind-apac.iam.gserviceaccount.com"
set "ROOT=%~dp0.."
set "IMAGE=%REGION%-docker.pkg.dev/%PROJECT_ID%/%REPOSITORY%/%SERVICE%:latest"
echo Building %SERVICE% with Dockerfile.adk...
gcloud builds submit "%ROOT%\backend" --project "%PROJECT_ID%" --config "%ROOT%\backend\cloudbuild-adk.yaml" --substitutions "_IMAGE=%IMAGE%"
if errorlevel 1 exit /b %errorlevel%
echo Deploying %SERVICE% (prototype bridge requires public network access)...
gcloud run deploy "%SERVICE%" --project "%PROJECT_ID%" --region "%REGION%" --platform managed --image "%IMAGE%" --service-account "%SERVICE_ACCOUNT%" --allow-unauthenticated --set-secrets "GEMINI_API_KEY=citymind-google-api-key:latest,CITYMIND_INTERNAL_SERVICE_TOKEN=citymind-internal-service-token:latest" --set-env-vars "GOOGLE_GENAI_USE_VERTEXAI=FALSE,CITYMIND_BACKEND_BASE_URL=%API_URL%,ENVIRONMENT=production" --port 8080 --concurrency 1
exit /b %errorlevel%
:usage
echo Usage: deploy-adk.cmd ^<citymind-api-url^>
exit /b 2
