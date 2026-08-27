import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Adds a Content-Security-Policy to the built index.html only (apply: "build"
// — dev keeps running unrestricted since Vite's dev-mode HMR/react-refresh
// client relies on inline <script> content that a strict script-src would
// block). Mitigates XSS impact given the auth token currently lives in
// localStorage rather than an httpOnly cookie.
function cspPlugin(apiUrl: string): Plugin {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    `connect-src 'self' ${apiUrl}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  return {
    name: "inject-csp",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "VITE_");
  const apiUrl = env.VITE_API_URL || "http://localhost:3000";

  return {
    plugins: [react(), cspPlugin(apiUrl)],
    resolve: {
      alias: {
        // Mirrors the TS path alias in /tsconfig.base.json — dev-server/esbuild
        // resolves @indus/shared-types straight to source, no build step needed.
        "@indus/shared-types": path.resolve(__dirname, "../../packages/shared-types/src"),
      },
    },
    server: {
      port: 5173,
    },
  };
});
