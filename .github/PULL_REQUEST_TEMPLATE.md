## What this changes, and why
<!-- Closes #N. What a visitor of viafrei.de sees differently, or "nothing" for tooling. -->

## Checklist
- [ ] One logical change; Conventional Commit messages (release-please writes the CHANGELOG from them).
- [ ] No key, token, hostname, IP, internal name or real usage figure in the diff, a fixture, a
      screenshot or a log line.
- [ ] Every page, string and route is in all seven languages (the parity sweep), and a new route is
      in `scripts/site-pages.txt` (`npm run web:site-map`).
- [ ] The site reads no database (`scripts/check_web_boundary.sh`); a new digest fragment needs a
      released viafrei-app first, pinned in `images.pin`.
- [ ] A visual change: Linux baselines re-recorded in the Playwright container and looked at, image by image.

## Evidence
<!-- What you ran and what it printed (the last lines). -->

## Review
A maintainer posts one verdict comment:

```
APPROVE            (or REQUEST CHANGES, with the findings below it)
HEAD: <full sha of the reviewed head>
```

A new push needs a new verdict.
