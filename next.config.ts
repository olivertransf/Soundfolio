import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/import", destination: "/me/import", permanent: true },
      { source: "/recent", destination: "/me/recent", permanent: true },
      { source: "/history", destination: "/me/history", permanent: true },
      { source: "/patterns", destination: "/me/patterns", permanent: true },
      { source: "/top-tracks", destination: "/me/top-tracks", permanent: true },
      { source: "/top-artists", destination: "/me/top-artists", permanent: true },
      { source: "/top-albums", destination: "/me/top-albums", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.scdn.co" },
      { protocol: "https", hostname: "lastfm-img2.freetls.fastly.net" },
      { protocol: "https", hostname: "s34.rev.sc" },
      { protocol: "https", hostname: "userserve-ak.last.fm" },
      { protocol: "http", hostname: "userserve-ak.last.fm" },
      { protocol: "https", hostname: "lastfm.freetls.fastly.net" },
      { protocol: "https", hostname: "i.discogs.com" },
      { protocol: "https", hostname: "is1-ssl.mzstatic.com" },
      { protocol: "https", hostname: "coverartarchive.org" },
    ],
  },
};

export default nextConfig;
