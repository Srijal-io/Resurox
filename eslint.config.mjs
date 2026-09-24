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
    "next-env.d.ts",
    ".claude/**",
    "graft/**",
    "tests/**",
    "__tests__/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "prefer-const": "warn",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/lib/ai", "**/lib/ai/*"],
              message: "Scoring, matching, and evidence modules must remain pure and may NOT import from lib/ai/*."
            }
          ]
        }
      ]
    },
  },
  {
    files: ["lib/ai/**", "lib/pipeline/**", "app/**"],
    rules: {
      "no-restricted-imports": "off",
    }
  }
]);

export default eslintConfig;
