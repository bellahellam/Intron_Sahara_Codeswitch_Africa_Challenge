/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // §14.5 — no third-party analytics, tag managers or session-replay scripts of any kind.
  poweredByHeader: false,
};

export default nextConfig;
