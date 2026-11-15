/**
 * #922 D3: `@viafrei/design` depends on nothing — its manifest declares no
 * dependency of any kind, its sources import only `node:` built-ins and each
 * other, and the repository's lint rule for its files refuses a workspace or
 * a path out of the package (read from the configuration, run on planted
 * imports, so a removed or narrowed zone fails here).
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint, Linter } from "eslint";
import { describe, expect, it } from "vitest";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = join(PKG, "../..");

const sources = (dir: string): readonly string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? sources(join(dir, d.name)) : d.name.endsWith(".ts") ? [join(dir, d.name)] : []));

describe("#922 D3: @viafrei/design is a leaf", () => {
  it("its manifest declares no dependency", () => {
    const pkg = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as Record<string, unknown>;
    expect(pkg.name).toBe("@viafrei/design");
    for (const k of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) expect(pkg[k], k).toBeUndefined();
  });

  it("its sources import only node: built-ins and each other", () => {
    const files = sources(join(PKG, "src"));
    expect(files.length).toBeGreaterThanOrEqual(5);
    const outside = files.flatMap((f) => [...readFileSync(f, "utf8").matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!).filter((s) => !s.startsWith("./") && !s.startsWith("../") && !s.startsWith("node:")).map((s) => `${f}: ${s}`));
    expect(outside).toEqual([]);
  });

  it("the lint rule for its files refuses a workspace and a path out of the package", async () => {
    const config = (await new ESLint({ cwd: ROOT }).calculateConfigForFile(join(PKG, "src/html.ts"))) as { rules?: Record<string, unknown> };
    const rule = config.rules?.["no-restricted-imports"];
    expect(rule, "no no-restricted-imports rule applies to packages/design").toBeDefined();
    const lint = (code: string): readonly string[] =>
      new Linter({ configType: "flat" }).verify(code, [{ rules: { "no-restricted-imports": rule as Linter.RuleEntry } }], "planted.js").map((m) => m.ruleId ?? "parse");
    expect(lint('import { safe } from "@viafrei/status";\n')).toEqual(["no-restricted-imports"]);
    expect(lint('import { tt } from "@viafrei/digest/presentation/i18n.js";\n')).toEqual(["no-restricted-imports"]);
    expect(lint('import { t } from "../../web/src/i18n/index.js";\n')).toEqual(["no-restricted-imports"]);
    expect(lint('import { C } from "./classes.js";\nimport { RENDERED_STATES } from "../tile.js";\n')).toEqual([]);
  });
});
