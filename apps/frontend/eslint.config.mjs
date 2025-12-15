import { defineConfig, globalIgnores } from "eslint/config";
import baseConfig from "../../eslint.base.config.mjs";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...baseConfig,
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Monorepo packages:
    "apps/backend/**",
  ]),
]);

export default eslintConfig;
