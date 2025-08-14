const nextConfig = {
  swcMinify: true,
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true
  },
  // Removed headers() function as it doesn't work with static export
};

module.exports = nextConfig;
