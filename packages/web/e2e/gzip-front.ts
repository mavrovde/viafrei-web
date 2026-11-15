/**
 * The production edge's compression, in front of the BUILT shell, for the gates that measure a transfer.
 *
 * In production every page reaches a visitor through `the edge configuration`, which gzips (2.3.13): `gzip_comp_level 5`,
 * `gzip_min_length 1024`, text/html by default plus `gzip_types`, `gzip_vary on`. The shell itself compresses nothing,
 * so a Lighthouse run against it alone measured ~270 KB of HTML on /de/connect where a visitor receives ~37 KB, and its
 * simulated slow-4G paint times described a transfer nobody makes (the page budget's own lesson, 2.3.13). This front
 * applies the same rule, and only that rule: `GZIP_TYPES` is the conf's list with text/html, held equal to it by
 * `test/gzip-front.test.ts`.
 */
import { createServer, request, type IncomingHttpHeaders, type Server } from "node:http";
import { gzipSync } from "node:zlib";

/** text/html (nginx's default) and the conf's `gzip_types`, in its order. */
export const GZIP_TYPES = [
  "text/html",
  "text/css",
  "text/plain",
  "text/xml",
  "application/javascript",
  "application/json",
  "application/xml",
  "application/atom+xml",
  "application/rss+xml",
  "image/svg+xml",
] as const;
export const GZIP_MIN_LENGTH = 1024;
export const GZIP_LEVEL = 5;

/** Would the edge compress this answer for this request? */
export function compresses(reqHeaders: IncomingHttpHeaders, resHeaders: IncomingHttpHeaders, length: number): boolean {
  if (!/\bgzip\b/i.test(String(reqHeaders["accept-encoding"] ?? ""))) return false;
  if (resHeaders["content-encoding"]) return false;
  const type = String(resHeaders["content-type"] ?? "").split(";")[0]!.trim().toLowerCase();
  return (GZIP_TYPES as readonly string[]).includes(type) && length >= GZIP_MIN_LENGTH;
}

/** Listen on `port` (loopback) and pass every request to the shell on `upstream`, compressed as the edge would. */
export function startGzipFront(port: number, upstream: number): Promise<Server> {
  const server = createServer((req, res) => {
    const up = request({ host: "127.0.0.1", port: upstream, method: req.method, path: req.url, headers: req.headers }, (u) => {
      const chunks: Buffer[] = [];
      u.on("data", (c: Buffer) => chunks.push(c));
      u.on("end", () => {
        let body = Buffer.concat(chunks);
        const headers = { ...u.headers };
        if (compresses(req.headers, u.headers, body.length)) {
          body = gzipSync(body, { level: GZIP_LEVEL });
          headers["content-encoding"] = "gzip";
          headers["vary"] = headers["vary"] ? `${String(headers["vary"])}, Accept-Encoding` : "Accept-Encoding";
        }
        delete headers["transfer-encoding"];
        headers["content-length"] = String(body.length);
        res.writeHead(u.statusCode ?? 502, headers);
        res.end(body);
      });
    });
    up.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(up);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}
