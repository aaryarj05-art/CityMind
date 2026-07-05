import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const securityHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
};

const removeProductionLoopbackPlaceholders = {
  name: "remove-production-loopback-placeholders",
  apply: "build",
  renderChunk(code) {
    const sanitized = code
      .replaceAll("http://localhost", "https://citymind.invalid")
      .replaceAll("http://127.0.0.1", "https://citymind.invalid");
    return sanitized === code ? null : { code: sanitized, map: null };
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), removeProductionLoopbackPlaceholders],
  server: { headers: securityHeaders },
  preview: { headers: securityHeaders },
});
