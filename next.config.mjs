/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep production builds isolated from the cache used by `next dev`.
  distDir: process.env.NODE_ENV === "production" ? ".next-build" : ".next-dev"
};

export default nextConfig;
