#!/usr/bin/env bash
# Vercel's "Ignored Build Step" (vercel.json ignoreCommand): exit 0 skips the build, exit 1 builds.
# Vercel keeps every deployment, and each one holds a full copy of the site (about 30 MB, most of it Bunty's art); with
# every push building (466 commits on main in three weeks, plus the same commits on claude/* branches as previews),
# the free 10 GB of deployment storage reached 75% on 14 Oct 2026. So:
#   - only main deploys (other branches are working copies, never served);
#   - a push to main deploys unless every changed file is one the site never uses (docs, tests, the podcast scripts
#     that run on GitHub, the GitHub workflow, design proofs, notes). The daily edition, art and site code always deploy.
# When unsure (no previous deployment to compare with, a git error), it builds.
ref="${VERCEL_GIT_COMMIT_REF:-}"
if [ -n "$ref" ] && [ "$ref" != "main" ]; then echo "ignore: branch $ref is not main, no deployment"; exit 0; fi
prev="${VERCEL_GIT_PREVIOUS_SHA:-}"
[ -z "$prev" ] && { echo "ignore: no previous deployment to compare with, building"; exit 1; }
git cat-file -e "$prev^{commit}" 2>/dev/null || git fetch -q --depth=200 origin main 2>/dev/null
changed="$(git diff --name-only "$prev" HEAD 2>/dev/null)" || { echo "ignore: cannot compare with $prev, building"; exit 1; }
[ -z "$changed" ] && { echo "ignore: nothing changed since the last deployment"; exit 0; }
if echo "$changed" | grep -qvE '^(docs/|tests/|scripts/podcast/|\.github/|design/|[^/]+\.md$|\.gitignore$)'; then
  echo "ignore: site files changed, building"; exit 1
fi
echo "ignore: only docs, tests, podcast scripts or workflow changed, no deployment"; exit 0
