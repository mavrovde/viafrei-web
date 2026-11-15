// @ts-check
import tseslint from "typescript-eslint";

// viafrei's root eslint.config.js (ea91377ba), scoped to the two packages that
// moved here (viafrei-web#2). The ingest layering, the digest's card zones and
// template rule, the status and MCP zones are rules about packages that stayed
// in viafrei, and they stay with them; what is kept is everything that judged
// packages/web and packages/design, unchanged.
export default tseslint.config(
  // `packages/web/build/` is that workspace's tsc output (Astro owns its
  // `dist/`), and `packages/web/.astro/` is Astro's generated type directory.
  // `.pinned/` is the released viafrei-app the tests read (scripts/pinned-app.sh):
  // compiled code of another repository, never ours to lint.
  { ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**", ".pinned/**", "build/**", "packages/web/build/**", "packages/web/.astro/**", "zap-report/**"] },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: { allowDefaultProject: ["vitest.config.ts", "eslint.config.js", "packages/web/vitest.e2e.config.ts"] }, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  // #922 D3: `@viafrei/design` is a LEAF — the site shell imports it, so it
  // imports nothing of it (nor any workspace, nor a file outside its own
  // folder), and its package.json declares nothing.
  {
    files: ["packages/design/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["@viafrei/*", "@viafrei/*/**", "../../*", "../../**"], message: "@viafrei/design is a leaf: it imports no workspace and nothing outside packages/design (#922)." }] }],
    },
  },
  // viafrei-web#2: the site's tests, browser harness and scripts import the released viafrei-app,
  // which ships no declarations (packages/web/tsconfig.consumers.json says what they are checked
  // against instead). The rules that judge the flow of an `any` judge those missing types, not this
  // code, so they are off for these three folders and nowhere else; the site's runtime code keeps them.
  {
    files: ["packages/web/test/**/*.ts", "packages/web/e2e/**/*.ts", "packages/web/scripts/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
    },
  },
  // `.mjs` joins `.js` here: `packages/web/astro.config.mjs` and
  // `scripts/web-contrast.mjs` are plain ES modules outside every tsconfig
  // project, and a type-checked rule set over a file no project owns is a
  // parse error, not a lint.
  { files: ["**/*.js", "**/*.mjs"], ...tseslint.configs.disableTypeChecked },
);
