/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Solo el portal Tesorería COFERSA puede mostrar esta app dentro de su página.
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://cofersa-tesoreria.vercel.app https://cofersa-erp.vercel.app" },
        ],
      },
    ];
  },
};

export default nextConfig;
