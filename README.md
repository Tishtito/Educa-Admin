# Educa Admin

The administration app for **Educa**: school set-up, pupils and staff, exams,
marking, mark lists, analysis and report cards. School administrators and
platform superadmins use it; class teachers and examiners use the staff portal.

It is a React app that runs as an installable **PWA** and ships as **Android**
and **iOS** apps through Capacitor. All data comes from the Laravel API in
[`../Educa_Lara`](../Educa_Lara).

| | |
|---|---|
| UI | React 19, TypeScript, Tailwind v4, shadcn/ui (Radix) |
| Data | TanStack Query, React Hook Form + Zod |
| Routing | React Router 8 (data router, lazy pages) |
| App shells | vite-plugin-pwa, Capacitor 8 |
| Checks | `tsc`, oxlint, Vitest |

## Getting started

```bash
npm install
cp .env.example .env.local     # VITE_API_URL=http://127.0.0.1:8000/api
npm run dev                    # http://localhost:5173
```

Run the API alongside it (`composer run dev` in `Educa_Lara`, which includes the
queue worker that recomputes results and builds report card PDFs). The API only
accepts browser requests from the origins in its `CORS_ALLOWED_ORIGINS`.

Three dev servers run side by side, each on a fixed port: **5173** Educa Admin,
**5174** Educa Staff, **5170** the API's own Vite (Laravel's welcome page).
A port clash now fails loudly instead of moving an app onto a neighbour's port.

Demo sign-in after `php artisan migrate:fresh --seed` in the API:

| Username or email | Password | |
|---|---|---|
| `admin` | `password` | administrator of Gatimu Primary School |
| `admin.riverside` | `password` | administrator of the second demo school |
| `superadmin` | `password` | platform — pick a school after signing in |

Sign-in takes a username **or** an email address, and no school code: both are
unique across every school, so the account names its own school.

`teacher` and `examiner` accounts are refused here by design.

**Email.** Staff invitations, "Forgot your password?" and password-changed
notices are sent by the API (`Educa_Lara/docs/email.md`). In development, run
Mailpit and open emailed links from http://localhost:8025. The app serves them
at `/invite/:token` and `/reset-password/:token`. Administrators' links point
here (`EDUCA_ADMIN_URL`); other staff's point to the portal.

## Scripts

| Command | |
|---|---|
| `npm run dev` | Vite dev server, reachable on the LAN |
| `npm run typecheck` / `npm run lint` / `npm run test` | TypeScript, oxlint, Vitest |
| `npm run build` | Production build into `dist/` (with the service worker) |
| `npm run preview` | Serve `dist/` locally to test the PWA |
| `npm run cap:sync` | Build and copy into the native projects |
| `npm run android` / `npm run ios` | Build, sync and open Android Studio / Xcode |
| `npm run assets` | Regenerate app icons and splash screens from `assets/` |

## How it is put together

```
src/
  app/            router, providers, navigation, query client, service worker
  auth/           session state, guards (RequireAuth, RequireRole, RequireSchool)
  lib/api/        fetch client, error type, TypeScript mirrors of API responses
  lib/            storage (Capacitor Preferences), downloads, CSV, formatting
  components/     shadcn/ui primitives and shared data components
  features/       one folder per area — api.ts hooks + pages + components
    dashboard, exams, setup, people, settings, platform, reference
```

Conventions worth keeping:

- **API errors** always arrive as `ApiError`. 422 field errors are mapped onto
  forms (`showFormError`) or onto grid rows (`error.rows('marks')`). A 401 signs
  out; a 403 with `password_change_required` sends the user to set a password;
  409s are exam or set-up rules and their message is written for the user.
- **Unsaved edits are protected**: marksheets and remark grids work on a
  snapshot that background refetches never overwrite, and leaving asks first.
- **Superadmins** send `X-School` for the school they picked; switching school
  clears every cached response.
- **Children's data is never cached offline.** The service worker precaches the
  app shell only; `/api/*` is network-only. The Android app opts out of cloud
  backup and device transfer for the same reason.
- `src/components/ui/select.tsx` ignores `onValueChange("")`: Radix emits it
  while options load and it would wipe form defaults. Never use `""` as an
  option value (use `'none'`).

## Deploying the PWA

`npm run build` and serve `dist/` from any static host with:

- an SPA fallback to `index.html` for unknown paths;
- `Cache-Control: no-cache` on `index.html` and `sw.js`, long-lived caching on
  `assets/*` (file names are content-hashed);
- the site's origin added to the API's `CORS_ALLOWED_ORIGINS`.

When a new version is deployed, open apps show a "Reload" prompt.

## Native apps

The projects live in `android/` and `ios/`. Set `VITE_API_URL` to the production
**https** API before building — it is compiled in.

### Android

Needs Android Studio (or the Android SDK command-line tools) and **JDK 21**.

```bash
VITE_API_URL=https://api.educa.example/api npm run cap:sync
cd android && ./gradlew assembleDebug        # app/build/outputs/apk/debug/
```

Against a laptop on the LAN while developing:

```bash
CAP_SERVER_URL=http://192.168.1.20:5173 npx cap run android   # live reload from Vite
# or a bundled build calling an http API:
CAP_ALLOW_MIXED_CONTENT=1 VITE_API_URL=http://192.168.1.20:8000/api npm run cap:sync
```

The Android shell's origin is `https://localhost`; the iOS shell's is
`capacitor://localhost`. Both are in the API's default CORS list.

### iOS

Needs a Mac with Xcode. Plugins are included through Swift Package Manager.

```bash
VITE_API_URL=https://api.educa.example/api npm run ios
```

Report card PDFs open the share sheet on both platforms (save to Files, print,
send), because a WebView cannot download files.
