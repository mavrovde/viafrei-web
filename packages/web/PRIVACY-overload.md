# The overload check: interest balancing

Record under Art. 5(2) GDPR for the overload check of viafrei.de (#1184
phase 2). Source: the data-steward ruling of 2026-11-04, "APPROVED WITH
CONDITIONS P1–P12" (issue #1184, comment 6642945582), and its amendment of
2026-11-13 for the per-client trip (#1205, conditions T1–T8). The ruling is a
privacy and compliance assessment, not legal advice. The owner's
Verzeichnis von Verarbeitungstätigkeiten (Art. 30) gains one entry,
"Überlastschutz", that cites this file (P11).

## What is processed

Only while the digest's person pool is saturated (`/internal/pressure`
answers `saturated`), a request for a page that reads the database
(`DB_PAGE` in `src/overload/challenge.ts`) is served:

- to a verified search engine or AI assistant (class `search`,
  `src/overload/verified-class.ts`), which is never counted;
- to a browser holding a valid pass, which is not counted either;
- to every other client within its share (`src/overload/trip.ts`, #1205):
  at most 4 database pages per client in a window of 10 seconds.

Only a client past its share gets the interim page. With N web replicas a
client may be served about N times the share, because each process counts
alone.

- **The per-client count** (#1205) runs only while the pool is saturated
  (P2). The client is its address as the edge hands it on, an IPv6 address
  by its /64. The address is reduced at once to an HMAC-SHA-256 under a
  32-byte key the process draws at start. The key is never configured,
  written or logged, so a hash links to nothing after a restart and across
  replicas. The address itself is not kept. Each entry is the hash, the
  window's start and a count. The count starts again with every window, so
  no refusal outlives its 10 seconds (P10).

- **The interim page** is a 503 with `no-store` and `X-Robots-Tag: noindex`.
  It is in the page's language, carries the Impressum and Datenschutz links,
  and has no analytics and no consent bar (P6). Its script solves a
  proof-of-work over a server-signed challenge, using `crypto.subtle` only.
  It reads no device property and writes no storage (P4).
- **The pass** is the cookie `__Host-vf_pass`, set as
  `Secure; HttpOnly; SameSite=Lax; Path=/`. It is a browser-session cookie
  with no Domain, Expires or Max-Age. Its value is a version, the issue
  minute, a 128-bit random nonce and an HMAC-SHA-256 (P3), and nothing that
  names a person. It is refused after 12 h. It is set only while the pool is
  saturated (P2). Nothing but the check reads it: not the visitor count, GA,
  Clarity, the MCP ledger or `error_events` (P1).
- **What is held in memory** is the following, bounded, never persisted and
  never logged (P5, P9):
  - spent challenges, until they expire;
  - a per-nonce page count, at most 600 pages per pass;
  - crawler verdicts keyed by address: 24 h verified, 1 h unverified, at
    most 50 000 entries, least recently used first out;
  - the per-client counts, keyed by the hash only: at most 20 000 clients,
    the oldest window first out, all of them forgotten by the first
    request after the overload.
- **The hourly sums** (P9) are the one thing the check writes: once an
  hour, one level-30 line `overload_trip` per outcome (`served`,
  `exempt_verified`, `pass`, `tripped`, `refused:<class[:family]>`) with a
  count. The class is `person`, `crawler` or `seo`; the family comes only
  from our closed crawler lists. No address, hash or User-Agent is in it,
  and no line is written per request (P5). The lines reach the web
  container's stderr. The collector keeps level 40 and up only, so they
  never reach `error_events`. The access log shows an interim page only by
  its status code, as before.
- **Crawlers** are recognised by address, never by User-Agent alone (P7):
  - first by the operator's published range files, fetched at most daily;
  - then, only where the operator documents it, by reverse DNS with a
    forward confirm, through the host's own resolver (P8);
  - only for a User-Agent that claims a listed crawler. A browser causes no
    lookup.

  A failed lookup, or one slower than 500 ms, counts as not verified.
- **No block list and no profile** are kept (P10).

## Interest balancing (Art. 6 Abs. 1 lit. f)

The ruling names the points of this balancing (P11). The owner's Art. 30
entry restates them.

1. *Legitimate interest:* the service's availability to the people who use
   it.
2. *Necessity:* the measured 503s. A distributed scraper's cold reads held
   the person pool, and real visitors' cards missed the 2 s deadline (#1184).
   Phase 1 bounds the cold reads. A client that will not run the page's
   script, or will not spend the work per pass, is what still fills the pool.
3. *Balancing:*
   - The check is invisible and needs no interaction.
   - It runs only under overload.
   - Under overload only the client past its own share sees the interim
     page; everyone else is served as always (#1205). Before #1205 four
     parallel reads of one client put the page in front of every visitor.
   - The count holds a keyed hash under a key that dies with the process,
     for 10 seconds per window, in memory only.
   - No third party is involved: the check is self-hosted and uses the
     host's resolver.
   - The pass lasts 12 h at most.
   - There is no profile and no block list.
   - Nothing is persisted or logged.

## Datenschutzerklärung

Section 3, "Schutz vor Überlastung" (`#ueberlastschutz`), comes after
`#speicherdauer-website`. Section 5 now names the two cookies. Both ship in
the same change as the mechanism (P12), and both are pinned by
`test/overload.test.ts`.

The per-client count is described in the paragraph's first part and in
the paragraph on the hourly sums (#1205, 2026-11-13). Its figures are
pinned to `TRIP_WINDOW_MS`, `TRIP_LIMIT` and `TRIP_MAX_CLIENTS` by the
same test.

### English rendering of the #1205 sentences (the German text is binding)

> Only during that time do we count how many such pages one connection
> requests in a window of 10 seconds. To do so, our server derives a check
> value (HMAC-SHA-256) from the request's IP address (for IPv6, its first
> 64 bits) with a secret key. It draws the key anew at every start and
> stores it nowhere. It does not keep the address itself for this. The
> check value and the count are held in memory only, for at most 20 000
> connections at a time. They are not stored or logged and are discarded
> with the first request after the overload ends. A connection that
> requests no more than 4 such pages in 10 seconds gets them as always. A
> connection that requests more may first receive a short interim page.
> With a valid cookie you get the pages without the interim page, and
> your requests are not counted. Verified search engines and AI
> assistants are not counted and never get the interim page.
>
> For operations, the web application writes only totals to its container
> log once an hour: how many of these pages were served and how many
> interim pages were shown, split only by the kind of request (visitor,
> crawler, SEO tool) and, where applicable, the crawler's name. These
> totals contain no IP address, no check value and no browser identifier,
> and they do not enter the error table. Beyond that the check logs no
> single request; the website's access log shows an interim page, like
> every answer, only by its status code.
