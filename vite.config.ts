import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Redirect any `@mysten/sui` to the client entrypoint
      { find: /^@mysten\/sui$/, replacement: "@mysten/sui/client" },
      // (optional) if you import transactions bare, you can alias that too:
      {
        find: "@mysten/sui/transactions",
        replacement: "@mysten/sui/transactions",
      },
      // your other aliases…
    ],
  },
});
