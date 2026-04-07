# Realm of Echoes

Welcome to the Realm of Echoes! This is a web-based RPG deployed via an automated GitOps workflow. 

## Architecture

This application is containerized and deployed to a Kubernetes cluster. Our infrastructure utilizes:
* **Traefik**: For Ingress and routing.
* **Cert-Manager & FreeIPA**: For internal TLS certificates.
* **Cloudflare Tunnels**: For secure public access to the production environment.
* **Vault & External Secrets Operator**: For dynamic secret injection (registry credentials).
* **GitLab CI/CD & ArgoCD**: For automated building, testing, and deployment.

---

## Development Workflow

We use a fully automated GitOps preview environment system. You do not need to run a local Kubernetes cluster to test your code. 

### 1. Create a Feature Branch
Whenever you want to build a new feature or fix a bug, create a new branch. **Branch names should start with `feat/` or `bugfix/`**, making sure to use URL-safe characters.
```bash
git checkout -b feat/new-inventory
```

### 2. Push Your Changes
Make your code changes and push them to GitLab. 
```bash
git add .
git commit -m "feat: add new inventory UI"
git push origin feat/new-inventory
```

### 3. Access Your Ephemeral Environment
Once you push, our CI/CD pipeline automatically:
1. Builds a new Kaniko Docker image.
2. Generates a dynamic Kustomize overlay.
3. Triggers ArgoCD to spin up an isolated namespace (e.g., `games-feat-new-inventory`).

Within ~3 minutes of pushing, your branch will be live and accessible internally at:
**`https://feat-new-inventory.apps.internal.garflak.com`**

### 4. Merge and Tear Down
Once your code is reviewed and tested in your preview environment, merge your branch into `main`. 
* Pushing to `main` will automatically deploy your changes to the live production environment at `https://echoes.garflak.com`.
* Deleting your feature branch will signal ArgoCD to instantly destroy your preview environment and reclaim the cluster resources.
