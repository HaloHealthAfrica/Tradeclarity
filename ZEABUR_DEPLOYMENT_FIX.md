# Zeabur Deployment Fix

## Issue
The deployment is failing because it's trying to use `ts-node` which is not available in production. The error shows:
```
sh: ts-node: not found
```

## Root Cause
Zeabur was using its own nodejs builder instead of our custom Dockerfile that uses the compiled JavaScript version.

## Fix Applied
1. **Updated `zeabur.toml`** to use our custom Dockerfile:
   ```toml
   [build]
   builder = "docker"
   dockerfile = "Dockerfile.zeabur"
   ```

2. **Updated `Dockerfile.zeabur`** to install only production dependencies:
   ```dockerfile
   RUN npm ci --only=production
   ```

## Files Changed
- `zeabur.toml` - Now uses docker builder with our custom Dockerfile
- `Dockerfile.zeabur` - Uses production-only dependencies

## Next Steps
1. **Commit and push the changes:**
   ```bash
   git add zeabur.toml Dockerfile.zeabur
   git commit -m "Fix Zeabur deployment: use custom Dockerfile and production dependencies"
   git push
   ```

2. **Redeploy on Zeabur:**
   - Go to your Zeabur dashboard
   - Trigger a new deployment
   - The build should now use `Dockerfile.zeabur` and `npm run start:prod`

3. **Verify the deployment:**
   - Check that the server starts without `ts-node` errors
   - Test the health endpoint: `https://your-app.zeabur.app/health`

## Expected Behavior
After the fix, the deployment should:
- Use our custom Dockerfile that installs only production dependencies
- Run `npm run start:prod` which uses the compiled `server-simple.js`
- Start successfully without `ts-node` dependency issues
- Be accessible on port 8080 (Zeabur's default)

## Troubleshooting
If the issue persists:
1. Check that `server-simple.js` exists in your repository
2. Verify that `package.json` has the `start:prod` script
3. Ensure all environment variables are set in Zeabur dashboard 