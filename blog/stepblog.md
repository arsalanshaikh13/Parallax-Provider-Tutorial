## Step-by-Step Method: Connect GitHub Repository to GitLab CI/CD (Free Tier)

1. **Create a New Project in GitLab**
   - Log in to your GitLab account.
   - Click **New Project**.

2. **Select GitHub as Source**
   - From the options, choose **GitHub** to import your repository.

3. **Authenticate GitHub Access**
   - Enter your **GitHub Personal Access Token (PAT)** when prompted.
   - This authenticates GitLab with GitHub so it can fetch your repositories.

4. **Choose the Repository to Connect**
   - Select the GitHub repository you want to use.
   - GitLab will now create a project linked to that repository.

5. **Verify the Project in GitLab**
   - The imported repository will now appear under **Projects** in **Personal**
     tab in GitLab.

6. **Push Commits to GitHub**
   - After setup, when you push new commits to GitHub, you might expect GitLab
     CI/CD pipelines to start automatically. But first you have to mirror your
     github repository with gitlab

## Challenges & Limitations When Using GitHub with GitLab CI/CD (Free Tier)

### 1. Plot Twist: Repository-Based Pipelines

- GitLab CI/CD pipelines are **repository-based**, similar to GitHub Actions.
- This means:
  - GitLab must have the **same commit history** as GitHub.
  - Both repositories need to match in number and order of commits.

- To achieve this, the GitLab repository must be **mirrored** with the GitHub
  repository.
