import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empty Turbopack config silences the "webpack config + Turbopack" error in
  // `next dev`. Serwist attaches a webpack config; the production build runs
  // with `--webpack` so the service worker is still generated. See CLAUDE.md.
  turbopack: {},
};

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Service worker is noisy and unhelpful during local development.
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
