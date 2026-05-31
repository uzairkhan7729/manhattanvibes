/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/api/:path*',       destination: 'http://localhost:8088/api/:path*' },
      { source: '/socket.io/:path*', destination: 'http://localhost:8088/socket.io/:path*' },
    ];
  },
};
export default nextConfig;
