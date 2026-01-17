import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  env: {
    APP_VERSION: packageJson.version,
  },
};

export default nextConfig;
