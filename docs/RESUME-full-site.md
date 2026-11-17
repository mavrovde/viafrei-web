# Resume: the full site on viafrei-api (WIP)

Branch feat/full-site-on-api. Work paused on request; this note says where it stands.

Done:
- Milestone 1 (a12181e): the shell and the design copy equal viafrei-app 2.6.23, and the release carries the site
  files of earlier images (web#36: scripts/carry-previous.sh, the carry pin in images.pin, release.yml, Dockerfile).
  Affected unit tests green: 216 files passed, 1 skipped.
- WIP (this commit): packages/web/src/api/client.ts, a server-side viafrei-api client. VIAFREI_API_URL is in
  lib/env.ts; VIAFREI_API_KEY is read only inside the client, as a Bearer header. The overload pressure reads
  /v1/pressure when VIAFREI_API_URL is set. Tests: test/api-client.test.ts (7), tsc -b and eslint are clean.

Next:
1. (done)
2. Gap inventory. Map every digest service method (packages/digest/src/server: Place, Motorway, ExitWalker,
   Station, Road, State, EnergyPage, Spot, SiteSearch, FilteredCharging) to an API 0.3.0 endpoint and field.
   Read first: map layers, tiles, search and suggest, news traffic, SID occupancy, exits, segments and speed
   corridors, slug resolution, station top lists, site sources.
3. Port the fragment renderers, without status or console (owner correction). Feed them from the API.
4. Write the parity harness: app 2.6.23 digest vs web-on-API, over a DB at schema 0315. Swap the images.pin digest
   for an api pin.
5. Update the docs, the README, the repo description, and open the draft PR (milestone v2.7.0, assignee mavrovde).
