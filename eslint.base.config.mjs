import { defineConfig, globalIgnores } from "eslint/config";

const baseConfig = defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/dist/**",
    "**/.turbo/**",
    "**/.venv/**",
    "**/__pycache__/**",
  ]),
]);

export default baseConfig;
