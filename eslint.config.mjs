// Flat ESLint config (ESLint 9+) shared across the whole npm workspaces monorepo.
// Each workspace (apps/*, packages/*, services/*) is linted with the same
// TypeScript-aware rule set via `npm run lint` at the root.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    // Global ignores — build output, deps, native/mobile build folders, docs assets.
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/.vite/**",
      ".claude/worktrees/**",
      "apps/vendor-mobile/android/**",
      "apps/vendor-mobile/ios/**",
      "**/*.min.js"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022
      },
      parserOptions: {
        // Pin the project root explicitly — without this, typescript-eslint's
        // auto-detection can get confused by a stray tsconfig.json under a
        // leftover .claude/worktrees/* directory and refuse to lint anything.
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": "off"
    }
  },
  {
    // Browser globals for the admin web app.
    files: ["apps/admin-web/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    }
  },
  {
    // React Native / Android runtime globals for the vendor mobile app.
    files: ["apps/vendor-mobile/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals["shared-node-browser"]
      }
    }
  },
  // Prettier last: turns off stylistic rules that would conflict with Prettier formatting.
  eslintConfigPrettier
);
