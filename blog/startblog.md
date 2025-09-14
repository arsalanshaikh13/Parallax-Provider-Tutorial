# Run CircleCI Pipelines on Any GitHub Branch or Tag (Hands-On Guide)

_Want to run circleci ci/cd pipeline only from pushing specific branches and
tags, This comprehensive guide shows you exactly how to set up this integration_

### The Benefits You’ll Get From This

- **Precision control** – Run pipelines on any specific branches, tags, or even
  files that matter - avoiding running pipelines on every push and only on
  default branch.
- **Hybrid workflows** – Use CircleCI for select branches while letting GitHub
  Actions (or other CI/CD tools) handle the other branches.
- **Save time & resources** – Prevent unnecessary runs that waste CI/CD minutes
  and compute resources.
- **Stay organized** – Avoid cluttered pipelines and easily track which
  pipelines runs map to which events.

## Prerequisite Knowledge

- GitHub Actions + CircleCI basics
- YAML familiarity
- Shell scripting knowledge
- Git fundamentals (commits, branches, diffs)

## Quick Setup Overview

Here’s what we’ll build:

1. Import your GitHub repo into CircleCI
2. Set up CircleCI tokens and GitHub secrets
3. Configure a GitHub Actions workflow that triggers CircleCI via API
4. Handle **both** branch pushes and tag releases

## Step 1: Create Your CircleCI Project using this [link](https://circleci.com/blog/setting-up-continuous-integration-with-github/)

## Step 2: The Default Problem

- By default, CircleCI runs pipelines on **every push** to the GitHub
  repository.
- No option to restrict triggers to specific branches or tags.
- Pipelines get cluttered, making it harder to track which pipeline run
  corresponds to which push.
- No control to run pipelines only for certain modified files.
- Unnecessary pipeline runs, wasting CI/CD minutes and compute resources.

## Step 3: The Solution — GitHub Actions as a Smart Trigger

Instead of relying on webhook request on every push event, we'll use GitHub
Actions to:

- Trigger CircleCi CI/CD pipelines via API

## Step 4: Remove CircleCI Webhook

1. Go to your **GitHub repository → Settings → Webhooks**
2. **Delete the CircleCI webhook** that was automatically created so no webhook
   request will be sent from now onwards on any push to github repository

## Step 5: Generate a CircleCI Token

1. Go to **CircleCI → Avatar → User Settings → Personal API Tokens**
2. Click **Add New Token**
3. Save the token securely (needed for GitHub Secrets).

## Step 6: Configure GitHub Secrets

Now let's securely store these tokens in GitHub:

1. Go to: **GitHub → Your Repo → Settings → Secrets and Variables → Actions →
   new Repository Secrets **
2. **Add the secrets:**

| Secret Name      | Value                               | Description                   |
| ---------------- | ----------------------------------- | ----------------------------- |
| `CIRCLECI_TOKEN` | Your CircleCI Personal Access Token | Used to start CI/CD pipelines |

## Step 7: Create the GitHub Actions Workflow

Create this file in your GitHub repository:

**`.github/workflows/circleci-trigger.yml`**

```yml
# The name of the workflow as it will appear in the GitHub Actions UI.
name: Trigger CircleCI from GitHub

on:
  # run CircleCI pipeline push event to branch or tags
  push:
    branches:
      - circleci # Change to your branch name.
    tags:
      - 'v*-circleci.*' # Change to your branch name
  # Add any condition or events to control triggering of the CircleCI CI/CD pipelines

jobs:
  trigger-circleci:
    # Specifies the type of runner to use for the job.
    runs-on: ubuntu-latest
    steps:
      - name: Trigger CircleCI pipeline
        run: |
          # Prints the GitHub reference information for logging purposes.
          echo "GitHub Ref: $GITHUB_REF"
          echo "GitHub Ref Type: $GITHUB_REF_TYPE"

          # An 'if' condition checks if the workflow was triggered by a tag.
          if [[ "$GITHUB_REF_TYPE" == "tag" ]]; then
            # Extracts the tag name from the full reference string.
            TAG_NAME="${GITHUB_REF#refs/tags/}"
            echo "Triggering CircleCI on tag: $TAG_NAME"
            # The 'curl' command makes an API call to the CircleCI API to start a new pipeline.
            # It sends the tag name in the request body.
            curl -X POST https://circleci.com/api/v2/project/gh/arsalanshaikh13/Parallax-Provider-Tutorial/pipeline \
              --header "Circle-Token: $CIRCLECI_TOKEN" \
              --header "Content-Type: application/json" \
              --data "{\"tag\": \"${TAG_NAME}\"}"
          # The 'else' block handles triggers from a branch push.
          else
            # Extracts the branch name from the full reference string.
            BRANCH_NAME="${GITHUB_REF#refs/heads/}"
            echo "Triggering CircleCI on branch: $BRANCH_NAME"
            # Makes an API call to CircleCI, sending the branch name in the request body.
            curl -X POST https://circleci.com/api/v2/project/gh/arsalanshaikh13/Parallax-Provider-Tutorial/pipeline \
              --header "Circle-Token: $CIRCLECI_TOKEN" \
              --header "Content-Type: application/json" \
              --data "{\"branch\": \"${BRANCH_NAME}\"}"
          fi
        env:
          # Sets an environment variable for the CircleCI token, which is sourced from a GitHub secret.
          CIRCLECI_TOKEN: ${{ secrets.CIRCLECI_TOKEN }}
```

