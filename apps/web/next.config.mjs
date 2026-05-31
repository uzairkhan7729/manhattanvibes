/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'rsms.me' },
    ],
  },
  async rewrites() {
    return [
      { source: '/api/:path*',       destination: 'http://localhost:8088/api/:path*' },
      { source: '/socket.io/:path*', destination: 'http://localhost:8088/socket.io/:path*' },
    ];
  },
};
export default nextConfig;
