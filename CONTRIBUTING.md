# Contributing to Realm of Echoes

First off, thank you for considering contributing to Realm of Echoes! 

## Branching Strategy

We follow a prefixed-branch workflow that tightly integrates with our ArgoCD environments. 

* **`main`**: The stable production branch. Code merged here goes live to the public immediately. Direct commits to `main` are strictly prohibited.
* **`feat/*`**: Used for developing new features. Pushing this branch automatically spins up an isolated Ephemeral Preview Environment in the cluster.
* **`bugfix/*`**: Used for squashing bugs. (Note: Ensure your ArgoCD ApplicationSet regex includes bugfixes if you want these to spin up preview environments!)
* **`docs/*`**: Used for updating documentation. These branches do not trigger preview environments, saving cluster resources.

## Commit Message Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) to keep our Git history clean and understandable. 

* `feat:` A new feature.
* `fix:` A bug fix.
* `docs:` Documentation only changes.
* `chore:` Routine tasks, pipeline updates, or dependency bumps.

## Merge Request (MR) Process

1. Create your feature branch and push your code.
2. Wait for the CI/CD pipeline to pass and your Ephemeral Preview Environment to spin up.
3. Test your changes thoroughly at your branch's internal `.apps.internal.garflak.com` URL.
4. Open a Merge Request against the `main` branch.
5. Include a link to your live preview environment in the MR description.
6. **CRITICAL CLEANUP STEP:** Before your MR is merged, you must delete your dynamic Kustomize folder so it doesn't pollute the `main` branch. 
   ```bash
   git rm -r k8s/overlays/your-branch-slug/
   git commit -m "chore: clean up ephemeral overlay"
  ```
7. Once approved and cleaned up, squash and merge your commits.
8. Delete the source branch in GitLab so ArgoCD destroys the cluster resources.
