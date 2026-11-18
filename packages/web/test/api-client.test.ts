import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getOperations, render } from "../scripts/api-contract.js";
import { API_CONTRACT, API_GET_OPERATIONS, API_KEY_ENV, API_MAX_TIMEOUT_MS, apiHeaders, apiUrlOf, createApiClient, type ApiFetch, type ApiGetPath } from "../src/api/client.js";
import { readEnv } from "../src/lib/env.js";
import { API_PRESSURE_PATH, apiPressureWord, createPressure, PRESSURE_ROUTE } from "../src/overload/pressure.js";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const walk = (dir: string, out: string[] = []): string[] => {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};
const json = (status: number, body: unknown, type = "application/json"): ReturnType<ApiFetch> =>
  Promise.resolve({ status, headers: { get: (n: string) => (n === "content-type" ? type : null) }, json: () => Promise.resolve(body) });

describe("the viafrei-api client (server side, the key kept inside)", () => {
  it("sends the key as a Bearer header only when one is set", () => {
    expect(apiHeaders({})).toEqual({ accept: "application/json" });
    expect(apiHeaders({ [API_KEY_ENV]: "  " })).toEqual({ accept: "application/json" });
    expect(apiHeaders({ [API_KEY_ENV]: "k1" })["authorization"]).toBe("Bearer k1");
  });

  it("builds the contract's URLs only, skipping undefined query values", () => {
    expect(apiUrlOf("http://api:8080", "/v1/motorways", { road: "A1", limit: 5, state: undefined })).toBe("http://api:8080/v1/motorways?road=A1&limit=5");
    expect(() => apiUrlOf("http://api:8080", "/internal/pressure" as ApiGetPath)).toThrow(/not a GET operation of the contract/);
  });

  it("fills the path parameters, and refuses a missing one or a parameter the operation does not take", () => {
    expect(apiUrlOf("http://api", "/v1/stations/{stationId}/departures", { stationId: "de:1 2/3", limit: 3 })).toBe("http://api/v1/stations/de%3A1%202%2F3/departures?limit=3");
    expect(() => apiUrlOf("http://api", "/v1/stations/{stationId}/departures", { limit: 3 })).toThrow(/needs its path parameter stationId/);
    expect(() => apiUrlOf("http://api", "/v1/motorways", { nope: 1 } as never)).toThrow(/takes no parameter nope/);
    expect(() => apiUrlOf("http://api", "/v1/motorways", { lang: "en" } as never)).toThrow(/takes no parameter lang/);
  });

  it("sends the language as the contract's lang query parameter, only to an operation that takes it", () => {
    expect(apiUrlOf("http://api", "/v1/motorways", { road: "A1" }, "en")).toBe("http://api/v1/motorways?road=A1&lang=en");
    expect(apiUrlOf("http://api", "/v1/pressure", {}, "en")).toBe("http://api/v1/pressure");
  });

  it("is generated from the viafrei-api release images.pin pins", () => {
    const pin = /^api ghcr\.io\/mavrovde\/viafrei-api:(\d+\.\d+\.\d+)@sha256:[0-9a-f]{64}$/mu.exec(readFileSync(fileURLToPath(new URL("../../../images.pin", import.meta.url)), "utf8"));
    expect(pin?.[1]).toBe(API_CONTRACT.version);
    expect(API_CONTRACT.contractSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(API_GET_OPERATIONS[API_PRESSURE_PATH].operationId).toBe("getPressure");
  });

  it("answers the envelope on a 2xx JSON answer and null on anything else, capping the deadline", async () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const ok = createApiClient({ baseUrl: "http://api", env: { [API_KEY_ENV]: "k" }, fetchImpl: (url, init) => (seen.push({ url, headers: init.headers }), json(200, { data: { state: "ok" } })) });
    expect(await ok.get("/v1/pressure", {}, { timeoutMs: 60_000 })).toEqual({ data: { state: "ok" } });
    expect(seen[0]).toEqual({ url: "http://api/v1/pressure", headers: { accept: "application/json", authorization: "Bearer k" } });
    expect(API_MAX_TIMEOUT_MS).toBe(2_000);
    for (const f of [() => json(500, { data: 1 }), () => json(200, { data: 1 }, "text/html"), () => json(200, { nope: 1 }), () => json(200, null), () => Promise.reject(new Error("down"))] as (() => ReturnType<ApiFetch>)[]) {
      expect(await createApiClient({ baseUrl: "http://api", env: {}, fetchImpl: f }).get("/v1/meta")).toBeNull();
    }
  });

  it("reads VIAFREI_API_URL as an origin, and the key is never a WebEnv field", () => {
    expect(readEnv({}).apiUrl).toBeUndefined();
    const e = readEnv({ VIAFREI_API_URL: "http://api:8080", [API_KEY_ENV]: "secret-value" });
    expect(e.apiUrl).toBe("http://api:8080");
    expect(JSON.stringify(e)).not.toContain("secret-value");
    expect(() => readEnv({ VIAFREI_API_URL: "http://api:8080/v1" })).toThrow(/VIAFREI_API_URL must be an origin/);
  });

  it("is imported by no island and no browser module", () => {
    const offenders = walk(SRC)
      .filter((f) => /\.(svelte|astro|ts|js)$/.test(f) && !f.includes(`${join("src", "api")}`))
      .filter((f) => /from\s+["'][^"']*\/api\/client(\.js)?["']/.test(readFileSync(f, "utf8")))
      .filter((f) => f.endsWith(".svelte") || f.includes(`${join("src", "islands")}`) || f.includes(`${join("src", "client")}`));
    expect(offenders).toEqual([]);
  });
});

