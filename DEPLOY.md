# Deploying Educa Admin

Production is **https://admin.educa.codepasstech.top**, a static build of this
repo served by nginx on the Codepasstech VPS. There is no server process: `npm
run build` produces a folder of files, and nginx serves it.

This covers the routine deploy after work lands on `dev`. First-time server
set-up is at the bottom, for reference only.

| | |
|---|---|
| Host | `tito@102.212.246.251`, SSH alias `codepasstech` |
| App directory | `/home/tito/educa-admin` |
| Served from | `/home/tito/educa-admin/current` (symlink to a release) |
| API it talks to | `https://educa-api.codepasstech.top/api` |
| Branch deployed | `dev` |

---

## The two things that bite

**1. Config is compiled in, not read at runtime.** `VITE_API_URL` and
`VITE_GOOGLE_WEB_CLIENT_ID` are baked into the JavaScript by Vite
(`src/lib/api/client.ts`, `src/lib/google.ts`). There is no `.env` on the
server, and editing one there would do nothing. Point the build at the wrong
API and the only fix is to rebuild.

**2. Users are running a service worker.** `vite-plugin-pwa` is set to
`registerType: 'prompt'`, so an installed client keeps the old app until the
person accepts the update prompt. A deploy is not "live for everyone" the
moment it lands. This is deliberate — it stops the app swapping underneath
someone halfway through a school set-up change.

---

## Deploy

Everything runs from this machine. The build happens locally on purpose: the
VPS has 1 vCPU and 1.9 GB RAM and already runs ~20 sites, so a `tsc` + `vite`
build there risks thrashing swap.

### 1. Get the code

```bash
cd ~/Projects/Codepasstech/Educa_Admin
git checkout dev && git pull
```

### 2. Make sure the production env file is present

Only needed once per machine — `.env.*.local` is gitignored, so it will not
arrive with a clone.

```bash
cat > .env.production.local <<'EOF'
VITE_API_URL=https://educa-api.codepasstech.top/api
VITE_GOOGLE_WEB_CLIENT_ID=211465295102-kkd9j9ls1aracs6musd39g5v2hust7ns.apps.googleusercontent.com
EOF
```

Vite picks `.env.production.local` up automatically for `npm run build`, and
leaves `.env.local` (your dev API) alone. The Google web client is the same one
Educa Staff and the API use — one client, three origins.

### 3. Check, then build

```bash
npm ci                  # lockfile-exact, unlike npm install
npm run typecheck
npm run test
rm -rf dist && npm run build
```

`npm run build` is `tsc -b && vite build`, so a type error stops the deploy.

### 4. Confirm what got baked in

Skipping this is the most common way a frontend deploy goes out broken — the
app loads fine and every API call quietly fails.

```bash
grep -rho 'https://educa-api[^"]*' dist/assets/*.js | sort -u | head -1
grep -rl 'localhost:8000' dist/ || echo "no localhost leaked"
```

Expect `https://educa-api.codepasstech.top/api` and `no localhost leaked`.

> Write that second check exactly as above. `grep -rl … | head` exits 0 even
> with no matches, so piping it into `head` inside an `if` reports a leak that
> is not there.

### 5. Ship it

```bash
TS=$(date +%Y%m%d%H%M%S)
ssh codepasstech "mkdir -p /home/tito/educa-admin/releases/$TS"
rsync -az --delete dist/ codepasstech:/home/tito/educa-admin/releases/$TS/
ssh codepasstech "ln -sfn /home/tito/educa-admin/releases/$TS /home/tito/educa-admin/current
                  chmod -R o+rX /home/tito/educa-admin"
```

Uploading to a fresh directory and swapping a symlink is what makes this safe:
the switch is atomic, so nobody can be served an `index.html` that references
assets still in flight. **No nginx reload is needed** — `open_file_cache` is
off, so nginx follows the symlink per request.

### 6. Tidy up

```bash
ssh codepasstech "cd /home/tito/educa-admin/releases && ls -1t | tail -n +4 | xargs -r rm -rf"
```

Keeps the three most recent releases, which is what makes rollback instant.

---

## Verify

