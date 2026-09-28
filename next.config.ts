import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co', // Akses khusus domain Supabase Storage
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com', // Opsional jika pakai Unsplash
      },
    ],
  },
};

export default nextConfig;