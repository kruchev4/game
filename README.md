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

We use a two-loop development strategy: an **Inner Loop** for instant local feedback, and an **Outer Loop** for full GitOps staging environments.

### The "Inner Loop" (Local Development)
For fast iteration on HTML, CSS, or JS, you can run the game locally using Docker. The local setup mounts your codebase directly into the container so your browser updates instantly when you save a file.

1. **Copy the Docker Compose configuration:**
   ```bash
   cp docker-compose.yml.example docker-compose.yml
   ```
2. **Start the local environment:**
   ```bash
   docker-compose up -d
   ```
3. **Develop:**
   Open your browser to `http://localhost:8080`. Any changes you make to the files in this directory will instantly reflect in the browser upon refreshing.
4. **Stop the environment:**
   ```bash
   docker-compose down
   ```

---

### The "Outer Loop" (GitOps Preview Environments)
Once your local changes look good, it is time to test them in a production-like cluster environment using our automated GitOps pipeline.

#### 1. Create a Feature Branch
Whenever you want to build a new feature or fix a bug, create a new branch. **Branch names should start with `feat/` or `bugfix/`**, making sure to use URL-safe characters.
```bash
git checkout -b feat/new-inventory
```

#### 2. Push Your Changes
Make your code changes and push them to GitLab. 
```bash
git add .
git commit -m "feat: add new inventory UI"
git push origin feat/new-inventory
```

#### 3. Access Your Ephemeral Environment
Once you push, our CI/CD pipeline automatically:
1. Builds a new immutable Docker image.
2. Generates a dynamic Kubernetes overlay.
3. Triggers ArgoCD to spin up an isolated namespace (e.g., `games-feat-new-inventory`).

Within ~3 minutes of pushing, your branch will be live and accessible internally behind real TLS certificates at:
**`https://feat-new-inventory.apps.internal.garflak.com`**

#### 4. Merge and Tear Down
Once your code is reviewed and tested:
1. **Clean up the repo:** Delete your dynamic overlay directory (`git rm -r k8s/overlays/feat-new-inventory`) and commit the deletion.
2. **Merge to main:** Pushing to `main` will automatically deploy your changes to the live production environment at `https://echoes.garflak.com`.
3. **Delete the branch:** Deleting your feature branch in GitLab will signal ArgoCD to instantly destroy your preview namespace and reclaim the cluster resources.
