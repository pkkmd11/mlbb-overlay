# Docker and LXC runbook (Ubuntu server + Docker-in-LXC)

This project is a Node.js app that serves static pages from [`public/`](public:1) via Express and uses a WebSocket server on port 3000 (see [`server.js`](server.js:1)). Containerization is already mostly correct via [`Dockerfile`](Dockerfile:1) and [`docker-compose.yml`](docker-compose.yml:1).

## 1) What already works

- Container listens on port 3000 (see [`Dockerfile`](Dockerfile:18) and [`server.js`](server.js:434)).
- Compose publishes the port: [`docker-compose.yml`](docker-compose.yml:5).
- Persistent state is bind-mounted:
  - runtime JSON state under [`public/database/`](public/database:1)
  - uploaded theme assets under [`public/Assets/costum/Theme/`](public/Assets/costum/Theme/theme.json:1)
  - flags under [`public/Assets/nationalflag/`](public/Assets/nationalflag:1)

## 2) Issues that commonly break when running in Docker (and especially in LXC)

### A. Hub shows the wrong IP / clients try to connect to wrong IP

Your app writes a detected IP into [`public/serverip.txt`](public/serverip.txt:1) from [`server.js:getLocalIp()`](server.js:168). Inside Docker this often becomes a *container* interface IP (for example `172.x.x.x`), which is not reachable from your LAN.

This then affects pages/scripts that depend on `serverip.txt`:

- Hub UI builds URLs using a fetched IP: [`public/hub.html`](public/hub.html:551)
- Cross-sync connects WebSocket to `ws://<ip>:3000`: [`public/crosshost.js`](public/crosshost.js:1) and [`public/crossclient.js`](public/crossclient.js:1)

**Preferred fix (portable):** stop advertising an IP and instead use the hostname the browser is already using, i.e. `window.location.host` and a protocol-derived `ws`/`wss`.

### B. Hardcoded localhost WebSocket

At least one script hardcodes `ws://localhost:3000` and will fail when accessed from another machine:

- [`public/script/herodisplayisolated.js`](public/script/herodisplayisolated.js:1)

### C. Optional: hardcoded local OCR endpoint

- [`public/script/scoreboaedocr.js`](public/script/scoreboaedocr.js:33) fetches `http://localhost:18099/json`.

This is likely intended to run on the same machine as the OCR provider (OBS/companion). In Docker-on-server scenarios this may be unreachable or refer to the viewer machine, not the server.

## 3) Recommended application changes for Docker + LXC portability

These are minimal and focus on networking correctness:

1) Replace any hardcoded WebSocket URL with a computed one:
   - `const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'`
   - connect to `${protocol}://${window.location.host}`
   - Applies to [`public/script/herodisplayisolated.js`](public/script/herodisplayisolated.js:1)
   - Also consider making [`public/script/theme-loader.js`](public/script/theme-loader.js:1) use `wss` under HTTPS.

2) Remove dependency on [`public/serverip.txt`](public/serverip.txt:1) for link generation in [`public/hub.html`](public/hub.html:551):
   - Build URLs using `window.location.origin` for OPEN/COPY.
   - Keep an optional advanced override (query string like `?host=1.2.3.4:3000`) only if you really need to display a second address.

3) Make cross-sync scripts use `window.location.host` by default:
   - [`public/crosshost.js`](public/crosshost.js:1)
   - [`public/crossclient.js`](public/crossclient.js:1)
   - If you still need “connect to a different host” support, use a query param override rather than `serverip.txt`.

4) Optional: add an environment variable override so the server can write a correct public address when needed:
   - Example env: `ADVERTISE_HOST=10.0.0.5`
   - Server uses it instead of auto-detect in [`server.js:getLocalIp()`](server.js:168)

## 4) Docker on a normal Ubuntu server (no LXC)

### Deploy

- Build and run:
  - `docker compose up -d --build`
- Verify:
  - open `http://SERVER_LAN_IP:3000/hub.html`
  - check health quickly by requesting a JSON endpoint like `http://SERVER_LAN_IP:3000/api/theme` (served by [`server.js`](server.js:288))

### Firewall

- Allow inbound TCP 3000 to the host.

### Data persistence

Bind mounts in [`docker-compose.yml`](docker-compose.yml:8) mean the container will store runtime state in your project folder. Ensure those host directories exist and are writable.

## 5) Docker inside an Ubuntu LXC

There are two distinct concerns:

1) **Docker-in-LXC prerequisites** (kernel features, AppArmor, nesting)
2) **Networking mode** (bridged vs NAT) which affects reachability from LAN

### 5.1 Proxmox LXC notes (universal guidance)

- Prefer **bridged** networking for simplest LAN access (container gets its own LAN IP).
- Enable nesting (required for Docker inside LXC).
- If Docker fails to start with permission/cgroup/AppArmor errors, typical Proxmox knobs are:
  - `nesting=1`
  - `keyctl=1`
  - AppArmor profile adjustments (some setups require unconfined)

The exact LXC config differs between privileged/unprivileged containers and host kernel configuration, so the runbook should be treated as a checklist: if `dockerd` fails, capture the error logs and apply the matching LXC feature.

### 5.2 LXD/LXC on Ubuntu notes (universal guidance)

- Use a profile that enables nesting for Docker workloads.
- Prefer a bridged NIC if you need direct LAN access; otherwise NAT works but you must port-forward from the host.

### 5.3 Networking decision table

| Mode | Result | How you access the app |
|---|---|---|
| Bridged LXC | LXC has its own LAN IP | `http://LXC_LAN_IP:3000/hub.html` |
| NAT LXC | LXC has private IP only | `http://HOST_IP:3000/hub.html` after host port-forward to LXC |

## 6) Container checks (works in both server + LXC)

1) Container is listening:
   - `docker compose ps`
   - `docker logs <container>` should show `SERVER STARTED` from [`server.js`](server.js:438)

2) HTTP OK:
   - GET `/hub.html`
   - GET `/api/matchdata`

3) WebSocket OK:
   - Open Hub and confirm live features work.
   - If WebSocket fails only on remote clients, search and remove hardcoded `localhost` such as in [`public/script/herodisplayisolated.js`](public/script/herodisplayisolated.js:2).

