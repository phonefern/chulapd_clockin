import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.ngrok-free.app", "a6ca-171-102-69-51.ngrok-free.app"],
  // @sparticuz/chromium unpacks its brotli-compressed browser from bin/ at runtime; file tracing
  // can't see those reads, so ship them explicitly with the PDF route.
  outputFileTracingIncludes: {
    "/api/reports/pdf/\\[approvalId\\]": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
};

export default nextConfig;
