export default {
  basePath: '/marketingdata',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/marketingdata',
        permanent: false,
        basePath: false,
      },
      {
        source: '/connections',
        destination: '/marketingdata/connections',
        permanent: false,
        basePath: false,
      },
      {
        source: '/admin',
        destination: '/marketingdata/admin',
        permanent: false,
        basePath: false,
      },
    ];
  },
};
