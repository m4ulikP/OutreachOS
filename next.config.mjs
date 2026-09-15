/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    DATABASE_URL:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/outreachos?schema=public",
  },
};

export default nextConfig;
