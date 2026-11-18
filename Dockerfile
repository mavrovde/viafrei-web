# viafrei-web: the viafrei.de site shell (Astro SSR, node standalone adapter) and the files the edge
# serves without it, in one small image (viafrei-web#2).
#
#   docker run -p 8792:8792 -e DIGEST_URL=http://digest:8791 IMAGE
#
#   /app/packages/web/dist/server/entry.mjs     the shell, port 8792; the bundle is self-contained
#                                               (vite.ssr.noExternal), so no node_modules ship
#   /srv/site-static/fallback/index.html        the nginx error_page fallback (#405)
#   /srv/site-static/preview/index.html         the owner preview's page
#   /srv/site-static/site-pages.txt             the public route map (packages/web/scripts/site-map.ts)
#   /app/scripts/geoip-build.mjs                the VFGEO1 builder; viafrei-infra's monthly job runs it,
#                                               writing to a mounted directory (the root is read-only):
#                                               gunzip -c dbip-city-lite-YYYY-MM.csv.gz | docker run --rm -i \
#                                                 --network none -v DIR:/out IMAGE node /app/scripts/geoip-build.mjs \
#                                                 --release YYYY-MM --out /out/geoip.vfgeo
#
# The shell's path and command are the ones viafrei-app's image used (/app, the same entry), so a
# Deployment moves from that image to this one by its image line. The base is the Node viafrei-app
# 2.6.17/2.6.18 runs, named literally and pinned by digest in both stages so Dependabot proposes
# the update. Runs as uid 10001 on a read-only root file system: it writes nothing.

# --- the earlier releases' /_a/ files (viafrei-web#36) ---------------------------------------------
# Every build names the site's browser files by content hash. A deploy used to drop the previous
# build's names, and search renderers replaying stored HTML got 404s for them (210 Googlebot requests
# a day). So the build stage copies earlier images' packages/web/dist into the new one's _a/ for 14
# days (packages/web/scripts/carry-assets.ts).
#
# This stage is the DEFAULT and holds one file, NO-PREVIOUS-RELEASE: compose and CI builds carry
# nothing, and their image's carried-assets.json says so ("previous": null). A release build replaces
# the stage with a local directory holding each earlier image's dist under its digest's hex
# (scripts/carry-previous.sh, run by release.yml), passing
#   --build-context web-assets-previous=<that directory>
#   --build-arg WEB_ASSETS_PREVIOUS="<image>@sha256:… …"
# (a named build context replaces the stage of the same name). carry-assets.ts fails the build when the
# two disagree, so a named image that did not arrive is never a silent "nothing to carry".
FROM --platform=$BUILDPLATFORM node:26.13.0-alpine3.24@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS web-assets-previous
RUN mkdir -p /app/packages/web/dist && touch /app/packages/web/dist/NO-PREVIOUS-RELEASE

# The build stage runs on the BUILD platform, never under emulation: it ships only dist/ (JavaScript
# and assets, the same bytes on every architecture; npm ci runs with --ignore-scripts, so no native
# module is built). Under QEMU the linux/arm64 build ran past release.yml's 40-minute publish limit
# (v0.1.0's first run, cancelled 2026-11-16).
FROM --platform=$BUILDPLATFORM node:26.13.0-alpine3.24@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS build
WORKDIR /src
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 ASTRO_TELEMETRY_DISABLED=1
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/web/package.json packages/web/
COPY packages/design/package.json packages/design/
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY packages/design packages/design
COPY packages/web packages/web
COPY scripts/site-pages.txt scripts/geoip-build.mjs scripts/
RUN npm run build -w @viafrei/web \
 && test -f packages/web/dist/server/entry.mjs
# The carry (viafrei-web#36, the stage above): after the site's own build, so a changed
# WEB_ASSETS_PREVIOUS re-runs only these steps. Plain node runs the .ts file (type stripping).
ARG WEB_ASSETS_PREVIOUS=""
COPY --from=web-assets-previous /app/packages/web/dist /tmp/web-assets-previous
RUN node packages/web/scripts/carry-assets.ts /tmp/web-assets-previous packages/web/dist "$WEB_ASSETS_PREVIOUS" \
 && rm -rf /tmp/web-assets-previous

FROM node:26.13.0-alpine3.24@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216
# tini forwards SIGTERM and reaps. npm and npx are removed: the shell never runs them, and npm's own
# bundled dependencies are what an image scan reports (viafrei-database's measurement).
RUN apk add --no-cache tini=0.19.0-r3 \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
 && addgroup -g 10001 -S viafrei && adduser -u 10001 -S -G viafrei -H -h /tmp viafrei
WORKDIR /app
COPY --from=build /src/packages/web/dist ./packages/web/dist
COPY --from=build /src/packages/web/package.json ./packages/web/package.json
COPY --from=build /src/scripts/geoip-build.mjs ./scripts/geoip-build.mjs
COPY packages/web/static/fallback/index.html /srv/site-static/fallback/index.html
COPY packages/web/static/preview/index.html /srv/site-static/preview/index.html
COPY scripts/site-pages.txt /srv/site-static/site-pages.txt
ARG VERSION=dev
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.title="viafrei-web" \
      org.opencontainers.image.description="The viafrei.de site shell, its edge fallback and preview pages, the route map and the GeoIP builder" \
      org.opencontainers.image.licenses="UNLICENSED" \
      org.opencontainers.image.source="https://github.com/mavrovde/viafrei-web" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}"
# APP_VERSION is NOT set here: the developers page and the structured data show the version the HOST
# reports (the MCP server's release), and the deployment sets it, as it did for viafrei-app.
ENV NODE_ENV=production HOME=/tmp HOST=0.0.0.0 PORT=8792 ASTRO_TELEMETRY_DISABLED=1
USER 10001:10001
EXPOSE 8792
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8792/healthz"]
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--conditions=viafrei-dist", "packages/web/dist/server/entry.mjs"]
