import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
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
});
