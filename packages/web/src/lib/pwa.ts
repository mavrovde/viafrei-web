/**
 * #1181 feature 7: the installable site — the web manifest and the service worker.
 *
 * The service worker is registered only after a page is starred (`lib/star.ts`), because its cache is device storage.
 * It answers NAVIGATIONS only, network first; a page is kept for the offline view only when it is a plain public page:
 *
 *   - a GET of this origin with no query string (a person's choice is never kept);
 *   - a 200 of type `basic` whose `Cache-Control` says neither `no-store` nor `private` — so the home (`private,
 *     no-store`), every `/fragment/*` answer (POST, and `no-store`) and every person-gated read are never kept;
 *   - neither its `X-Robots-Tag` nor its robots meta says `noarchive` — so no page carrying Tankerkönig prices (the
 *     place pages and the fuel pages are `noarchive`, data terms) is ever kept on a device;
 *   - at most `SW_MAX_PAGES`, the oldest dropped.
 *
 * Offline, a kept page is served with one line after `<main>`: the page's own sentence (`<meta name="vf-offline">`,
 * "Stand {t}, offline") with the time it was kept, on the Berlin clock. No other request is answered.
 */
import { SW_PATH } from "./star.js";

export const SW_CACHE = "vf-pages-1";
export const SW_MAX_PAGES = 20;
export const MANIFEST_PATH = "/manifest.webmanifest";
/** The paths a navigation is never kept for, whatever its headers say. */
export const SW_NEVER = /^\/(?:fragment|internal|_a)\//u;

export function serviceWorkerSource(): string {
  return `"use strict";
const C=${JSON.stringify(SW_CACHE)},MAX=${String(SW_MAX_PAGES)},NEVER=${SW_NEVER.toString()};
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("vf-pages-")&&k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
const keepable=(u,res)=>{if(!res||!res.ok||res.type!=="basic"||u.search!=="")return false;const cc=res.headers.get("cache-control")||"";if(/no-store|private/i.test(cc))return false;if(/noarchive/i.test(res.headers.get("x-robots-tag")||""))return false;return /^text\\/html/i.test(res.headers.get("content-type")||"")};
const put=async(req,res)=>{const body=await res.text();if(/<meta name="robots" content="[^"]*noarchive/i.test(body))return;const h=new Headers(res.headers);h.set("x-vf-at",String(Date.now()));const c=await caches.open(C);await c.put(req,new Response(body,{status:200,headers:h}));const ks=await c.keys();for(let i=0;i<ks.length-MAX;i++)await c.delete(ks[i])};
const offline=async res=>{const body=await res.text(),at=Number(res.headers.get("x-vf-at")),lang=(/<html lang="([a-z]{2})/.exec(body)||[])[1]||"de",say=(/<meta name="vf-offline" content="([^"]*)"/.exec(body)||[])[1]||"offline";
let t="";try{t=new Intl.DateTimeFormat(lang,{timeZone:"Europe/Berlin",hour:"2-digit",minute:"2-digit"}).format(new Date(at))}catch(_){t=""}
const line='<p class="offline" role="status">'+say.replace("{t}",t)+"</p>";const h=new Headers(res.headers);h.set("cache-control","no-store");return new Response(body.replace(/<main[^>]*>/,m=>m+line),{status:200,headers:h})};
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET"||r.mode!=="navigate")return;const u=new URL(r.url);if(u.origin!==self.location.origin||NEVER.test(u.pathname))return;
e.respondWith(fetch(r).then(res=>{if(keepable(u,res))e.waitUntil(put(r,res.clone()).catch(()=>{}));return res}).catch(()=>caches.open(C).then(c=>c.match(r)).then(m=>m?offline(m):Response.error())))});
`;
}

/** The web manifest: the name, the home, the site's colours and its one icon. */
export function manifest(): Record<string, unknown> {
  return {
    name: "ViaFrei",
    short_name: "ViaFrei",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0b5cad",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}

export const SW_HEADERS: Readonly<Record<string, string>> = { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache", "service-worker-allowed": "/" };
export { SW_PATH };
