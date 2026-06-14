/** @type {import('next').NextConfig} */

// In production (Vercel) set NEXT_PUBLIC_API_URL to the Fly backend, e.g.
// https://nexus-bd-backend.fly.dev. Locally it defaults to the dev server.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
