import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Suilend SDK expects "@suilend/frontend‐sui"
      "@suilend/frontend-sui": "@suilend/frontend-sui-next",
    },
  },
  optimizeDeps: {
    include: ["lodash"],
  },
});
