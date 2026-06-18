import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/me/import", destination: "/history/import", permanent: true },
      { source: "/me/recent", destination: "/history/recent", permanent: true },
      { source: "/import", destination: "/history/import", permanent: true },
      { source: "/recent", destination: "/history/recent", permanent: true },
      { source: "/me/history", destination: "/history", permanent: true },
      { source: "/me/patterns", destination: "/me", permanent: true },
      { source: "/me/top-tracks", destination: "/top-tracks", permanent: true },
      { source: "/me/top-artists", destination: "/top-artists", permanent: true },
      { source: "/me/top-albums", destination: "/top-albums", permanent: true },
      { source: "/history/recent", destination: "/library?section=recent", permanent: false },
      { source: "/top-tracks", destination: "/library?section=rankings", permanent: false },
      { source: "/top-artists", destination: "/library?section=rankings", permanent: false },
      { source: "/top-albums", destination: "/library?section=rankings", permanent: false },
      { source: "/patterns", destination: "/library?section=patterns", permanent: false },
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
      { protocol: "https", hostname: "cdn-images.dzcdn.net" },
      { protocol: "https", hostname: "coverartarchive.org" },
      { protocol: "http", hostname: "coverartarchive.org" },
    ],
  },
};

export default nextConfig;
