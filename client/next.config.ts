import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const runtimeCaching = [
  {
    urlPattern: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
    handler: "CacheFirst",
    options: {
      cacheName: "google-fonts-webfonts",
      expiration: {
        maxEntries: 4,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
    handler: "StaleWhileRevalidate",
    options: {
      cacheName: "google-fonts-stylesheets",
      expiration: {
        maxEntries: 4,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
    handler: "CacheFirst",
    options: {
      cacheName: "static-font-assets",
      expiration: {
        maxEntries: 8,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp|avif)$/i,
    handler: "CacheFirst",
    options: {
      cacheName: "static-image-assets",
      expiration: {
        maxEntries: 128,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /\/_next\/image\?url=.+$/i,
    handler: "CacheFirst",
    options: {
      cacheName: "next-image",
      expiration: {
        maxEntries: 128,
        maxAgeSeconds: 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /\.(?:js)$/i,
    handler: "StaleWhileRevalidate",
    options: {
      cacheName: "static-js-assets",
      expiration: {
        maxEntries: 64,
        maxAgeSeconds: 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /\.(?:css|less)$/i,
    handler: "StaleWhileRevalidate",
    options: {
      cacheName: "static-style-assets",
      expiration: {
        maxEntries: 64,
        maxAgeSeconds: 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
    handler: "StaleWhileRevalidate",
    options: {
      cacheName: "next-data",
      expiration: {
        maxEntries: 64,
        maxAgeSeconds: 24 * 60 * 60,
      },
    },
  },
  {
    urlPattern: ({ url }: { url: URL }) => {
      if (self.origin !== url.origin) return false;
      return url.pathname.startsWith("/api/");
    },
    handler: "NetworkOnly",
    method: "GET",
    options: {
      cacheName: "apis",
    },
  },
  {
    urlPattern: ({ url }: { url: URL }) => {
      if (self.origin !== url.origin) return false;
      return !url.pathname.startsWith("/api/");
    },
    handler: "NetworkFirst",
    options: {
      cacheName: "pages-and-other-same-origin",
      expiration: {
        maxEntries: 32,
        maxAgeSeconds: 24 * 60 * 60,
      },
      networkTimeoutSeconds: 10,
    },
  },
  {
    urlPattern: ({ url }: { url: URL }) => self.origin !== url.origin,
    handler: "NetworkFirst",
    options: {
      cacheName: "cross-origin",
      expiration: {
        maxEntries: 32,
        maxAgeSeconds: 60 * 60,
      },
      networkTimeoutSeconds: 10,
    },
  },
] as const;

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching,
  fallbacks: {
    document: "/offline",
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withPWA(nextConfig);
