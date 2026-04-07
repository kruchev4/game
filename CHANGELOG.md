# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

##[2026-04-07]

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
