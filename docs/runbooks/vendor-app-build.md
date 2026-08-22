# Vendor App (Collector) — Build & Run

`apps/vendor-mobile` is an Expo (React Native) app, Android-only for this sprint (Open Issue
#15 — no Play Store account or signing keystore exists yet). This runbook covers running a
dev/debug build for a walkthrough now, and the release path for whenever a keystore exists.

## 1. Prerequisites

- Node.js 20+ and the repo's root `npm install` already run (`apps/vendor-mobile` is an npm
  workspace — don't `npm install` inside it directly except via `npx expo install <pkg>`,
  which keeps native module versions matched to the Expo SDK).
- `services/api` running locally (`npm run dev:up` from the repo root — see the root README).
- One of:
  - **Android emulator**: Android Studio with a configured AVD.
  - **Physical Android device**: the [Expo Go](https://expo.dev/go) app installed, and the
    device on the same Wi-Fi network as your dev machine.

## 2. Point the app at the API

The API base URL is read from `EXPO_PUBLIC_API_URL`, falling back to `http://10.0.2.2:3000`
(the Android emulator's alias for the host machine's `localhost`) — see
`src/lib/apiClient.ts`.

- **Emulator**: no config needed, the default already works.
- **Physical device**: the device can't resolve `10.0.2.2` or `localhost` as your dev
  machine, so set your machine's LAN IP instead:

  ```
  # macOS/Linux
  export EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000

  # Windows PowerShell
  $env:EXPO_PUBLIC_API_URL = "http://<your-lan-ip>:3000"
  ```

  Find `<your-lan-ip>` with `ipconfig` (Windows) or `ifconfig`/`ip addr` (macOS/Linux) — use
  the Wi-Fi adapter's IPv4 address. Set this in the same shell you run `expo start` from.

## 3. Run it

From `apps/vendor-mobile`:

```
npm run android      # builds + launches on a connected emulator/device via adb
# or
npx expo start        # prints a QR code — scan it with Expo Go on a physical device
```

The first `npm run android` against a fresh emulator can take a few minutes (Metro bundling
+ native module linking). Subsequent runs are fast — Metro fast-refreshes on file save.

## 4. Sign in

Seeded accounts (from `packages/db/src/seed.ts`, loaded by `npm run dev:up`):

| Role      | Email                       | Password       | Fields   |
| --------- | ---------------------------- | -------------- | -------- |
| Collector | rambabu@proledger.local      | collector123   | C1, D1   |
| Collector | mkane@proledger.local        | collector123   | D2, E1   |
| Admin     | admin@proledger.local        | admin123       | — (web only) |

Only `Role.Collector` accounts can sign in to the vendor app — `requireRole(Role.Collector)`
on the mobile-facing endpoints rejects an admin token.

## 5. Troubleshooting

- **"Network request failed" on login**: usually `EXPO_PUBLIC_API_URL` pointing somewhere
  the device can't reach — re-check step 2, and confirm `services/api` is actually running
  (`curl http://localhost:3000/health` on the dev machine should return `{"ok":true}`).
- **Blank screen / stuck on Metro bundler**: clear the cache — `npx expo start -c`.
- **Emulator can't reach the API even at the default URL**: some emulator images/networking
  setups don't honor `10.0.2.2` — fall back to the LAN-IP approach from step 2 even for the
  emulator.

## 6. Release build (once a keystore + Play account exist — Track B)

Not runnable today (Open Issue #15), but ready to go the moment credentials land:

1. Install the EAS CLI: `npm install -g eas-cli` and `eas login`.
2. From `apps/vendor-mobile`, run `eas build:configure` — this generates `eas.json` with
   `development`/`preview`/`production` profiles.
3. `eas build -p android --profile production` — EAS manages the keystore (or upload an
   existing one with `eas credentials`) and produces a signed `.aab`.
4. Upload the `.aab` to the Play Console's internal testing track, add the seeded/demo
   testers, and roll out.

No code changes are needed to reach this point — `app.json`'s `android.package`
(`com.indus.erp.vendor`) is already set, which is the one value EAS build requires up front.
