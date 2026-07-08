import { defineConfig } from "vite";

export default defineConfig({
  root: new URL(".", import.meta.url).pathname,
  base: process.env.GITHUB_PAGES === "true" ? "/clickhouse/" : "/",
  build: {
    outDir: "../demo-dist",
    emptyOutDir: true,
  },
});