describe("the contract generator (scripts/api-contract.ts)", () => {
  const doc = {
    paths: {
      "/healthz": { get: { operationId: "getHealth" } },
      "/v1/stations/{stationId}/departures": {
        parameters: [{ name: "stationId", in: "path" }],
        get: { operationId: "listStationDepartures", parameters: [{ name: "limit", in: "query" }, { name: "lang", in: "query" }, { name: "x-trace", in: "header" }] },
      },
      "/v1/refreshes": { post: { operationId: "createRefresh" } },
      "/v1/meta": { get: { operationId: "getMeta" } },
    },
  };
  it("lists every /v1/ GET operation with its path and query parameters, in path order", () => {
    expect(getOperations(doc)).toEqual({
      "/v1/meta": { operationId: "getMeta", path: [], query: [] },
      "/v1/stations/{stationId}/departures": { operationId: "listStationDepartures", path: ["stationId"], query: ["limit", "lang"] },
    });
    expect(getOperations({})).toEqual({});
    expect(() => getOperations({ paths: { "/v1/x": { get: {} } } })).toThrow(/has no operationId/);
  });
  it("renders a module that names the release and the contract's hash", () => {
    const out = render(getOperations(doc), "9.9.9", "f".repeat(64));
    expect(out).toContain(`from viafrei-api v9.9.9 api/openapi.json (sha256 ${"f".repeat(64)})`);
    expect(out).toContain('"/v1/meta": { operationId: "getMeta", path: [], query: [] },');
    expect(out).toContain("export type ApiGetPath = keyof typeof API_GET_OPERATIONS;");
  });
});

describe("the pressure word from viafrei-api (the web→API switch)", () => {
  it("asks /v1/pressure and is saturated only on data.state saturated", async () => {
    const urls: string[] = [];
    const answer = (body: string) => createPressure({ baseUrl: "http://api", api: true, fetchImpl: (url) => (urls.push(url), Promise.resolve({ status: 200, text: () => Promise.resolve(body) })) });
    expect(await answer(JSON.stringify({ data: { state: "saturated" } })).saturated()).toBe(true);
    expect(urls).toEqual([`http://api${API_PRESSURE_PATH}`]);
    expect(await answer(JSON.stringify({ data: { state: "ok" } })).saturated()).toBe(false);
    expect(await answer("saturated").saturated()).toBe(false);
    expect(await answer("{").saturated()).toBe(false);
    expect(apiPressureWord({ data: null })).toBe(false);
    expect(apiPressureWord("saturated")).toBe(false);
  });

  it("still asks the digest's route without api", async () => {
    const urls: string[] = [];
    await createPressure({ baseUrl: "http://digest", fetchImpl: (url) => (urls.push(url), Promise.resolve({ status: 200, text: () => Promise.resolve("ok") })) }).saturated();
    expect(urls).toEqual([`http://digest${PRESSURE_ROUTE}`]);
  });
});
