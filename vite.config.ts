import { defineConfig } from "vite";
import laravel from "laravel-vite-plugin";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// React SPA served by Laravel. Entry: src/main.tsx (mounted by resources/views/app.blade.php).
// Build output goes to public/build with a manifest consumed by the @vite Blade directive.
export default defineConfig(({ mode }) => ({
  plugins: [
    laravel({
      input: ["src/main.tsx"],
      refresh: true,
    }),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    minify: "esbuild",
  },
}));