### Here’s a clear, point-to-point walkthrough of what the workflow does:

- **Workflow name**
  - `name: Trigger CircleCI from GitHub` — label shown in the Github Actions UI.

- **When it runs (`on:`)**
  - `push` events.
  - **Branches:** runs when pushing to `circleci` (you can change this).
  - **Tags:** runs when pushing tags matching `v*-circleci.*` (you can change
    this).
  - Add any condition or events to control triggering of the CircleCI CI/CD
    pipelines

- **Job definition**
  - Single job: `trigger-circleci`.
  - Executes on `ubuntu-latest` GitHub-hosted runner.

- **Step: Trigger CircleCI pipeline**
  - Prints context for debugging:
    - `GITHUB_REF` (full ref, e.g., `refs/heads/circleci` or
      `refs/tags/v1.2.3-circleci.0`)
    - `GITHUB_REF_TYPE` (`branch` or `tag`)

  - **If the push is a tag:**
    - Extracts the tag name: `TAG_NAME="${GITHUB_REF#refs/tags/}"`.
    - Logs which tag will be triggered.
    - Calls CircleCI Pipelines API v2:
      - `POST https://circleci.com/api/v2/project/gh/arsalanshaikh13/Parallax-Provider-Tutorial/pipeline`
      - Headers: `Circle-Token: $CIRCLECI_TOKEN`,
        `Content-Type: application/json`
      - Body: `{"tag":"<TAG_NAME>"}`
      - Result: starts a CircleCI pipeline for that **tag**.

  - **Else (the push is a branch):**
    - Extracts the branch name: `BRANCH_NAME="${GITHUB_REF#refs/heads/}"`.
    - Logs which branch will be triggered.
    - Calls the same CircleCI API:
      - Body: `{"branch":"<BRANCH_NAME>"}`
      - Result: starts a CircleCI pipeline for that **branch**.

- **Authentication**
  - `CIRCLECI_TOKEN` is provided via GitHub Actions secrets:
    - `env: CIRCLECI_TOKEN: ${{ secrets.CIRCLECI_TOKEN }}`

  - CircleCI uses this token to authorize the API request.

- **Target project on CircleCI**
  - The API path `project/gh/arsalanshaikh13/Parallax-Provider-Tutorial`
    specifies:
    - VCS provider: `gh` (GitHub)
    - Owner: `arsalanshaikh13`
    - Repo: `Parallax-Provider-Tutorial`

- **Net effect**
  - Any qualifying push (branch/tag) to GitHub **triggers** a corresponding
    **CircleCI pipeline** for that branch or tag.

## Step 8: Test Your Setup

1. **Make a commit** to your configured branch
2. **Push to GitHub**
3. **Check GitHub Actions** to see the workflow run
4. **Check CircleCI** to see the pipeline start

### Common Issues:

**Project not found:**

- Verify your `CIRCLECI_TOKEN`
- Never use project API token which only supports API v1,
- Use personal Access token which supports API v2 to make API requests.

**Pipeline running twice on same push**

- Webhook might be present in github repository which sends request on every
  push
- delete the webhook from the your github repository settings

## Conclusion

With this setup, you now have:

- GitHub as **source of truth for code**
- CircleCI as your **CI/CD engine**
- Precise **control over triggers** (branches + tags)
- **Resource efficiency** Prevent unnecessary runs, saving CI/CD minutes and
  compute power.

Enjoy GitHub’s collaboration + CircleCI’s pipelines — without wasting cycles.

_Next up: how to modularize CircleCI pipelines with parent/child workflows that
run only for specific changed files._

## References

- [Setting up continuous integration with GitHub and CircleCI](https://circleci.com/blog/setting-up-continuous-integration-with-github/)
- [How to Trigger a Workflow via CircleCI API v2](https://support.circleci.com/hc/en-us/articles/360050351292-How-to-Trigger-a-Workflow-via-CircleCI-API-v2)
