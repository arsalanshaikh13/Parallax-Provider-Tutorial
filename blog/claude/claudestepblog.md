# How to Run GitLab CI/CD Directly from Your GitHub Repo : A Hands-On Guide

_Want to use GitLab's powerful CI/CD features while keeping your code on GitHub?
This comprehensive guide shows you exactly how to set up this integration, even
with GitLab's free tier limitations._

The challenge? GitLab's free tier has some limitations that make the standard
integration tricky. But don't worry—we've got a clever workaround!

### Why this matters and what benefit will you get:

- No need to manage commit history on GitLab—use it solely for CI/CD purposes.
- Maintain full control over when pipelines are triggered, rather than running
  on every GitHub push.
- Trigger pipelines on any specific branches or tags, not just the default
  branch.
- Rollbacks, resets, and force pushes doesn't affect pipeline runs. 
- Isolate pipeline execution to select branches, while other branches can
  continue using GitHub Actions or any alternative CI/CD tool to run pipelines.
- Customize and extend with ease.
- Leverage advanced GitLab CI/CD features for free while keeping your repository
  on GitHub.

## Quick Setup Overview

Here's what we'll accomplish:

1. Import your GitHub repo into GitLab
2. Set up secure tokens and secrets
3. Create a GitHub Actions workflow that syncs code and triggers GitLab
   pipelines through API request
4. Handle both branch pushes and tag releases

Let's dive in!

## Step 1: Create Your GitLab Project

First, let's get your GitHub repository into GitLab:

1. **Connect Repository in gitlab**: New Project -> Run CI/CD from external
   repository -> Connect Repository: Github
2. **Authenticate Gitlab** using your Github Personal Access Token (PAT)
3. **Choose your repository** from the list to connect
4. **Verify the import** - your repo should now appear in GitLab under
   "Projects" in "Personal" tab

_Pro tip: The initial import copies all your code, but that's where the
automatic sync stops with the free tier._

## Step 2: The Free Tier Challenge (And Our Solution!)

Here's where things get interesting. GitLab's free tier has a limitation that
affects GitHub integration:

### The Problem

- GitLab CI/CD pipelines are **repository-based**, similar to GitHub Actions.
- **GitLab needs "pull mirroring"** to automatically fetch new commits from
  GitHub
- **Free tier only supports "push mirroring"** where GitLab pushes commits to an
  external repository
- **The GitHub webhook fails** with "repository is not mirrored" error
- This makes it impossible to run Gitlab CI from github for free user

### Our Solution: GitHub Actions to the Rescue!

Instead of relying on GitLab's mirroring, we'll use GitHub Actions to:

1. Push new commits to GitLab
2. Trigger GitLab CI/CD pipelines via API

This approach actually gives you more control and works perfectly with the free
tier!

## Step 3: Clean Up and Prepare

### Remove the Failing Webhook

1. Go to your **GitHub repository → Settings → Webhooks**
2. **Delete the GitLab webhook** that was automatically created (it won't work
   with free tier)

## Step 4: Set Up GitLab Tokens

You'll need two types of tokens from GitLab:

### Token #1: Personal Access Token (for pushing code)

1. **Navigate to:** GitLab → Your Avatar → Edit Profile → Access Tokens
2. **Click "Add New Token"**
3. **Enable these scopes:**
   - `api`
   - `read_repository`
   - `write_repository`
4. **Save the generated token** - you'll need it for GitHub secrets

### Token #2: Pipeline Trigger Token (for triggering CI/CD)

1. **Navigate to:** GitLab → Your Project → Settings → CI/CD → Pipeline Trigger
   Tokens
2. **Click "Add New Token"**
3. **Copy the generated token**

### Get Your Project ID

