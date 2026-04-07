# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