- Mirroring setup steps (reference):
  - Navigate to: **Project → Settings → Repository → Mirror Repositories**
  - Follow the [YouTube guide](https://www.youtube.com/watch?v=E4Y6A1HplWc) or
    GitLab documentation.

### 2. Free Tier Limitation in GitLab

- GitLab supports two types of mirroring:
  - **Push mirroring** → GitLab pushes code to an external repository (e.g.,
    GitHub).
  - **Pull mirroring** → GitLab pulls code from an external repository (e.g.,
    GitHub).

- On the **Free plan**, only **push mirroring** is available.
- For GitHub to act as the source of truth, **pull mirroring** is required.
- Since pull mirroring is disabled, GitLab cannot automatically fetch new
  commits from GitHub.

### 3. Webhook Failure in GitHub

- After connecting GitHub with GitLab, a **webhook** appears in your GitHub
  repository:
  - Navigate to: **GitHub → Settings → Webhooks**

- This webhook is designed to notify GitLab of new pushes.
- However, it fails with the error: **“repository is not mirrored.”**
- Reason for failure:
  - GitLab Free tier only allows **push mirroring**.
  - What’s needed is **pull mirroring**, which is not supported in the free
    plan.

11. **Current State**
    - At the time of project creation, GitLab **does contain the same content**
      as GitHub.
    - However, GitLab will **not receive new commits** from GitHub after that.

---

---

## Solution: Triggering GitLab Pipeline from GitHub Actions

Since GitLab Free tier does not allow **pull mirroring**, we can bypass this
limitation by triggering GitLab pipelines directly from GitHub using Github
Actions workflow.

**Bonus Tip**

- With this setup, you can trigger GitLab pipelines from **any branch** or **any
  tag** in GitHub by adjusting the `branches` and `tags` filters in your
  workflow.

### Steps

1. **Remove the GitHub Webhook**
   - Go to your **GitHub repository → Settings → Webhooks**.
   - Delete the automatically created GitLab webhook (it won’t work in Free
     tier).

2. **Use GitHub Actions to Trigger GitLab CI**
   - Instead of relying on GitLab pull mirroring, we will trigger GitLab
     pipelines by making an **API request** from GitHub Actions to GitLab.

3. **Create a Workflow File in GitHub**
   - Add a new file in your repository:

     ```
     .github/workflows/gitlab-trigger.yml
     ```

4. **Add the Following Workflow Configuration**

```yaml
name: Sync and Trigger GitLab CI

on:
  workflow_dispatch: # Manually trigger GitLab pipeline from GitHub Actions
  push: # Trigger GitLab pipeline on push
    branches:
      - gitlabci # Replace with your branch name
    tags:
      - 'v*-gitlabci.*' # Replace with your tag pattern if needed

jobs:
  trigger:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout GitHub repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 5 # Fetch last 5 commits to avoid shallow clone issues

      - name: Push to GitLab and Trigger GitLab Pipeline
        run: bash ./ci-scripts/gitlab-sync-and-trigger.sh
        env:
          GITLAB_TRIGGER_TOKEN: ${{ secrets.GITLAB_TRIGGER_TOKEN }} # GitLab pipeline trigger token
          GITLAB_PUSH_TOKEN: ${{ secrets.GITLAB_PUSH_TOKEN }} # GitLab PAT with api, read/write repository
          GITLAB_PROJECT_ID: ${{ secrets.GITLAB_PROJECT_ID }}
          GITLAB_BRANCH: ${{ secrets.GITLAB_BRANCH }}
```

---

---

# Step-by-step explanation (point-by-point)

- **What it is:** a GitHub Actions workflow named **"Sync and Trigger GitLab
  CI"** that syncs code and triggers a GitLab pipeline.

- **Triggers (`on:`):**
  - `workflow_dispatch` — allows **manual** runs from the Actions UI.
  - `push` — runs automatically on pushes that match the filters:
    - `branches: - gitlabci` → only when the `gitlabci` branch (replaceable) is
      pushed.
    - `tags: - 'v*-gitlabci.*'` → only when tags matching that pattern are
      pushed.

- **Job (`jobs.trigger`):**
  - Runs a single job named `trigger`.
  - `runs-on: ubuntu-latest` → uses an Ubuntu runner.

- **Step 1 — Checkout repository:**
  - Uses `actions/checkout@v4` to clone the repo.
  - `fetch-depth: 5` → fetches the last 5 commits (avoids shallow-clone
    problems; increase or set to `0` for a full clone if needed).

- **Step 2 — Run sync & trigger script:**
  - Executes `bash ./ci-scripts/gitlab-sync-and-trigger.sh`.
  - That script is expected to: push commits to GitLab to sync with github repo
    and make API request to create and start the CI pipeline in gitlab

- **Environment variables (provided from GitHub Secrets):**
  - `GITLAB_TRIGGER_TOKEN` → GitLab pipeline trigger token (used to call the
    pipeline trigger API).
  - `GITLAB_PUSH_TOKEN` → GitLab personal access token (PAT) with `api`,
    `read_repository`, `write_repository` scopes (used to push/sync).
  - `GITLAB_PROJECT_ID` → numeric GitLab project ID to target.
  - `GITLAB_BRANCH` → target branch name in GitLab to push to / trigger.

- **Security note:** all tokens/IDs are injected from `secrets` (do **not**
  hardcode them in the repo).

- **Behavior summary (flow):**
  - Manual or qualifying push → GitHub Actions runs → repo is checked out →
    script uses the tokens to push/sync to GitLab and then triggers the pipeline
    for the specified project/branch.

- **Config tips / quick tweaks:**
  - Change the `branches`/`tags` filters to match your workflow.
  - Increase `fetch-depth` if your sync script needs older commit history.
  - Ensure the referenced secrets are set in **GitHub → Repo → Settings →
    Secrets and variables → Actions**.

## Setting Up GitHub Secrets for GitLab Integration

To make the GitHub → GitLab pipeline trigger work, you need to configure three
secrets in your GitHub repository:

---

### 1. `GITLAB_PUSH_TOKEN`

- **Create a Personal Access Token in GitLab:**
  1. Go to: **GitLab → Your Avatar (top-right) → Edit Profile → Access Tokens**
  2. Click **Add New Token**
  3. Enable scopes:
     - `api`
     - `read_repository`
     - `write_repository`

  4. Save the generated token.

- **Store in GitHub Secrets:**
  1. Go to: **GitHub → Your Repo → Settings → Secrets and Variables → Actions**
  2. Click **New Repository Secret**
  3. Name it: `GITLAB_PUSH_TOKEN`
  4. Paste the GitLab token.

---

### 2. `GITLAB_TRIGGER_TOKEN`

- **Create a Pipeline Trigger Token in GitLab:**
  1. Go to: **GitLab → Your Project → Settings → CI/CD → Pipeline Trigger
     Tokens**
  2. Click **Add New Token**
  3. Copy the generated token.

- **Store in GitHub Secrets:**
  1. Go to: **GitHub → Your Repo → Settings → Secrets and Variables → Actions**
  2. Click **New Repository Secret**
  3. Name it: `GITLAB_TRIGGER_TOKEN`
  4. Paste the GitLab trigger token.

---

### 3. `GITLAB_PROJECT_ID`

- **Find Project ID in GitLab:**
  1. Go to: **GitLab → Your Project → Settings → General**
  2. Copy the **Project ID** shown at the top.

- **Store in GitHub Secrets:**
  1. Go to: **GitHub → Your Repo → Settings → Secrets and Variables → Actions**
  2. Click **New Repository Secret**
  3. Name it: `GITLAB_PROJECT_ID`
  4. Paste the project ID value.

---

👉 After this setup, your GitHub Actions workflow will have secure access to
trigger GitLab pipelines.

---

### 1. Shebang and Safety Settings

```bash
#!/usr/bin/env bash
set -e
```

- `#!/usr/bin/env bash` → ensures the script runs using Bash.
- `set -e` → exits the script immediately if any command fails (prevents partial
  execution).

---

### 2. Add GitLab Remote

```bash
git remote add gitlab "https://oauth2:${GITLAB_PUSH_TOKEN}@gitlab.com/arsalanshaikh13/Parallax-Provider-Tutorial.git"
```

- Adds a new Git remote called `gitlab`.
- Uses the `GITLAB_PUSH_TOKEN` for authentication.
- This remote allows pushing commits from GitHub to GitLab.
- since we are doing this in github actions this step is always required to
  setup connection with gitlab and push commits to gitlab

---

### 3. Capture Previous Commit SHA

```bash
PREVIOUS_COMMIT=$(git rev-parse HEAD~1)
echo "COMMIT_BEFORE_SHA: $PREVIOUS_COMMIT"
```

- Stores the SHA of the previous commit (`HEAD~1`) in `PREVIOUS_COMMIT`.
- This is later sent to GitLab as a pipeline variable for tracking.

---

### 4. Check if Current Ref is a Tag

```bash
if [[ "$GITHUB_REF_TYPE" == "tag" ]]; then
```

- Detects if the GitHub event was triggered by a **tag**.

---

### 5. Handle Tag Push

```bash
echo "tag found"
echo "Waiting for GitLab to register the tag..."
LATEST_TAG="${GITHUB_REF#refs/tags/}"
git push gitlab $LATEST_TAG
sleep 2
```

- Extracts the tag name from `GITHUB_REF`.
- Pushes the tag to GitLab.
- Waits 2 seconds to ensure GitLab registers the tag.

---

### 6. Trigger GitLab Pipeline for Tag

```bash
curl  --request POST \
    --form token=${GITLAB_TRIGGER_TOKEN} \
    --form ref=$LATEST_TAG \
    --form "variables[CI_COMMIT_BEFORE_SHA]=${PREVIOUS_COMMIT}" \
    "https://gitlab.com/api/v4/projects/${GITLAB_PROJECT_ID}/trigger/pipeline"
```

- Calls the **GitLab pipeline trigger API**.
- Parameters sent:
  - `token` → pipeline trigger token.
  - `ref` → the tag to run the pipeline on.
  - `variables[CI_COMMIT_BEFORE_SHA]` → previous commit SHA.

---

### 7. Handle Branch Push

```bash
else
    echo "No tags found"
    echo "Pushing latest commit from GitHub to GitLab..."
    git push --force gitlab HEAD:${GITLAB_BRANCH}
```

- If no tag is found, it assumes this is a branch update.
- Pushes the latest commit from GitHub to the corresponding GitLab branch.
- The `--force` flag ensures the GitLab branch exactly mirrors GitHub’s branch.
  This is crucial because:
  - It allows easy rollbacks and resets when needed in our project workflow.
  - Since GitHub is the source of truth, we don’t have to worry about GitLab’s
    commit history.
  - Without `--force`, GitLab would reject the push if the branch already
    contains commits that haven’t been fetched locally.

---

### 8. Trigger GitLab Pipeline for Branch

```bash
echo "Triggering Gitlab pipeline on branch push..."
curl  --request POST \
    --form token=${GITLAB_TRIGGER_TOKEN} \
    --form ref=${GITLAB_BRANCH} \
    --form "variables[CI_COMMIT_BEFORE_SHA]=${PREVIOUS_COMMIT}" \
    "https://gitlab.com/api/v4/projects/${GITLAB_PROJECT_ID}/trigger/pipeline"
```

- Calls GitLab API to trigger a pipeline for the branch push.
- Sends the same `CI_COMMIT_BEFORE_SHA` variable to track the previous commit.

---

### 9. Summary of Behavior

- Script **syncs GitHub commits/tags to GitLab**.
- Triggers **GitLab pipelines automatically** using the API.
- Works for both **tags and branches**.
- Uses environment variables:
  - `GITLAB_PUSH_TOKEN` → authenticate push
  - `GITLAB_TRIGGER_TOKEN` → trigger pipeline
  - `GITLAB_PROJECT_ID` → project target
  - `GITLAB_BRANCH` → branch target

---
