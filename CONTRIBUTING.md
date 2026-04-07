# Contributing to Realm of Echoes

First off, thank you for considering contributing to Realm of Echoes! 

## Branching Strategy

We follow a feature-branch workflow that tightly integrates with our ArgoCD ephemeral environments. 

* **`main`**: The stable production branch. Code merged here goes live to the public immediately. Direct commits to `main` are strictly prohibited.
* **`feat/*`**: Used for developing new features.
* **`bugfix/*`**: Used for squashing bugs.

## Commit Message Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) to keep our Git history clean and understandable. Please prefix your commits with one of the following:

* `feat:` A new feature.
* `fix:` A bug fix.
* `docs:` Documentation only changes.
* `style:` Changes that do not affect the meaning of the code (white-space, formatting, etc).
* `refactor:` A code change that neither fixes a bug nor adds a feature.
* `chore:` Routine tasks, pipeline updates, or dependency bumps.

*Example:* `feat: add dragon boss to level 4`

## Merge Request (MR) Process

1. Create your feature branch and push your code.
2. Wait for the CI/CD pipeline to pass and your Ephemeral Preview Environment to spin up.
3. Test your changes thoroughly at your branch's internal `.apps.internal.garflak.com` URL.
4. Open a Merge Request against the `main` branch.
5. Include a link to your live preview environment in the MR description so reviewers can easily test your changes.
6. Once approved, squash and merge your commits.
7. **Important:** Ensure the source branch is deleted upon merging so ArgoCD can clean up the cluster resources.
