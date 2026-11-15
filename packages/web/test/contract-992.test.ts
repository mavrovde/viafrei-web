/**
 * #992: `src/generated/contract.json` — what the developers page lists — is what the server registers. It is built by
 * `scripts/generate-catalogue.ts` from the same in-memory server `npm run mcp:contract -- --names` boots, so a tool
 * added to the server and not regenerated here fails this test, and a regenerated file shows the tool on the page with
 * no page edit (`developers-992.test.ts` reads the cards off the file).
 */
import { describe, expect, it } from "vitest";
import contract from "../src/generated/contract.json" with { type: "json" };
import catalogue from "../src/generated/catalogue.json" with { type: "json" };
import { connectInMemory } from "../../../.pinned/app/packages/mcp/dist/src/server/testing.js";
import { buildContract } from "../scripts/generate-catalogue.js";

describe("contract.json (#992)", () => {
  // cross-repo(viafrei): reads viafrei's CHANGELOG.md, the MCP server's release history; the catalogue it checks is generated in viafrei (scripts/generate-catalogue.ts) and arrives here as src/generated/*.json (viafrei-web#2, docs/moved-from-viafrei.md)
  it.skip("equals a fresh build: no drift between the server and the page", async () => {
    expect(JSON.parse(JSON.stringify(await buildContract()))).toEqual(contract);
  });

  it("its tool names are the server's registered tools, in the server's order — the `mcp:contract --names` list", async () => {
    const stubDb = { query: () => Promise.reject(new Error("no DB")) };
    const client = await connectInMemory({ db: stubDb as never });
    const { tools } = await client.listTools();
    expect(contract.tools.map((x) => x.name)).toEqual(tools.map((x) => x.name));
    expect(contract.tools.map((x) => x.name)).toEqual(catalogue.tools.map((x) => x.name));
    expect(contract.tools.length).toBeGreaterThan(0);
  });
});
