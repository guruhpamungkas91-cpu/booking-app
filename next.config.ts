/** @type {import('next').NextType} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Mengizinkan semua domain gambar (paling praktis)
      },
    ],
  },
};

module.exports = nextConfig;