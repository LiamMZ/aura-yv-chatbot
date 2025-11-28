#!/usr/bin/env node

/**
 * Build script to generate vercel.json with dynamic backend URL
 * Uses BACKEND_URL environment variable or defaults to Heroku
 */

const fs = require('fs');
const path = require('path');

// Load .env.local for local development
require('dotenv').config({ path: '.env.local' });

const BACKEND_URL = process.env.BACKEND_URL || 'https://aura-yv-assistant-a3da4a835627.herokuapp.com';

// Remove trailing slash if present for consistency
const cleanBackendUrl = BACKEND_URL.replace(/\/$/, '');

console.log(`🔧 Building vercel.json with backend URL: ${cleanBackendUrl}`);

const vercelConfig = {
  "buildCommand": "npm run prebuild && prisma generate && npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        }
      ]
    }
  ],
  "functions": {
    "app/**": {
      "maxDuration": 30
    }
  },
  "rewrites": [
    {
      "source": "/api/sessions",
      "destination": `${cleanBackendUrl}/api/sessions`
    },
    {
      "source": "/api/sessions/sync-data",
      "destination": `${cleanBackendUrl}/api/sessions/sync-data`
    },
    {
      "source": "/api/sessions/(.*)",
      "destination": `${cleanBackendUrl}/api/sessions/$1`
    },
    {
      "source": "/api/chat",
      "destination": `${cleanBackendUrl}/api/chat`
    },
    {
      "source": "/api/chat/stream",
      "destination": `${cleanBackendUrl}/api/chat/stream`
    },
    {
      "source": "/api/data-extraction",
      "destination": `${cleanBackendUrl}/api/data-extraction`
    },
    {
      "source": "/api/admin/user-data",
      "destination": `${cleanBackendUrl}/api/admin/user-data`
    },
    {
      "source": "/api/admin/stats",
      "destination": `${cleanBackendUrl}/api/admin/stats`
    },
    {
      "source": "/api/admin/feedback",
      "destination": `${cleanBackendUrl}/api/admin/feedback`
    },
    {
      "source": "/api/admin/sessions",
      "destination": `${cleanBackendUrl}/api/admin/sessions`
    },
    {
      "source": "/api/feedback",
      "destination": `${cleanBackendUrl}/api/feedback`
    },
    {
      "source": "/api/messages/(.*)",
      "destination": `${cleanBackendUrl}/api/messages/$1`
    },
    {
      "source": "/api/health",
      "destination": `${cleanBackendUrl}/api/health`
    }
  ]
};

// Write the generated config to vercel.json
const vercelJsonPath = path.join(__dirname, '..', 'vercel.json');
fs.writeFileSync(vercelJsonPath, JSON.stringify(vercelConfig, null, 2));

console.log(`✅ Generated vercel.json successfully`);
console.log(`📝 Backend rewrites configured for: ${cleanBackendUrl}`);