import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vinext also inspects multipart API uploads through its progressive-action
  // parser. Allow our 8MB photo limit plus multipart metadata at that layer.
  experimental: { serverActions: { bodySizeLimit: "9mb" } },
};

export default nextConfig;
