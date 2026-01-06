/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    console.log('Using backend URL for rewrites:', backendUrl);

    return [
      {
        source: '/api/sessions',
        destination: `${backendUrl}/api/sessions`,
      },
      {
        source: '/api/sessions/sync-data',
        destination: `${backendUrl}/api/sessions/sync-data`,
      },
      {
        source: '/api/sessions/:path*',
        destination: `${backendUrl}/api/sessions/:path*`,
      },
      {
        source: '/api/chat',
        destination: `${backendUrl}/api/chat`,
      },
      {
        source: '/api/chat/stream',
        destination: `${backendUrl}/api/chat/stream`,
      },
      {
        source: '/api/data-extraction',
        destination: `${backendUrl}/api/data-extraction`,
      },
      {
        source: '/api/admin/user-data',
        destination: `${backendUrl}/api/admin/user-data`,
      },
      {
        source: '/api/admin/stats',
        destination: `${backendUrl}/api/admin/stats`,
      },
      {
        source: '/api/admin/feedback',
        destination: `${backendUrl}/api/admin/feedback`,
      },
      {
        source: '/api/admin/sessions',
        destination: `${backendUrl}/api/admin/sessions`,
      },
      {
        source: '/api/feedback',
        destination: `${backendUrl}/api/feedback`,
      },
      {
        source: '/api/messages/:path*',
        destination: `${backendUrl}/api/messages/:path*`,
      },
      {
        source: '/api/health',
        destination: `${backendUrl}/api/health`,
      },
    ];
  },
};

module.exports = nextConfig;
