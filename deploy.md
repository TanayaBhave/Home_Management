# Deploy runbook — home Linux server (tailnet-only)

One Docker container serves the API **and** the built PWA, and sends push
reminders. The host port is set by `APP_PORT` in `.env` — **there is no default;
you must set it** (the container always listens on 8080 internally). HTTPS
(mandatory for iOS PWA install, the service worker, and Web Push) is provided at
the host level by `tailscale serve`, tailnet-only — **no Funnel, nothing public**.

## 1. Prerequisites

- Docker Engine + the compose plugin (`docker compose version` works).
- Tailscale installed and logged in on the server **and every phone**
  (`tailscale status` shows them all).
- Tailscale admin console → **DNS**: MagicDNS **and** HTTPS certificates enabled.
- The server needs outbound HTTPS to Apple/Google push services (normal internet
  access is enough — nothing inbound is needed for push).

## 2. Get the code + configure

```bash
git clone https://github.com/TanayaBhave/home-management.git && cd home-management

cp .env.example .env
openssl rand -base64 32     # → paste as SYNC_TOKEN in .env
$EDITOR .env                # set APP_PORT (required) and SYNC_TOKEN.
                            # VAPID_* can stay empty — keys are generated on first start.
```

## 3. Build + start

```bash
docker compose up -d --build
curl http://localhost:<APP_PORT>/api/health   # expect {"ok":true,...}
docker compose logs -f app                    # if anything looks off
```

If compose says `Set APP_PORT in .env`, you haven't filled in the port yet.
The SQLite database lands in `./data/home.sqlite` (bind mount) and survives
rebuilds and restarts. The push (VAPID) keys are stored inside it too.

## 4. HTTPS via tailscale serve (tailnet-only)

```bash
tailscale serve --bg localhost:<APP_PORT>
tailscale serve status        # shows https://<hostname>.<tailnet>.ts.net/ → proxy
```

This terminates TLS with a real certificate and forwards HTTPS :443 →
`http://localhost:<APP_PORT>`, visible **only inside your tailnet**. `--bg` keeps
it running across reboots. Permission error → prefix `sudo` (or run
`tailscale set --operator=$USER` once).

> If :443 on this host is already used by another app (e.g. the Tracker), serve
> this one on another HTTPS port instead:
> `tailscale serve --bg --https=8443 localhost:<APP_PORT>` → app URL is
> `https://<hostname>.<tailnet>.ts.net:8443`.

Turn off later: `tailscale serve --https=443 off` (or `tailscale serve reset`).

## 5. Install on each phone

On **each** phone (Tailscale app connected):

1. Safari → `https://<hostname>.<tailnet>.ts.net`.
2. Share → **Add to Home Screen** → Add.
3. Open the **installed** app (home-screen icon, not the Safari tab).
4. **First phone:** choose **New home** → set room counts and names of who lives
   here → Create. Then Settings → Sync → paste the `SYNC_TOKEN` from `.env`.
   **Other phones:** choose **Join existing home** → paste the same token; the
   rooms appear after the first sync.
5. Settings → **This device is** → pick your name (so your points are credited).
6. Settings → Reminders → set the daily summary time → **Turn on reminders** →
   Allow → **Send test**.
7. Tick a chore on phone A, wait a few seconds, confirm it's ticked on phone B.

Leave **Server URL** blank — the app syncs to the host it was loaded from.

## 6. Update / redeploy

```bash
cd ~/home-management
git pull
docker compose up -d --build
```

The service worker auto-updates; if a phone looks stale, fully close the app
(swipe away) and reopen once.

## 7. Backup

The whole dataset (plus push keys and subscriptions) is the SQLite file and its
journal siblings: `./data/home.sqlite`, `home.sqlite-wal`, `home.sqlite-shm`.

```cron
15 3 * * * cp -a /home/YOU/home-management/data /home/YOU/backups/home-$(date +\%F)
```

Copy all three together. For a guaranteed-consistent snapshot:
`docker compose stop app` → copy → `docker compose start app`.
**Restore:** stop, copy the files back into `./data/`, start.

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `docker compose up` errors with `Set APP_PORT in .env` | Port not filled in | Put the port in `.env` as `APP_PORT=` |
| Sync fails with **401** | Phone token ≠ `SYNC_TOKEN` | Re-paste the token; after editing `.env` run `docker compose up -d` |
| `curl …/api/health` fails | Container crashed, or port busy | `docker compose ps`, `docker compose logs app`; pick a free `APP_PORT` and re-point tailscale serve |
| `https://…ts.net` cert warning / timeout | MagicDNS/HTTPS not enabled, or serve not running | Enable both in the admin console; `tailscale serve status` |
| "Turn on reminders" is greyed out on iPhone | Opened in Safari, not from the Home Screen icon (or iOS < 16.4) | Add to Home Screen, open from the icon |
| Reminders never arrive | Notifications denied, or subscription went stale | iPhone Settings → Notifications → Home → Allow; in the app, Turn off → Turn on reminders → Send test |
| Reminders arrive at the wrong hour | — | Times follow each **phone's** timezone (sent when subscribing); toggle reminders off/on after travelling |
| Build fails on `better-sqlite3` / `node-gyp` | Native-module compile hiccup | `docker compose build --no-cache && docker compose up -d` |
| Moved servers and push stopped | VAPID keys live in the DB | Copy `./data` across, or pin `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` in `.env` |
