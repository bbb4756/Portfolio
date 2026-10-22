import type { NextConfig } from "next";

function origin(value?: string) {
  if (!value) return "";
  try { return new URL(value).origin; }
  catch { return ""; }
}

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    const scriptPolicy = process.env.NODE_ENV === "development" ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'unsafe-inline'";
    const publicMediaOrigin = origin(process.env.CMS_MEDIA_PUBLIC_BASE_URL);
    const uploadOrigin = process.env.CMS_MEDIA_STORAGE === "r2" && process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : origin(process.env.CMS_LOCAL_MEDIA_ORIGIN);
    const mediaSources = [...new Set([publicMediaOrigin].filter(Boolean))].join(" ");
    const connectSources = [...new Set([uploadOrigin, publicMediaOrigin].filter(Boolean))].join(" ");
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: `default-src 'self'; script-src ${scriptPolicy}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${mediaSources}; media-src 'self' blob: ${mediaSources}; font-src 'self'; connect-src 'self' ws: wss: ${connectSources}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self' https://github.com` },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ],
    }];
  },
};

export default nextConfig;
