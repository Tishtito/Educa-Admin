#!/usr/bin/env bash
#
# Educa Admin release. Runs as tito on the Codepasstech VPS, no sudo.
#
# stdin is a gzipped tar of the built dist/, streamed by GitHub Actions:
#     tar -czf - -C dist . | ssh -i <key> tito@<host>
#
# Installed as /home/tito/bin/educa-admin-deploy and pinned as the forced command on
# that repo's CI SSH key. Deliberately a COPY of deploy/deploy.sh, not a
# symlink into a checkout: a forced command must not be rewritable by anyone
# who can push, or the restriction is worth nothing. Re-install by hand when
# this file changes:
#
#     install -m 0755 deploy/deploy.sh /home/tito/bin/educa-admin-deploy
#
set -euo pipefail

APP=/home/tito/educa-admin
URL=https://admin.educa.codepasstech.top
KEEP=3

TS=$(date +%Y%m%d%H%M%S)
REL="$APP/releases/$TS"
PREV=$(readlink -f "$APP/current" 2>/dev/null || true)

mkdir -p "$REL"

# Remove the half-made release on ANY failure. Without this, a payload that
# makes tar itself exit non-zero aborts the script under `set -e` before any
# inline cleanup, leaving an orphan directory NEWER than the live release -
# which the prune below would then happily keep while deleting a good one.
ok=0
cleanup() {
    [ "$ok" = 1 ] && return 0
    [ -d "$REL" ] && rm -rf "$REL"
    [ -n "$PREV" ] && ln -sfn "$PREV" "$APP/current"
    return 0
}
trap cleanup EXIT

# GNU tar strips a leading / and refuses '..' members, so the payload cannot
# escape this directory.
tar -xzf - -C "$REL" --no-same-owner --no-same-permissions

# Refuse to publish something that is not a real build.
if [ ! -s "$REL/index.html" ] || [ ! -d "$REL/assets" ]; then
    rm -rf "$REL"
    echo "FAILED: payload has no index.html or assets/"
    exit 1
fi

chmod -R o+rX "$REL"
ln -sfn "$REL" "$APP/current"   # atomic: nobody is served a half-uploaded release

sleep 2
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$URL")
if [ "$code" != "200" ]; then
    # Put the previous release back rather than leaving the site broken.
    if [ -n "$PREV" ]; then
        ln -sfn "$PREV" "$APP/current"
        echo "FAILED: $URL returned $code - rolled back to $(basename "$PREV")"
    else
        echo "FAILED: $URL returned $code - no previous release to roll back to"
    fi
    exit 1
fi

ok=1
# Never delete what `current` points at, whatever the timestamps say.
CUR=$(basename "$(readlink -f "$APP/current")")
cd "$APP/releases" && ls -1t | tail -n +$((KEEP + 1)) | grep -vx "$CUR" | xargs -r rm -rf
echo "Deployed $TS ($URL -> 200)"
