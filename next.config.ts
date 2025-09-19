
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  distDir: '.next',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      }
    ],
  },
  experimental: {
    serverActions: {
      maxDuration: 150,
    }
  }
};

export default nextConfig;
