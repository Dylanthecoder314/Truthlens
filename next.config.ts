import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Node-only packages that should not be bundled.
  serverExternalPackages: ["jsdom", "@libsql/client", "libsql"],
};

export default nextConfig;