1. **Navigate to:** GitLab → Your Project → Settings → General
2. **Copy the Project ID** (it's a number at the top of the page)

### Important permission to use variables in gitlab pipeline

1. **Navigate to:** GitLab → Your Project → Settings → CI/CD → Variables
2. **Click "minimum role to use variables"**:
3. **Select Owner**

## Step 5: Configure GitHub Secrets

Now let's securely store these tokens in GitHub:

1. **Go to:** GitHub → Your Repo → Settings → Secrets and Variables → Actions → new Repository Secrets 
2. **Add these secrets:**

| Secret Name            | Value                              | Description                                |
| ---------------------- | ---------------------------------- | ------------------------------------------ |
| `GITLAB_PUSH_TOKEN`    | Your GitLab Personal Access Token  | Used to push code to GitLab                |
| `GITLAB_TRIGGER_TOKEN` | Your GitLab Pipeline Trigger Token | Used to start CI/CD pipelines              |
| `GITLAB_PROJECT_ID`    | Your GitLab Project ID             | Required in API url                        |
| `GITLAB_BRANCH`        | Your specific any github branch    | Send the branch name as ref in API request |

## Step 6: Create the GitHub Actions Workflow

Create this file in your GitHub repository:

**`.github/workflows/gitlab-trigger.yml`**

```yaml
name: Sync and Trigger GitLab CI

on:
  push:
    branches:
      - gitlabci # Change to your branch name
    tags:
      - 'v*' # Trigger on version tags

jobs:
  trigger:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout GitHub repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 5

      - name: Push to GitLab and Trigger Pipeline
        run: |
          chmod +x ci-scripts/gitlab-sync-and-trigger.sh # make the script executable
          bash ./ci-scripts/gitlab-sync-and-trigger.sh # run script using bash
        env:
          GITLAB_TRIGGER_TOKEN: ${{ secrets.GITLAB_TRIGGER_TOKEN }}
          GITLAB_PUSH_TOKEN: ${{ secrets.GITLAB_PUSH_TOKEN }}
          GITLAB_PROJECT_ID: ${{ secrets.GITLAB_PROJECT_ID }}
          GITLAB_BRANCH: ${{ secrets.GITLAB_BRANCH || github.ref_name }}
```

**Why set `fetch-depth`?**

Set `fetch-depth: 5` to include previous commits for proper syncing with GitLab.
This is important because:

- **Provides a buffer for failed runs:** Ensures GitLab receives all necessary
  commits even if previous GitHub Actions runs failed.
- **Adjust based on push frequency to avoid shallow commit errors:**
  - Very frequent pushes: `fetch-depth: 2`
  - Frequent pushes: `fetch-depth: 5` (usually sufficient)
  - Less frequent pushes (e.g., 10 commits at a time): `fetch-depth: 10`
  - Whenever there is failed jobs on GitHub Actions it will not send the commits
    to gitlab, so account for that when calculating depth.

- **Ensures `git rev-parse` works** in `gitlab-sync-and-trigger.sh`.

**Notes:**

- If `fetch-depth` is not set, GitHub defaults to `1`, which may cause errors
  like _shallow update is not allowed_.
- Setting `fetch-depth: 0` fetches the entire commit history, which can slow
  down workflows for repositories with long histories.

**Customize the triggers:**

- Change `branches` to match your workflow
- Adjust `tags` pattern for your release strategy


## Step 7: Create the Sync Script

Create the directory and script file:

**`ci-scripts/gitlab-sync-and-trigger.sh`**

```bash
#!/usr/bin/env bash
set -e # fail immediately when error is found

echo "Starting GitHub → GitLab sync and pipeline trigger..."

# Add GitLab remote (replace with your GitLab project URL)
git remote add gitlab "https://oauth2:${GITLAB_PUSH_TOKEN}@gitlab.com/YOUR_USERNAME/YOUR_PROJECT.git"

# Capture previous commit for GitLab pipeline context
PREVIOUS_COMMIT=$(git rev-parse HEAD~1)
echo "Previous commit SHA: $PREVIOUS_COMMIT"

# Handle tags vs branches differently
if [[ "$GITHUB_REF_TYPE" == "tag" ]]; then
    echo "Tag detected"

    # Extract tag name and push to GitLab
    LATEST_TAG="${GITHUB_REF#refs/tags/}"
    echo "Pushing tag '$LATEST_TAG' to GitLab..."
    git push gitlab $LATEST_TAG

    # Wait for GitLab to register the tag
    sleep 2

    # Trigger GitLab pipeline for the tag
    echo "Triggering GitLab pipeline for tag '$LATEST_TAG'..."
    curl --request POST \
        --form token=${GITLAB_TRIGGER_TOKEN} \
        --form ref=$LATEST_TAG \
        --form "variables[CI_COMMIT_BEFORE_SHA]=${PREVIOUS_COMMIT}" \
        "https://gitlab.com/api/v4/projects/${GITLAB_PROJECT_ID}/trigger/pipeline"

else
    echo "Branch push detected"

    # Push latest commits to GitLab (force to ensure sync)
    echo "Pushing commits to GitLab branch '$GITLAB_BRANCH'..."
    git push --force gitlab HEAD:${GITLAB_BRANCH}

    # Trigger GitLab pipeline for the branch
    echo "Triggering GitLab pipeline for branch '$GITLAB_BRANCH'..."
    curl --request POST \
        --form token=${GITLAB_TRIGGER_TOKEN} \
        --form ref=${GITLAB_BRANCH} \
        --form "variables[CI_COMMIT_BEFORE_SHA]=${PREVIOUS_COMMIT}" \
        "https://gitlab.com/api/v4/projects/${GITLAB_PROJECT_ID}/trigger/pipeline"
fi

echo "Sync and trigger completed!"
```

**Important:** Replace `YOUR_USERNAME/YOUR_PROJECT` with your actual GitLab
project path.

**Here's how it works**

- Add GitLab as a remote using `GITLAB_PUSH_TOKEN` for authentication.
- Store the previous commit SHA from `git rev-parse` in the variable
  `PREVIOUS_COMMIT`.
- Check if the current Git ref is a **tag**.
- If a tag is found:
  - Store it in `LATEST_TAG`.
  - Push the tag to GitLab and wait 2 seconds to ensure registration.
  - Trigger the GitLab pipeline via a `curl` POST request using
    `GITLAB_TRIGGER_TOKEN` as the token, `LATEST_TAG` as the ref,
    `PREVIOUS_COMMIT` as a variable, and include `GITLAB_PROJECT_ID` in the API
    URL.

- If no tag is found:
  - Force-push the branch commits to GitLab to ensure it mirrors GitHub.
  - Trigger the GitLab pipeline via a `curl` POST request using
    `GITLAB_TRIGGER_TOKEN` as the token, `GITLAB_BRANCH` as the ref,
    `PREVIOUS_COMMIT` as a variable, and include `GITLAB_PROJECT_ID` in the API
    URL.
- **GitLab runs your CI/CD** with the latest code

**Why Use `--force` Flag?**

You might wonder about the `--force` flag in our script. Here's why it's
necessary:

- **GitHub is our source of truth** - we want GitLab to exactly match it
- **Enables easy rollbacks** when needed
- **Prevents conflicts** when GitLab has commits that weren't synced
- **Simplifies the workflow** since we don't need to worry about GitLab's commit
  history

Since we're treating GitLab purely as a CI/CD platform (not a collaboration
platform), this approach is both safe and efficient.

