import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server output for a minimal Docker runtime image.
  output: "standalone",
  // better-sqlite3 is a native module; keep it out of the bundle and load it
  // at runtime from node_modules on the server.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
