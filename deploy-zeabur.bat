@echo off
echo ========================================
echo Zeabur Deployment Script
echo ========================================

echo.
echo 1. Checking current status...
git status

echo.
echo 2. Adding deployment files...
git add zeabur.toml Dockerfile.zeabur server-simple.js package.json

echo.
echo 3. Committing changes...
git commit -m "Fix Zeabur deployment: use custom Dockerfile and production dependencies"

echo.
echo 4. Pushing to remote...
git push

echo.
echo ========================================
echo Deployment files pushed successfully!
echo ========================================
echo.
echo Next steps:
echo 1. Go to your Zeabur dashboard
echo 2. Trigger a new deployment
echo 3. Monitor the build logs
echo 4. Test the health endpoint when deployed
echo.
echo Health check URL: https://your-app.zeabur.app/health
echo.
pause 