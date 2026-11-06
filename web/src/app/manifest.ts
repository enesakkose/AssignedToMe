import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AssignedToMe",
    short_name: "AssignedToMe",
    description: "Every task assigned to you, from all your boards, in one list.",
    start_url: "/app",
    display: "standalone",
    background_color: "#141517",
    theme_color: "#141517",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
