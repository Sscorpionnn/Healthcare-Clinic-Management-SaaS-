import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// No inline scripts anywhere in this app, so CSP omits 'unsafe-inline' for
// script-src entirely — see docs/threat-model.md T7 (XSS).
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // Tailwind/CSS-in-JS injected styles; no script execution risk
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' " + (process.env.API_URL ?? "http://localhost:4000"),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone output is what apps/web/Dockerfile's runtime stage copies
  // (.next/standalone + .next/static) — see docs/deployment.md.
  output: "standalone",
  transpilePackages: ["@clinic/shared"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
