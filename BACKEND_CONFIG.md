# Backend URL Configuration

This project uses a dynamic configuration system that allows you to configure the backend URL using environment variables.

## How it works

1. **Environment Variable**: Set `BACKEND_URL` in your `.env.local` file
2. **Build Script**: The `scripts/build-config.js` script reads this variable
3. **Dynamic Generation**: The script generates `vercel.json` with the correct backend URL
4. **Automatic Execution**: The build script runs automatically before each build via the `prebuild` npm script

## Configuration

### Local Development

In your `.env.local` file:
```
BACKEND_URL=https://aura-yv-assistant-a3da4a835627.herokuapp.com
```

### Vercel Deployment

Set the `BACKEND_URL` environment variable in your Vercel project settings:

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add `BACKEND_URL` with your backend URL value
4. Redeploy your project

### Other Deployments

For other deployment platforms, ensure the `BACKEND_URL` environment variable is set during the build process.

## Default Fallback

If no `BACKEND_URL` is provided, the system defaults to:
```
https://aura-yv-assistant-a3da4a835627.herokuapp.com
```

## API Endpoints Proxied

The following endpoints are automatically proxied from frontend to backend:

- `/api/sessions`
- `/api/sessions/sync-data`
- `/api/sessions/*` (all session routes)
- `/api/chat`
- `/api/data-extraction`
- `/api/admin/*` (all admin routes)
- `/api/feedback`
- `/api/messages/*` (all message routes)
- `/api/health`

## Build Process

The configuration happens automatically during the build:

1. `npm run prebuild` → Runs `scripts/build-config.js`
2. Script reads `BACKEND_URL` from environment
3. Script generates `vercel.json` with correct rewrites
4. `npm run build` → Next.js build proceeds with correct configuration

## Manual Configuration

If you need to manually regenerate the `vercel.json`:

```bash
npm run prebuild
```

Or directly:

```bash
node scripts/build-config.js
```

## Troubleshooting

### Build fails with "Cannot find module 'dotenv'"
Run: `npm install dotenv --save-dev`

### Backend URL not updating
1. Check that `BACKEND_URL` is set in your environment
2. Manually run `npm run prebuild` to regenerate `vercel.json`
3. Verify the generated `vercel.json` contains your URL

### CORS issues
Make sure your backend allows requests from your frontend domain in its CORS configuration.