## Step 8: Test Your Setup

1. **Make a commit** to your configured branch
2. **Push to GitHub**
3. **Check GitHub Actions** to see the workflow run
4. **Check GitLab** to see the pipeline start

## Troubleshooting

### Common Issues:

**"Repository is not mirrored" error:**

- This is expected with free tier
- Our GitHub Actions solution bypasses this limitation

**Pipeline doesn't trigger:**

- Verify your `GITLAB_TRIGGER_TOKEN` is correct
- Ensure the branch/tag exists in GitLab after the sync

**Not Enough Permissions to set pipeline variables:**

- Default Minimum role to set variables is no one allowed
- Your gitlab project -> settings -> CI/CD -> variables -> minimum role to set
  variables: Owner

**Authentication errors:**

- Verify your `GITLAB_PUSH_TOKEN` has the right scopes
- Check that the GitLab project URL in the script is correct

**Script permission denied:**

- Make sure you ran `chmod +x` on the script
- Verify the script path in your workflow file

### How to run jobs in Gitlab:

- Create a `.gitlab-ci.yml` file in your repository to define all the
  jobs/workflows to run on your GitLab pipelines in the syntax understood by the
  gitlab
- Use GitLab environments and variables for execution and monitoring of jobs
- if no rules are set regarding the pipeline then jobs/workflows will run fine
- if you want to set rules regarding pipeline then follow this snippet

```yml
rules:
  - if: $CI_PIPELINE_SOURCE == "trigger"'
```

## Conclusion

With this setup, you now have:

- **GitHub as your source of truth** for code
- **GitLab CI/CD** for your build and deployment pipelines
- **Automatic synchronization** between both platforms
- **Flexible triggering** for different branches and tags

You can now focus on writing great code in GitHub while leveraging GitLab's
powerful CI/CD features for free!

_Happy coding! With this setup, you get the best of both worlds: GitHub's
excellent collaboration features and GitLab's powerful CI/CD capabilities._

In the next blog i will discuss the implementation guide of how to modularize
gitlab ci/cd pipeline and run parent / child pipeline which runs only specific
changed files

## Prerequisite Knowledge

- Basic understanding of Github Actions and GitLab CI/CD concepts (stages, jobs,
  artifacts)
- Familiarity with YAML syntax and structure
- Basic shell scripting knowledge
- Git workflow understanding (commits, branches, diffs)

## citations

- [YouTube guide for mirroring](https://www.youtube.com/watch?v=E4Y6A1HplWc)
- [Gitlab docs for api trigger](https://docs.gitlab.com/ci/triggers/)
