import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite acceder al servidor de desarrollo desde otros dispositivos en la red local
  allowedDevOrigins: ['192.168.100.98'],
};

export default nextConfig;
