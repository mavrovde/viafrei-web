/** Boot the BUILT shell (`dist/server/entry.mjs`) on a loopback port with the given environment; refuse when there is no build. */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");
/** The built entry; `WEB_E2E_ENTRY` points the suites at a build made elsewhere (a scratch outDir), and nothing else sets it. */
export const ENTRY = process.env["WEB_E2E_ENTRY"] ?? join(PKG, "dist", "server", "entry.mjs");

export async function startShell(port: number, env: Readonly<Record<string, string>>): Promise<ChildProcess> {
  if (!existsSync(ENTRY)) throw new Error(`${ENTRY} is missing — run \`npm run web:build\` first; this suite refuses to pass on nothing`);
  // A server already on the port answers /healthz for us while our own child dies of EADDRINUSE: on
  // 2026-10-16 an orphaned shell from an earlier run, built before the stylesheet's hash changed, served the
  // Lighthouse gate pages with no CSS and the gate reported a11y 91 about a build it never loaded. Refuse.
  if (await answers(port)) throw new Error(`port ${port} is already in use by another process — stop it first; this suite will not judge a server it did not start`);
  const child = spawn(process.execPath, [ENTRY], {
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), ASTRO_NODE_LOGGING: "disabled", GOOGLE_TAG: "", CLARITY_PROJECT_ID: "", CLARITY_ENABLED: "", ...env },
    stdio: "ignore",
  });
  const until = Date.now() + 10_000;
  while (Date.now() < until) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/healthz`);
      // Answered — and by OUR child, which is still running (a child that exited could not have).
      if (r.ok && child.exitCode === null && child.signalCode === null) return child;
      if (child.exitCode !== null || child.signalCode !== null) break;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error(`the web server did not answer on ${port} within 10 s (exit ${String(child.exitCode)})`);
}

/** Does anything answer HTTP on the port already? */
async function answers(port: number): Promise<boolean> {
  try {
    await fetch(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(1_000) });
    return true;
  } catch {
    return false;
  }
}
