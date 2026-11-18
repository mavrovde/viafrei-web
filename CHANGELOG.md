# Changelog

## [0.2.1](https://github.com/mavrovde/viafrei-web/compare/v0.2.0...v0.2.1) (2026-11-18)


### Fixed

* **web:** the road and the home with a place fit eight desktop screens again at 1280x800 ([#43](https://github.com/mavrovde/viafrei-web/issues/43)) ([fbc2593](https://github.com/mavrovde/viafrei-web/commit/fbc25937baf5f9c5081da6de41eb4089db2e1162))

## [0.2.0](https://github.com/mavrovde/viafrei-web/compare/v0.1.1...v0.2.0) (2026-11-18)


0.2.0 was tagged, but its image was never published: the release's browser suite failed the eight-desktop-screens rule on the road page and the home with a place at 1280×800 (fixed in 0.2.1). 0.2.1 is the first published 0.2 release.


### Added

* the full site and every HTML fragment, rendered here from viafrei-api (no digest, no database) ([#37](https://github.com/mavrovde/viafrei-web/issues/37)) ([1371f1a](https://github.com/mavrovde/viafrei-web/commit/1371f1a36f7773cd4931ec0bf38e9f5e86dc6046))


### Fixed

* **web:** every recorded example re-asked of production on 2026-11-18 ([edc465b](https://github.com/mavrovde/viafrei-web/commit/edc465b6e39072bc9738fa03a63e688036ea9752))


### Build and CI

* the mutation check runs in 4 parallel shards ([#38](https://github.com/mavrovde/viafrei-web/issues/38)) ([2048a12](https://github.com/mavrovde/viafrei-web/commit/2048a12c015ad25cab479018ff78d570e6193896))

## [0.1.1](https://github.com/mavrovde/viafrei-web/compare/v0.1.0...v0.1.1) (2026-11-16)


### Fixed

* **release:** the image's build stage runs natively, never under emulation ([#30](https://github.com/mavrovde/viafrei-web/issues/30)) ([565b6fc](https://github.com/mavrovde/viafrei-web/commit/565b6fcd26fbbc764f80f60fd3a5f399cf02320a))

## 0.1.0 (2026-11-16)

0.1.0 was tagged, but its image was never published: the publish job was cancelled at its time limit while it built linux/arm64 under emulation (fixed in 0.1.1). 0.1.1 is the first published release.


### Added

* one image carries the shell, the edge's fallback and preview pages, the route map and the GeoIP builder ([a1bc25f](https://github.com/mavrovde/viafrei-web/commit/a1bc25f875949080f47b9db45a6622df7c5e7d57))
* the site shell and the design package, moved here from the main repository ([a1bc25f](https://github.com/mavrovde/viafrei-web/commit/a1bc25f875949080f47b9db45a6622df7c5e7d57))
* **web:** compact desktop layout: the star under the sticky map, each line's lamp beside its status line, tighter station blocks ([a1bc25f](https://github.com/mavrovde/viafrei-web/commit/a1bc25f875949080f47b9db45a6622df7c5e7d57))


### Fixed

* **gates:** the boundary and static-pages gates judge this repository's code only; the visual comparison runs in the amd64 container ([a1bc25f](https://github.com/mavrovde/viafrei-web/commit/a1bc25f875949080f47b9db45a6622df7c5e7d57))
* **security:** gitleaks with a narrow test-literal exception; the CodeQL findings in runtime code and scripts fixed at their root ([a1bc25f](https://github.com/mavrovde/viafrei-web/commit/a1bc25f875949080f47b9db45a6622df7c5e7d57))


### Dependencies

* Bump node from 26.12.1-alpine3.24 to 26.13.0-alpine3.24 ([#17](https://github.com/mavrovde/viafrei-web/issues/17)) ([db051d8](https://github.com/mavrovde/viafrei-web/commit/db051d897db5dc2be00755b9f7d99280b228d3df))
* Bump postgis/postgis from 16-3.4 to 16-3.6 ([#25](https://github.com/mavrovde/viafrei-web/issues/25)) ([02d552b](https://github.com/mavrovde/viafrei-web/commit/02d552b86a671dd1c67e33ed46864b7a51734a2a))
* Bump the dev-tooling group with 12 updates ([#20](https://github.com/mavrovde/viafrei-web/issues/20)) ([e4d9809](https://github.com/mavrovde/viafrei-web/commit/e4d9809a6b1446d27c500d820336e710ec5c4c0f))


### Documentation

* a public README, architecture and development guides, security and contributing ([a1bc25f](https://github.com/mavrovde/viafrei-web/commit/a1bc25f875949080f47b9db45a6622df7c5e7d57))
* the README links no private repository (owner 2026-11-15) ([#16](https://github.com/mavrovde/viafrei-web/issues/16)) ([bb588e2](https://github.com/mavrovde/viafrei-web/commit/bb588e2121436979e474bda2abc9e71bd9903627))


### Build and CI

* a Changes job as a required check; heavy steps only at a minor; no schedules ([a1bc25f](https://github.com/mavrovde/viafrei-web/commit/a1bc25f875949080f47b9db45a6622df7c5e7d57))
* Bump SonarSource/sonarqube-scan-action from 8.4.0 to 8.4.1 ([#19](https://github.com/mavrovde/viafrei-web/issues/19)) ([e6c63a9](https://github.com/mavrovde/viafrei-web/commit/e6c63a90a342e6536cb906f51f0caeab8c47048c))
* CI, Security, Scorecard, release-please and a signed multi-arch image release ([a1bc25f](https://github.com/mavrovde/viafrei-web/commit/a1bc25f875949080f47b9db45a6622df7c5e7d57))
* Dependabot proposes no PostgreSQL major for the stack's database ([#22](https://github.com/mavrovde/viafrei-web/issues/22)) ([a0989a9](https://github.com/mavrovde/viafrei-web/commit/a0989a97a20cb297a0377147eb6742f5be16aff3))
* pin Snyk's sole caller, no continue-on-error, and the own-commit SARIF upload ([#26](https://github.com/mavrovde/viafrei-web/issues/26)) ([2ea398c](https://github.com/mavrovde/viafrei-web/commit/2ea398c2bec2cdbb9f88695e73f7567f730c7681))
* **release:** the first release pull request opens from manifest 0.0.0, as 0.1.0 ([#21](https://github.com/mavrovde/viafrei-web/issues/21)) ([80b1b40](https://github.com/mavrovde/viafrei-web/commit/80b1b4039e4e740ad21d0e982254758b6f299b93))
* the browser suite and Snyk run once per release, before publish; Snyk also weekly on main ([#24](https://github.com/mavrovde/viafrei-web/issues/24)) ([e6bc2a5](https://github.com/mavrovde/viafrei-web/commit/e6bc2a50e28498a48f0f4348e4a0ae1746899f38))
* the site stands alone, with its own workspace root and the released viafrei-app and viafrei-database as its only dependencies ([a1bc25f](https://github.com/mavrovde/viafrei-web/commit/a1bc25f875949080f47b9db45a6622df7c5e7d57))
* the stack runs the shell against the pinned releases, and the image is smoked as shipped ([a1bc25f](https://github.com/mavrovde/viafrei-web/commit/a1bc25f875949080f47b9db45a6622df7c5e7d57))

## Changelog

All notable changes to this project are written here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) for the site shell
image (`package.json`).

Each section is written by release-please from the Conventional Commits on
`main`, in the release pull request; a released section is not edited by
hand. The shell's history before this repository is viafrei's `CHANGELOG.md`
up to 2.6.18 (`docs/moved-from-viafrei.md`).
