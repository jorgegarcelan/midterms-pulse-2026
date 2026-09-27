import type { NextConfig } from "next";

// Share images read the Geist fonts and district boundaries from disk at request time.
const shareAssets = ["./src/assets/fonts/**", "./public/data/congressional-districts-119.geojson"];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/share/[...path]": shareAssets,
    "/opengraph-image": shareAssets,
    "/races/[slug]/opengraph-image": shareAssets,
    "/states/[code]/opengraph-image": shareAssets,
  },
};

export default nextConfig;
