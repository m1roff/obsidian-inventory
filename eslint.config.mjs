import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  ...obsidianmd.configs.recommended,
  {
    files: ["**/**.ts"],
    languageOptions: {
      globals: { __DEV__: "readonly" },
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
    },
  },
]);
