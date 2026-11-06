import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// React's dev tools need eval; production does not.
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(process.env.NODE_ENV === "production" ? [] : ["'unsafe-eval'"]),
];

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src ${scriptSrc.join(" ")}`,
  "style-src 'self' 'unsafe-inline'",
  // Provider marks are data: URLs from @mytask/core; no remote images are loaded.
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // @mytask/core ships TypeScript source.
  transpilePackages: ["@mytask/core"],
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default createNextIntlPlugin()(nextConfig);
