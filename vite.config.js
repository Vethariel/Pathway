import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  // Relative base works for GitHub Pages project sites (/Pathway/) and avoids
  // broken absolute paths when the deploy URL does not match REPO_NAME exactly.
  base: mode === "ghpages" ? "./" : "/",
  server: {
    open: true,
  },
  publicDir: "public",
}));
