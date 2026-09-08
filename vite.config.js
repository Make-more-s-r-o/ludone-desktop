import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  // Datum vzniká při sestavení, ne při spuštění aplikace na uživatelově Macu.
  define: {
    "import.meta.env.APP_BUILD_DATE": JSON.stringify(new Date().toISOString()),
  },
  esbuild: {
    jsx: "automatic",
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
});
