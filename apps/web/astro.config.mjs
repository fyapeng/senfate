import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  site: "https://fyapeng.com",
  base: "/senfate",
  integrations: [react()],
  output: "static",
  trailingSlash: "always",
});
