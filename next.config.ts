import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Mặc định 1MB — nâng lên để import file Excel danh mục vật tư không bị chặn
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
