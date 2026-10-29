# Deploy runbook — home Linux server (tailnet, plain HTTP)

One Docker container serves the API **and** the built PWA on host port **40001**
(`APP_PORT` in `.env`; the container always listens on 8080 internally). Phones
open it over **plain HTTP at the server's Tailscale IP**:
`http://<tailscale-ip>:40001`. Traffic stays inside the tailnet, which is already
encrypted end-to-end by WireGuard.

> **What plain HTTP costs.** Browsers only enable some features on HTTPS pages
> (or `localhost`). Over `http://<tailscale-ip>`:
> - **Push reminders don't work.** The daily summary and per-chore reminders need
>   HTTPS. The app says so under Settings → Reminders.
> - **No offline mode.** The service worker needs HTTPS too, so the phone must be
>   able to reach the server (Tailscale connected) to open the app.
>
> Everything else works: rooms, chores, Today, scores, sync between phones,
> and Add to Home Screen. To get reminders later, add HTTPS (section 8).
> Nothing else changes.

## 1. Prerequisites

- Docker Engine + the compose plugin (`docker compose version` works).
- Tailscale installed and logged in on the server **and every phone**
  (`tailscale status` shows them all).

## 2. Get the code + configure

```bash
git clone https://github.com/TanayaBhave/Home_Management.git home-management && cd home-management

cp .env.example .env
openssl rand -base64 32     # → paste as SYNC_TOKEN in .env
$EDITOR .env                # set SYNC_TOKEN (APP_PORT is already 40001).
                            # VAPID_* can stay empty.
```

## 3. Build + start

```bash
docker compose up -d --build
curl http://localhost:40001/api/health   # expect {"ok":true,...}
docker compose logs -f app               # if anything looks off
```

The SQLite database lands in `./data/home.sqlite` (bind mount) and survives
rebuilds and restarts.

## 4. Find the URL

```bash
tailscale ip -4        # e.g. 100.x.y.z
```

The app URL is `http://100.x.y.z:40001`. Check it from another tailnet device
(or `curl http://100.x.y.z:40001/api/health` on the server). If it doesn't load
but localhost does, a host firewall is blocking the port, e.g.
`sudo ufw allow in on tailscale0 to any port 40001`.

## 5. Install on each phone

On **each** phone (Tailscale app connected):

1. Safari → `http://<tailscale-ip>:40001` (type the `http://` explicitly).
2. Share → **Add to Home Screen** → Add.
3. Open the app from the home-screen icon.
4. **First phone:** choose **New home** → set room counts and names of who lives
   here → Create. Then Settings → Sync → paste the `SYNC_TOKEN` from `.env`.
   **Other phones:** choose **Join existing home** → paste the same token; the
   rooms appear after the first sync.
5. Settings → **This device is** → pick your name (so your points are credited).
6. Tick a chore on phone A, wait a few seconds, confirm it's ticked on phone B.

Leave **Server URL** blank — the app syncs to the host it was loaded from.
Always open the app at the **same** address: each address (IP vs. hostname,
http vs. https) is a separate browser origin with its own local data. Sync will
fill a new origin back in once the token is entered there.

## 6. Update / redeploy

```bash
cd ~/home-management
git pull
docker compose up -d --build
```

Without a service worker there is no stale cache. Reopening the app loads the new version.

## 7. Backup

The whole dataset is the SQLite file and its journal siblings:
`./data/home.sqlite`, `home.sqlite-wal`, `home.sqlite-shm`.

```cron
15 3 * * * cp -a /home/YOU/home-management/data /home/YOU/backups/home-$(date +\%F)
```

Copy all three together. For a guaranteed-consistent snapshot:
`docker compose stop app` → copy → `docker compose start app`.
**Restore:** stop, copy the files back into `./data/`, start.

## 8. Optional: HTTPS for reminders + offline (other apps unaffected)

`tailscale serve` only listens on the **one** HTTPS port you give it. Every
other app/port on this server keeps working exactly as before, and
`http://<tailscale-ip>:40001` keeps working too. Use a dedicated port
(**40443** here) so you never collide with another app, including anything on 443.

One-time: Tailscale admin console → **DNS** → enable MagicDNS **and** HTTPS
certificates. (This is a tailnet-wide toggle; it doesn't change any existing app.
Note: issuing a cert records the machine's `*.ts.net` name in public
Certificate Transparency logs. The name becomes public, but the server is still
only reachable from inside the tailnet.)

```bash
tailscale serve status                          # see what's already served; don't reuse those ports
tailscale serve --bg --https=40443 localhost:40001
# → https://<hostname>.<tailnet>.ts.net:40443  (tailnet-only; never use `funnel`)
```

The HTTPS URL must use the **hostname** (certificates are issued for the
`.ts.net` name, not the 100.x IP). Find it with `tailscale status` or in
`tailscale serve status`. To remove it later: `tailscale serve --https=40443 off`.
This only removes this one port. Avoid `tailscale serve reset`, which clears
every serve config on the machine.

Open that URL on the phones instead (re-add to Home Screen, enter the token
again — it's a new origin, sync refills it). Then Settings → Reminders → **Turn on
reminders** → Allow → **Send test**. Push requires iOS 16.4+ and the app opened
from its Home Screen icon. The server needs normal outbound internet to reach
Apple's push service; VAPID keys are generated automatically and stored in the DB.

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Phone can't load `http://<ip>:40001` | Tailscale disconnected on phone, wrong IP, or host firewall | Connect Tailscale; check `tailscale ip -4`; open port 40001 on the `tailscale0` interface |
| Safari jumps to `https://` and fails | Typed without scheme / old HTTPS autocomplete | Type the full `http://100.x.y.z:40001` |
| Sync fails with **401** | Phone token ≠ `SYNC_TOKEN` | Re-paste the token; after editing `.env` run `docker compose up -d` |
| `curl localhost:40001/api/health` fails | Container crashed, or port busy | `docker compose ps`, `docker compose logs app`; pick a free `APP_PORT` |
| Data "disappeared" on a phone | Opened at a different address (new origin) | Use the same URL as before, or enter the token there and let it sync |
| Reminders section says HTTPS is needed | Expected over plain HTTP | See section 8 |
| Build fails on `better-sqlite3` / `node-gyp` | Native-module compile hiccup | `docker compose build --no-cache && docker compose up -d` |
