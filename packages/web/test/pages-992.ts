/**
 * #992: the developers and business pages as rendered — Astro's container over the e2e fixture digest and the asks
 * stub (both loopback; no database, no public server, no provider). `MCP_INTERNAL_URL` and `DIGEST_URL` are read by
 * the pages at render time (`readEnv()`), so one harness renders the held, the dead and the stale states by pointing
 * them elsewhere between renders. Not a test file: the helper the `*-992.test.ts` files share.
 */
import { createServer as createHttp } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import { getViteConfig } from "astro/config";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { all, text, type El } from "@viafrei/design/testing";
import { startAsksStub } from "../e2e/asks-stub.js";
import { startRealDigest } from "../e2e/real-digest.js";
import type { Lang } from "../src/site/pages.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const DEVELOPERS = "/src/pages/[lang]/developers.astro";
export const BUSINESS = "/src/pages/[lang]/business.astro";
export const HOME = "/src/pages/[lang]/index.astro";

export type Pages = {
  /** The page in `lang`; `env` replaces the two internal origins for this render only. */
  render(file: string, lang: Lang, env?: { readonly mcp?: string | null; readonly digest?: string }): Promise<string>;
  readonly asksUrl: string;
  /** A stub whose held call and answers are `minutes` old. */
  staleAsks(minutes: number): Promise<string>;
  /** A stub whose answers for these keys credit these sources instead (#1190). */
  crediting(sources: Readonly<Record<string, readonly string[]>>): Promise<string>;
  /**
   * The fixture digest with these tiles' `Tile-Credits` replaced, or removed by null (#1190); the facts named in
   * `emptyFacts` answer 200 `is-empty` (no figure) with their credits kept, as a fact with nothing to say does.
   */
  digestCrediting(credits: Readonly<Record<string, string | null>>, emptyFacts?: readonly string[]): Promise<string>;
  /** An origin nothing listens on: every read from it fails at once. */
  readonly deadUrl: string;
  close(): Promise<void>;
};

