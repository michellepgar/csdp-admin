import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /* A note or comment with pasted images is saved through a Server
         Action with the images embedded in its text. Pasted images are
         shrunk in the browser first (lib/shrink-image.ts), but a note
         with a few of them can still pass Next's 1 MB default and fail
         to save. 4 MB keeps headroom while staying under Vercel's
         ~4.5 MB request limit for serverless functions. */
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
