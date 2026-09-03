#!/usr/bin/env bash
# Pull, build, restart — in that order, and stop at the first failure.
#
# systemd's Restart= handles a process that dies. It does not know the code
# changed: after a `git pull` the running process keeps serving the bundle it
# started with. This is the explicit step that closes that gap.
#
# A systemd .path unit watching dist/ would restart automatically and was not
# used: a build writes many files over several seconds, so the watcher can fire
# midway and restart the service against a half-written tree. Restarting last,
# once, after the build has succeeded, is the property that matters.
#
# CONFIGURATION lives in `deploy.env` beside this script, which is not tracked —
# every deployment has different paths, and a committed file with one host's
# paths in it is a file everyone else has to remember not to use. Copy the block
# below into `deploy.env` and edit, or export the same names.
#
#     APP_DIR=/srv/relay-ui
#     UNIT=relay-ui
#     PE_STORE_ROOT=/srv/p-e/relay
#     HEALTH_URL=http://127.0.0.1:3777/api/relay/status
#
# HEALTH_URL is worth checking against the unit rather than assuming: a service
# with HOST set to something other than 127.0.0.1 does not answer there, and the
# health check would fail on a deployment that is working.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$HERE/deploy.env" ]]; then
  # shellcheck disable=SC1091
  set -a; . "$HERE/deploy.env"; set +a
fi

APP_DIR="${APP_DIR:-/srv/relay-ui}"
UNIT="${UNIT:-relay-ui}"
PE_STORE_ROOT="${PE_STORE_ROOT:-/srv/p-e/relay}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3777/api/relay/status}"

cd "$APP_DIR"

before="$(git rev-parse --short HEAD)"

echo "==> git pull"
# Fails loudly on a branch with no upstream rather than guessing which remote
# branch a deployment tracks. set -e stops here, before anything is built.
git pull --ff-only

echo "==> install"
npm install --no-audit --no-fund

echo "==> typecheck"
npm run lint

echo "==> build"
npm run build

# Read-only backend, so this is safe to run against the live corpus. It ends by
# asserting the corpus has as many records after as before.
echo "==> store checks"
PE_STORE_ROOT="$PE_STORE_ROOT" npm run check:pe-store

echo "==> restart"
systemctl --user restart "$UNIT"
sleep 2
systemctl --user is-active --quiet "$UNIT" || { systemctl --user status "$UNIT" --no-pager -n 20; exit 1; }

echo "==> serving"
curl -fsS -m 5 -o /dev/null -w "    api %{http_code}\n" "$HEALTH_URL"

after="$(git rev-parse --short HEAD)"
if [[ "$before" == "$after" ]]; then
  # Not an error. A rebuild of the same commit is how you recover a process that
  # is serving a stale bundle, which is the failure this script exists for.
  echo "    commit $after (unchanged; rebuilt and restarted)"
else
  echo "    commit $before -> $after"
fi
