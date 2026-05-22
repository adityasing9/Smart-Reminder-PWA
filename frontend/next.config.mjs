/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 0
    }
  },

  headers: async () => [
    {
      source: "/service-worker.js",
      headers: [
        {
          key: "Cache-Control",
          value: "no-cache, no-store, must-revalidate"
        }
      ]
    }
  ]
};

export default nextConfig;