```bash
curl -sI https://admin.educa.codepasstech.top/ | head -1           # 200
curl -sI http://admin.educa.codepasstech.top/  | head -1           # 301

# Deep links must return the app shell, not 404
for p in / /students /platform /auth/google/callback /nonexistent; do
  printf "%-24s %s\n" "$p" \
    "$(curl -s -o /dev/null -w '%{http_code}' https://admin.educa.codepasstech.top$p)"
done

# Entry points must not be cached; hashed assets must be
curl -sI https://admin.educa.codepasstech.top/sw.js | grep -i cache-control   # no-cache

# Every asset the shell references actually exists
curl -s https://admin.educa.codepasstech.top/ | grep -oE '/assets/[A-Za-z0-9._-]+' | sort -u |
while read -r a; do
  c=$(curl -s -o /dev/null -w '%{http_code}' "https://admin.educa.codepasstech.top$a")
  [ "$c" = 200 ] || echo "BROKEN $c $a"
done
```

Then in a browser: hard-reload, sign in as a school administrator, and change
something that writes — a subject, a class, or a report-card setting. As a
platform superadmin, also confirm switching schools still works: that path
sends the `X-School` header, and it is the one thing only this app does.

---

## Rolling back

```bash
ssh codepasstech "ls -1t /home/tito/educa-admin/releases"
ssh codepasstech "ln -sfn /home/tito/educa-admin/releases/<previous> /home/tito/educa-admin/current"
```

Instant, and no rebuild. Note that clients who already accepted the newer
service worker keep it until the older one is fetched again.

---

## When the API side also changes

Only relevant if this deploy changes the hostname, adds an origin, or touches
Google sign-in. All of it lives in `/home/tito/educa/.env` on the same box:

| Key | Current value |
|---|---|
| `EDUCA_ADMIN_URL` | `https://admin.educa.codepasstech.top` |
| `CORS_ALLOWED_ORIGINS` | must contain `https://admin.educa.codepasstech.top` |
| `GOOGLE_WEB_CLIENT_ID` | must match `VITE_GOOGLE_WEB_CLIENT_ID` here |

`CORS_ALLOWED_ORIGINS` is shared with Educa Staff — edit it, do not replace it,
or you will take the portal offline. Current value:

```
https://admin.educa.codepasstech.top,https://portal.educa.codepasstech.top,capacitor://localhost,https://localhost
```

The API caches its config, so an edit does nothing until:

```bash
ssh codepasstech "cd /home/tito/educa && php8.4 artisan config:cache && php8.4 artisan queue:restart"
```

A new origin also needs adding in Google Cloud Console (authorised JavaScript
origin, plus `/auth/google/callback` as a redirect URI) or the sign-in popup is
refused before it ever reaches the API.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| App loads, every API call fails with a CORS error | The origin is missing from `CORS_ALLOWED_ORIGINS`, or `config:cache` was not re-run |
| App loads, API calls go to `localhost:8000` | Built without `.env.production.local` — rebuild |
| Blank page, console shows 404s for `/assets/…` | Symlink points at a release that was pruned, or rsync was interrupted |
| A deep link 404s | The `try_files $uri $uri/ /index.html` fallback is missing from the vhost |
| Users still see the old version | Expected: `registerType: 'prompt'` waits for them to accept |
| Old version returns after a hard reload | `index.html` or `sw.js` got a long `Cache-Control` — they must stay `no-cache` |
| Google button does nothing | Origin not authorised in Google Cloud Console |
| Logo upload or student import rejected as too large | That limit is on the **API** vhost (`client_max_body_size`) and its PHP-FPM pool, not here |

Logs: `/var/log/nginx/educa-admin.{access,error}.log`.

---

## Server set-up (already done)

For reference, should it ever need rebuilding.

The host is **grey-clouded** in Cloudflare (DNS only, A → `102.212.246.251`).
Cloudflare's free Universal SSL covers `codepasstech.top` and
`*.codepasstech.top` but **not** a third-level name like this one, so the edge
would present no certificate at all. Bypassing the proxy lets Let's Encrypt
serve it from the origin instead — and the origin then sees real client IPs.

- `/etc/nginx/sites-available/admin.educa.codepasstech.top` — static vhost,
  SPA fallback, gzip, security headers
- `/etc/nginx/conf.d/educa-admin-map.conf` — `Cache-Control` as a `map`, so
  the server block needs one `add_header`. An `add_header` inside a `location`
  discards every `add_header` inherited from the parent, which is how security
  headers silently go missing.
- Certificate from `certbot --nginx -d admin.educa.codepasstech.top --redirect`,
  renewed by the box's existing `certbot.timer`.

Deliberately **no `Cross-Origin-Opener-Policy`** header: Google sign-in returns
through a popup that needs `window.opener`, and `COOP: same-origin` breaks it.
