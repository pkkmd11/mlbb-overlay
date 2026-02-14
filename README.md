# False MLBB Overlay Tool – Docker Deployment Runbook

## Overview

This guide documents how to run the False MLBB Overlay Tool inside Docker (including Docker inside an LXC container) using the provided [`Dockerfile`](Dockerfile:1) and [`docker-compose.yml`](docker-compose.yml:1). All application credit belongs to the original creator of the False MLBB Overlay Tool; this document only covers containerization and operational practices.

## Prerequisites

- A host with Docker Engine 24+ and Docker Compose (plugin or standalone).
- Outbound internet access during the initial build to download the Node.js base image and npm dependencies.
- Optional: Proxmox/LXC or LXD with nesting enabled if you plan to run Docker inside a container.

## Quick Start (Any Linux or Windows Server)

1. **Clone or copy the project directory** to your server.
2. **Ensure persistent mount points exist** on the host (only needed once). If these directories are already present—for example because they came with your project copy—you can skip the command below:
   ```bash
   mkdir -p public/database \
            public/Assets/costum/Theme \
            public/Assets/nationalflag
   ```
3. **Build and run the stack**:
   ```bash
   docker compose up -d --build
   ```
4. **Verify the service**:
   - Open `http://<HOST_OR_IP>:3000/hub.html` in a browser.
   - Confirm container status with `docker compose ps` and review logs via `docker logs false-mlbb-overlay`.

## Runtime Behavior

- The container listens on TCP port `3000` (exposed & published in [`docker-compose.yml`](docker-compose.yml:5)).
- Runtime JSON state, uploaded themes, and national flags persist on the host thanks to bind mounts declared in [`docker-compose.yml`](docker-compose.yml:8).
- [`server.js`](server.js:168) auto-creates any missing directories under `public/` during startup.

## Optional Configuration

| Setting | Description |
| --- | --- |
| `ADVERTISE_HOST` | Overrides the auto-detected LAN IP written to `public/serverip.txt`. Set this environment variable at container runtime if clients must connect to a specific hostname/IP. |
| Custom port mapping | Change the left side of the `3000:3000` mapping in [`docker-compose.yml`](docker-compose.yml:6) if you need a different host port (e.g., `8080:3000`). |

To apply configuration changes:
```bash
docker compose down
# edit files (e.g., docker-compose.yml)
docker compose up -d --build
```

## Deploying Inside an LXC Container (Proxmox or LXD)

1. Enable nesting (`nesting=1`) and keyctl (`keyctl=1`) for the container profile.
2. Prefer bridged networking so the LXC gets a LAN IP; otherwise configure host-level port forwarding when using NAT.
3. Follow the same Quick Start steps inside the LXC guest. All Docker commands execute within the LXC environment.
4. If `dockerd` fails to start, inspect LXC logs for cgroup/AppArmor denials and adjust the profile (some environments require an unconfined AppArmor profile for Docker workloads).

## Updating the Container

```bash
docker compose pull
# or git pull if you track upstream changes
docker compose up -d --build
```

## Removing the Deployment

```bash
docker compose down
```
This command stops and removes the container but leaves bind-mounted data intact. Remove the `public/database`, `public/Assets/costum/Theme`, and `public/Assets/nationalflag` directories manually if you want a clean slate.

## Credits

All intellectual property, artwork, and application logic belong to the original False MLBB Overlay Tool creator. This README only provides deployment instructions for running the unmodified application within Docker/Docker Compose environments.
