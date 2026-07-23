import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  site: "https://fyapeng.github.io",
  base: "/senfate",
  output: "static",
  trailingSlash: "always",
  integrations: [react()],
});
