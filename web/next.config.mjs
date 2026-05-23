/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // three est livré en ESM moderne — on le transpile pour être tranquille
  transpilePackages: ['three'],
};

export default nextConfig;
