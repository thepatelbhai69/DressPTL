import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @dressptl/shared ships TypeScript source rather than a build artefact, so
  // Next has to compile it alongside the app.
  transpilePackages: ["@dressptl/shared"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
