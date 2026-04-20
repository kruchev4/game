# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Global Chat Microservice:** Built a standalone, WebSocket chat server written in Go (runs on port 8081).
- **Direct Messaging:** Added whisper functionality to the chat system using the `/w [PlayerName]` slash command.
- **Chat UI & Hotkeys:** Implemented an in-game chat interface with smart keybinding (press `Enter` to type/send, press `Escape` to close/unfocus without triggering the game's main menu).
- **LAN/HTTP Support:** Added a mathematical polyfill for `crypto.randomUUID()` in `SaveProvider.js` to allow the game to run on local IP addresses without throwing browser security context errors.
- **Microservice Documentation:** Added a dedicated `README.md` inside the new `chat-server` directory detailing JSON payload shapes and deployment instructions.

### Changed
- **Docker Environment Injection:** Updated `docker-compose.yml` to automatically ingest the `.env` file via `env_file: - .env` rather than manually declaring variables, fixing local IP routing.
- **Untracked Secrets:** Removed the local `.env` file from Git's tracking index to protect Supabase API keys.

### Fixed
- **The "Hitbox Umbrella" (Targeting Bug):** Removed obsolete 3x3 grid targeting logic in `Engine.js`. Clicks now use exact tile matching, allowing Paladins/melee classes to accurately target adjacent enemies without accidentally targeting themselves.
- **Loot Pickup Bug:** Fixed an issue where standing next to or directly on top of a loot bag prevented the player from picking it up (resolved via the hitbox fix above).
- **Docker Volume Overwrite:** Added an anonymous volume map (`- /app/roe-server/node_modules`) to `docker-compose.yml` to prevent the host machine from instantly deleting the container's Node modules upon booting.
- **Server Merge Conflicts:** Cleaned up residual Git merge conflict artifacts in `server.js` and restored the HTTP static file server logic required for the Docker container to function.

## [2026-04-07]

### Added
- Added Git `--rebase` and overlay cleanup workflow documentation to `README.md` and `CONTRIBUTING.md` to prevent Git commit history drift.
- Established `docs/` branching convention for lightweight, non-ephemeral repository updates.

### Fixed
- Fixed ArgoCD duplicate application generation by updating the dynamic SCM variable to `{{branchNormalized}}`.
- Corrected Kustomize patch target name in `.gitlab-ci.yml` so Traefik correctly routes external preview URLs (resolving 404 errors).
- Resolved SCM Provider `x509` certificate errors by explicitly mapping the SCM `caRef` to the FreeIPA `argocd-tls-certs-cm` ConfigMap.
- Upgraded GitLab API token scopes (`read_api`, `read_repository`) to properly authorize the ArgoCD ApplicationSet REST API queries.

## [1.0.0] - 2026-04-06

### Added
- Implemented automated GitOps CI/CD pipeline using GitLab CI.
- Added Kustomize base and overlay configurations for dynamic environments.
- Implemented Ephemeral Preview Environments via ArgoCD ApplicationSets.
- Integrated External Secrets Operator for dynamic GitLab registry authentication.
- Added Cloudflare Tunnel support for production routing.
- Configured automatic internal TLS certificate generation via Cert-Manager and FreeIPA.

### Changed
- Restructured `k8s` directory to utilize Kustomize `base` and `overlays` architecture.
- Migrated hardcoded routing rules to dynamic branch-based injection.

### Removed
- Removed static `namespace.yaml` as ArgoCD now handles dynamic namespace provisioning.

### Fixed
- Restructured `k8s/` directory into `base/` and `overlays/prod/` to prevent CI pipeline failures on the `main` branch.
- Integrated GitLab API token into External Secrets Operator so ArgoCD ApplicationSet can dynamically discover and deploy feature branches.