export async function startPages(): Promise<Pages> {
  const digest = await startRealDigest();
  const asks = await startAsksStub();
  const extra: { close(): Promise<void> }[] = [];
  const probe = createHttp();
  await new Promise<void>((r) => probe.listen(0, "127.0.0.1", () => r()));
  const deadUrl = `http://127.0.0.1:${String((probe.address() as AddressInfo).port)}`;
  await new Promise<void>((r) => probe.close(() => r()));
  const saved = { DIGEST_URL: process.env["DIGEST_URL"], MCP_INTERNAL_URL: process.env["MCP_INTERNAL_URL"] };
  const config = await (getViteConfig({}, { root: ROOT, logLevel: "error" }) as (e: { mode: string; command: "serve" | "build" }) => Promise<Record<string, unknown>>)({ mode: "test", command: "serve" });
  const vite: ViteDevServer = await createServer({ ...config, configFile: false, root: ROOT, logLevel: "error", server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  const container = await AstroContainer.create();
  for (const f of [DEVELOPERS, BUSINESS, HOME]) await vite.ssrLoadModule(f);
  const set = (k: "DIGEST_URL" | "MCP_INTERNAL_URL", v: string | undefined): void => {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  };
  return {
    asksUrl: asks.url,
    deadUrl,
    async render(file, lang, env = {}) {
      set("DIGEST_URL", env.digest ?? digest.url);
      set("MCP_INTERNAL_URL", env.mcp === null ? undefined : (env.mcp ?? asks.url));
      const mod = (await vite.ssrLoadModule(file)) as { default: Parameters<AstroContainer["renderToString"]>[0] };
      const page = file === DEVELOPERS ? "developers" : file === HOME ? "" : "business";
      return container.renderToString(mod.default, {
        params: { lang },
        request: new Request(`https://viafrei.de/${lang}/${page}`, { headers: { "accept-language": lang, "user-agent": "Mozilla/5.0" } }),
        locals: { nonce: "n", googleTag: undefined, clarityId: undefined, mapPlatform: "other" },
      });
    },
    async staleAsks(minutes) {
      const s = await startAsksStub(minutes);
      extra.push(s);
      return s.url;
    },
    async crediting(sources) {
      const s = await startAsksStub(4, sources);
      extra.push(s);
      return s.url;
    },
    async digestCrediting(credits, emptyFacts = []) {
      const server = createHttp((req, res) => {
        void fetch(`${digest.url}${req.url ?? "/"}`).then(async (r) => {
          const fact = /^\/internal\/tiles\/([a-z]+)\?.*\bview=fact\b/u.exec(req.url ?? "")?.[1];
          const empty = fact !== undefined && emptyFacts.includes(fact);
          const headers: Record<string, string> = {};
          r.headers.forEach((v, k) => { headers[k] = v; });
          const id = /^\/internal\/tiles\/([a-z]+)/u.exec(req.url ?? "")?.[1];
          if (id !== undefined && Object.hasOwn(credits, id)) {
            const over = credits[id];
            if (over === null || over === undefined) delete headers["tile-credits"];
            else headers["tile-credits"] = over;
          }
          delete headers["content-length"];
          delete headers["content-encoding"];
          const body = await r.text();
          res.writeHead(r.status, headers).end(empty ? body.replace(/^(<section class="tile tile--fact) is-(?:ok|stale)"/u, '$1 is-empty"') : body);
        }, () => res.writeHead(502).end());
      });
      await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
      extra.push({ close: () => new Promise<void>((r) => server.close(() => r())) });
      return `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
    },
    async close() {
      await vite.close();
      await digest.close();
      await asks.close();
      for (const s of extra) await s.close();
      set("DIGEST_URL", saved.DIGEST_URL);
      set("MCP_INTERNAL_URL", saved.MCP_INTERNAL_URL);
    },
  };
}

const DAY_MS = 24 * 3_600_000;
/** The digest's own age line (`· vor 13,7 h`, `· 3 min ago`): minutes or hours, the only units a live figure carries. */
const AGE = /(\d+(?:[.,]\d+)?)\s*(min|h)\b/u;

/**
 * Every example on a page — an `[data-example]` region, the try-it's response, a live answer — with the age it
 * states: a `time[datetime]` against `now`, or the digest's age line. An example that states no age, or one the
 * reader cannot read, is reported with `ms: null`; the 24 h rule is judged on the list.
 */
export function exampleAges(html: string, now: Date): readonly { readonly where: string; readonly ms: number | null }[] {
  const out: { where: string; ms: number | null }[] = [];
  const regions: readonly (readonly [string, readonly El[]])[] = [
    ["[data-example]", all(html, "[data-example]")],
    [".try__response", all(html, ".try__response[data-try]")],
    [".qa-answer", all(html, ".qa-answer")],
  ];
  for (const [where, els] of regions) {
    for (const el of els) {
      const times = all(el, "time[datetime]").map((t) => now.getTime() - Date.parse(t.attrs.datetime ?? ""));
      const lines = all(el, ".age__time").map((a) => {
        const m = AGE.exec(text(a));
        return m === null ? Number.NaN : Number(m[1]!.replace(",", ".")) * (m[2] === "h" ? 3_600_000 : 60_000);
      });
      const ages = [...times, ...lines];
      // the try-it's error state is no example: it says that none is held
      if (el.attrs["data-try"] === "error") continue;
      if (ages.length === 0) out.push({ where, ms: null });
      for (const ms of ages) out.push({ where, ms: Number.isNaN(ms) ? null : ms });
    }
  }
  return out;
}

/** The examples older than a day, or whose age cannot be read. */
export const tooOld = (ages: readonly { readonly where: string; readonly ms: number | null }[]): readonly string[] =>
  ages.filter((a) => a.ms === null || a.ms > DAY_MS || a.ms < -5 * 60_000).map((a) => `${a.where}: ${a.ms === null ? "no age" : `${String(Math.round(a.ms / 60_000))} min`}`);
