import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: { "@next/next/no-img-element": "off" } }, // Native images preserve deliberate pixel rendering and fixed sprite dimensions.
  globalIgnores([".next/**", "node_modules/**", "src/**", ".pi/**", ".impeccable/**", "next-env.d.ts"]),
]);
