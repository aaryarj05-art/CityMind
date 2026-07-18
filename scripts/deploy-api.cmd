@echo off
setlocal
if "%~1"=="" goto :usage
if "%~2"=="" goto :usage
set "ADK_URL=%~1"
set "FRONTEND_ORIGIN=%~2"
set "PROJECT_ID=citymind-apac"
set "REGION=asia-south1"
set "REPOSITORY=citymind"
set "SERVICE=citymind-api"
set "SERVICE_ACCOUNT=citymind-runtime@citymind-apac.iam.gserviceaccount.com"
set "ROOT=%~dp0.."
set "IMAGE=%REGION%-docker.pkg.dev/%PROJECT_ID%/%REPOSITORY%/%SERVICE%:latest"
echo Building %SERVICE% with Dockerfile.api...
gcloud builds submit "%ROOT%\backend" --project "%PROJECT_ID%" --config "%ROOT%\backend\cloudbuild-api.yaml" --substitutions "_IMAGE=%IMAGE%"
if errorlevel 1 exit /b %errorlevel%
echo Deploying %SERVICE%...
gcloud run deploy "%SERVICE%" --project "%PROJECT_ID%" --region "%REGION%" --platform managed --image "%IMAGE%" --service-account "%SERVICE_ACCOUNT%" --allow-unauthenticated --set-secrets "GOOGLE_MAPS_SERVER_API_KEY=citymind-maps-server-key:latest,GOOGLE_OAUTH_CLIENT_ID=citymind-oauth-client-id:latest,CITYMIND_JWT_SECRET=citymind-jwt-secret:latest,CITYMIND_INTERNAL_SERVICE_TOKEN=citymind-internal-service-token:latest,CITYMIND_ROLE_MAPPINGS_JSON=citymind-role-mappings:latest,OPENWEATHER_API_KEY=citymind-weather-key:latest" --set-env-vars "CITYMIND_SESSION_MINUTES=15,CITYMIND_JUDGE_OPEN_ACCESS=true,ADK_BASE_URL=%ADK_URL%,ENVIRONMENT=production,CITYMIND_ALLOWED_ORIGINS=%FRONTEND_ORIGIN%" --port 8080 --concurrency 1 --max-instances 1
exit /b %errorlevel%
:usage
echo Usage: deploy-api.cmd ^<citymind-adk-url^> ^<exact-frontend-origin^>
exit /b 2
