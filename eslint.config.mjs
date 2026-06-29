import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "lib/generated/**",
    "next-env.d.ts",
  ]),
  // Syncing URL/searchParams into local UI state in effects is intentional here.
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
