import { defineConfig } from "vite";

export default defineConfig({
  assetsInclude: ["**/*.spz", "**/*.rad", "**/*.glb", "**/*.ply"],
  optimizeDeps: {
    exclude: ["@sparkjsdev/spark", "@dimforge/rapier3d-compat"],
  },
  build: {
    target: "esnext",
  },
});
