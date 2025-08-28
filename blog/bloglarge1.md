Great 🚀 Let’s flesh out **Part 1: Modular Architecture** into a polished,
blog-style draft. This will set the tone for your series and also work as a
standalone article for your portfolio.

---

# 🧩 How I Built a Modular GitHub Actions Pipeline (Part 1: Architecture)

### TL;DR

If your GitHub Actions workflow is a **150-line YAML monster** that tries to do
everything in one place… you’re not alone. In this guide, I’ll show you how to
split it into **modular pieces**—parent workflows, reusable workflows, and
composite actions—so your CI/CD feels more like Lego blocks than spaghetti code.

---

## 💡 Why Modular Workflows Matter

Think of your CI/CD pipeline like building a house.

- A **monolithic workflow** is like trying to pour the foundation, install
  plumbing, paint the walls, and decorate—all in one step. Messy, error-prone,
  hard to debug.
- A **modular workflow** is like having contractors: one team lays the
  foundation, another handles wiring, another paints. Each does their job, and
  the architect (parent workflow) orchestrates it all.

Benefits:

- **Maintainability** → fix one piece without breaking the others.
- **Reusability** → share common steps across projects.
- **Scalability** → add new features (like coverage reports or artifact
  handling) without rewriting your CI from scratch.

---

#### Folder Layout

```
- .github
  - actions                       # contains all the composite actions
    - publish
      - action.yml
    - test_and_build
      - action.yml
  - workflows                     # contains all the reusable workflow that uses actions
    - ci.yml                      # parent caller workflow that uses reusable workflows
    - filter-changes.yml
    - publish.yml
    - test_and_build.yml
```

## 🏗️ Parent Workflow: The Orchestrator

The **parent workflow** is your conductor—it decides when and how the
“instruments” (child workflows) play.

Here’s a simple example:

```yaml
# .github/workflows/ci.yml
# A friendly, descriptive name for the workflow.
name: Build, Test and Publish

# Defines when the workflow will run.
on:
  # The 'pull_request' event triggers the workflow whenever a pull request is opened or updated on the 'main' branch.
  pull_request:
    branches:
      - main
  # The 'push' event triggers the workflow when code is pushed to the 'main' branch or when a new version tag is pushed.
  push:
    branches:
      - main

# This is where the workflow's jobs are defined.
jobs:
  # This job checks for relevant code changes to avoid unnecessary runs on non-code changes.
  filter-changes:
    uses: ./.github/workflows/filter-changes.yml

  # This job runs tests and builds the project.
  test-and-build:
    # Grants necessary permissions for the test_and_build job to write on test coverage on Pull request as per artiomTr/ documenation.
    # https://github.com/ArtiomTr/jest-coverage-report-action?tab=readme-ov-file#pull-request-number
    permissions:
      checks: write
      pull-requests: write
      contents: write
    # The 'needs' keyword ensures this job only runs after the 'filter-changes' job is complete.
    needs: filter-changes
    # This 'if' condition checks the output from the previous job to determine if this job should run.
    if: needs.filter-changes.outputs.has_relevant_changes == 'true'
    # Reuses a separate workflow file for the test and build logic.
    uses: ./.github/workflows/test_and_build.yml
    # passing the secrets into reusable workflow
    secrets:
      secret_GITHUB_TOKEN: ${{secrets.GITHUB_TOKEN}}
```

🔍 What’s happening here?

- The parent workflow runs a **filter-changes** job.
- If relevant files changes then filter-changes output is true which allows now
  to run the `test-and-build` job.
- If relevant files have not changed filter-changes output is false, so all the
  test_and_build job is skipped.
- we will talk about
- secrets is being passed to test_and_build job under secrets key
- permissions grant the write permission for checks, pull-requests and contents
  in order to publish jest coverage on Pull request

---

## 🔁 Reusable Workflows

A **reusable workflow** is basically a packaged pipeline you can call from
multiple repos or multiple places in the same repo.

Example: the filter-change.yml file which has logic to detect changes to
relevant files

```yaml
# .github/workflows/filter-changes.yml
# A short and descriptive name for the workflow.
name: Filter Changes

# This allows the workflow to be called and reused by other workflows.
on:
  workflow_call:
    outputs:
      # Defines a descriptive output to check if relevant files were changed.
      has_relevant_changes:
        description: 'Check whether relevant files changed'
        value: ${{ jobs.filter-changes.outputs.has_relevant_changes }}

# Defines the single job in this workflow.
jobs:
  filter-changes:
    # Specifies the type of runner the job will use.
    runs-on: ubuntu-latest
    outputs:
      # Sets the output value for this job, which is the result from the 'check-changes' step.
      has_relevant_changes: ${{ steps.check-changes.outputs.has_changes }}
    steps:
      - name: Checkout code
        # Uses the 'actions/checkout' action to get a copy of the repository's code.
        uses: actions/checkout@v4
        with:
          # Fetches the entire git history to enable a proper comparison of changes.
          fetch-depth: 0

      - name: Check for relevant file changes
        # Assigns an ID to this step so its output can be referenced later.
        id: check-changes
        run: |
          # The 'set +e' command prevents the script from exiting immediately if a command fails.
          set +e
          # Uses 'git diff' to find the names of files that have changed between the current and previous commit.
          # The output is piped to 'grep' to filter for specific file extensions like .js, .json, etc.
          changed_files=$(git diff --name-only  HEAD^ ${{ github.sha }} 2>&1 | grep -E '\.js$|\.json$|\.yml$|\.lock$|\..*rc$')
          echo $changed_files output
          # An 'if' condition checks if the 'changed_files' variable is not empty.
          if [ -n "$changed_files" ]; then
            echo "Relevant files have been changed."
            # Sets the 'has_changes' output to 'true' if changes are found.
            echo "has_changes=true" >> $GITHUB_OUTPUT
          else
            echo "No relevant files were changed. Skipping subsequent jobs."
            # Sets the 'has_changes' output to 'false' if no relevant changes are found.
            echo "has_changes=false" >> $GITHUB_OUTPUT
          fi
```

🔍 What’s happening here?

- the 'git diff' command is used to find the names of files that have changed
  between the current and previous commit.
- The output is piped to 'grep' command to filter for specific file extensions
  like .js, .json,.yml,.lock etc. since these are the files which are relevant
  to my pipeline.

* why this works?

- the native changes keyword doesn't work well with forced commits

```yaml
# .github/workflows/test_and_build.yml
# A clear and descriptive name for the workflow.
name: Lint, Test, and Build

# This defines the workflow as a reusable workflow that can be called by other workflows.
on:
  workflow_call:
    # Specifies the secrets that must be passed in when this workflow is called.
    secrets:
      secret_GITHUB_TOKEN:
        required: true

# The jobs section defines the work that will be performed by the workflow.
jobs:
  test-and-build:
    # Specifies the runner environment where the job will execute.
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        # Uses the 'actions/checkout' action to clone the repository's code into runner environment.
        uses: actions/checkout@v4

      - name: Setup, install, lint, test and build code
        # This step calls a custom composite action located in the local repository.
        # This promotes code reuse and keeps the main workflow file clean.
        uses: ./.github/actions/test_and_build
        with:
          # Passes the required secret to the reusable action.
          secret_input_github_token: ${{secrets.secret_GITHUB_TOKEN}}
```

🔍 What’s happening here?

- `workflow_call:` keyword defines the workflow as a reusable workflow it is
  necessary to write this keyword in every reusable workflow,
- is running Now the parent can simply say:

```yaml
uses: ./.github/workflows/filter-changes.yml
uses: ./.github/workflows/test_and_build.yml
secrets:
  secret_GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

and you’re good to go 🎉.

Why it matters:

- You define the steps **once**.
- Any repo/project can reuse it.
- Perfect for teams with multiple services following the same build/test
  patterns.

---

## ⚙️ Composite Actions

While reusable workflows group entire pipelines, **composite actions** group
**repeated steps** into a single action.

Example:

```yaml
# .github/actions/test_and_build/action.yml
# A clear name for the reusable workflow.
name: Lint, Test and Build

# Defines the inputs that this reusable workflow accepts.
inputs:
  secret_input_github_token:
    required: true

# Specifies that this is a composite run action, which combines multiple steps into a single reusable action.
runs:
  using: 'composite'
  steps:
    # This step checks for a cached 'node_modules' directory to speed up the workflow.
    - name: Get node_modules
      # The 'actions/cache' action handles caching and restoring files.
      uses: actions/cache@v4
      id: node_modules
      with:
        # The path to the directory that will be cached.
        path: |
          **/node_modules
        # The cache key is generated from the runner's OS, a fixed string, and a hash of the 'yarn.lock' file.
        # This ensures the cache is unique to the dependencies and the runner environment.
        key:
          ${{ runner.os }}-node_modules-${{ hashFiles('**/yarn.lock')
          }}-v18.20.8

    # This step only runs if the cache was not found in the previous step.
    - name: Setup Node.js
      if: steps.node_modules.outputs.cache-hit != 'true'
      # Uses the 'actions/setup-node' action to set up the specified Node.js version.
      uses: actions/setup-node@v4
      with:
        node-version: 18.20.8

    # This step installs the project dependencies using yarn.
    # It also only runs if the cache was not found, as there's no need to install if the cache is restored.
    - name: Install dependencies
      if: steps.node_modules.outputs.cache-hit != 'true'
      run: yarn install  --frozen-lockfile
      shell: bash

    # This step runs the linting check for the code.
    - name: Lint
      run: yarn lint
      shell: bash

    # This step runs the unit tests for the project.
    - name: Test
      run: yarn test
      shell: bash

    # This step runs the build command to create the distributable files.
    - name: Build
      run: yarn build
      shell: bash

    # This action generates a code coverage report and adds it as a comment on the pull request.
    - name: Jest Coverage Comment
      id: coverage
      uses: ArtiomTr/jest-coverage-report-action@v2
      with:
        # Passes the GitHub token to the action for authentication.
        github-token: ${{ inputs.secret_input_github_token }}
        # Specifies that annotations for coverage should be added to all files.
        annotations: all
        # Skips the default install and test steps of this action, as they've already been run.
        skip-step: all
        # Specifies the paths to the Jest coverage files.
        coverage-file: ${{github.workspace}}/coverage/report.json
        base-coverage-file: ${{github.workspace}}/coverage/report.json
        # Defines the output format for the coverage report.
        output: comment, report-markdown
        # Use emojis for the report icons.
        icons: emoji

    # This step adds the coverage report to the job summary for easy viewing in the Actions UI.
    - name: Check the output coverage
      run: |
        echo "TEST RESULTS:" >> $GITHUB_STEP_SUMMARY
        echo "" >> $GITHUB_STEP_SUMMARY
        # The 'cat' command is used with a here-doc to write the report content to the summary.
        cat <<EOF >> "$GITHUB_STEP_SUMMARY"
        ${{ steps.coverage.outputs.report }}
        EOF
      shell: bash
      # Ensures this step runs even if previous steps fail, so you always get the summary.
      if: always()

    # This step uploads the build artifacts (the 'dist' folder) so they can be downloaded and used by other jobs.
    - name: Upload build artifacts (dist/)
      # Uses the 'actions/upload-artifact' action for uploading.
      uses: actions/upload-artifact@v4
      with:
        # Defines the name of the artifact, which will be the name of the zip file.
        name: dist
        # Specifies the path to the files that should be uploaded.
        path: dist/**
        # The workflow will fail if no files are found to upload.
        if-no-files-found: error
        # Sets a retention period for how long the artifact should be kept.
        retention-days: 1 day
```

Usage in workflows:

```yaml
- uses: ./.github/actions/test_and_build
```

Why it matters:

- DRY (don’t repeat yourself).
- Cleaner workflows (less YAML duplication).
- Easier upgrades—update one composite action, and every workflow using it gets
  the fix.

---

## 🧭 Tradeoffs: Reusable vs Composite

| Feature        | Reusable Workflow | Composite Action      |
| -------------- | ----------------- | --------------------- |
| Scope          | Whole jobs        | Steps only            |
| Inputs/Outputs | Supports          | Limited               |
| Best For       | Entire pipelines  | Repeated setup/config |

👉 Pro tip: use **reusable workflows** for big picture (build/test/deploy) and
**composite actions** for boilerplate steps (setup/cache).

---

## ✅ Recap

In this part, we learned:

- Why modular CI/CD is like building with Lego.
- Parent workflows orchestrate everything.
- Reusable workflows handle repeatable pipelines.
- Composite actions simplify repeated steps.

---

## 📌 Coming Next: Speed & Developer Experience

In Part 2, we’ll tackle:

- How caching dependencies cuts your CI time in half.
- Using artifacts to pass data between jobs.

Stay tuned—or better, ⭐ the repo and follow along.

---

⚡ **CTA:**

- Star the repo on GitHub
- Share this with your team if you’re stuck in YAML hell
- Follow for the next part of the series

---

👉 Do you want me to **continue with Part 2 (cache + artifacts)** in the same
detailed blog style, so you can assemble them later into a full flagship post or
series?

thing to put in the blog: design decisions lessons learned, key insights, what
worked well performance metrics best practices and recommendation and gotchas
limitations of scope of the project

the learning challenge the problems i encountered my learning approach
documentation, learning from hands on experience through reading job logs on
github actions using ai to understand technicalities of job logs and errors and
to understand the solution i proposed/found

analyze the readme, point out/identify(infer whererever possible if not
explicitly mentioned) the key insights, lessons i learned, my learning approach,
design decisions and reasoning /justiifications for using specific components in
the architecture and tradeoffs considered, develop a how to guide for developing
pipeline using github actions which involves features like modular architecutre
(layout, flow chart, components with purpose and benefit) ,using git diff and
fetching just last 2 commit detecting relevant changes in files for branch and
tag push,secrets and inputs passing between workflows/actions , outputs passing
from steps to jobs to workflow_calls to caller workflow through needs in order
to conditionally execute job on relevant file changes, caching - saving and
restoring between multiple jobs, uploading and downloading artifacts between
jobs,highlight impactful metrics and insights and innovations and best practices
and recommendations, develop a how to guide in a blog post from the readme
aiming to guide my fellow developers as well justify my project for senior
developers and hiring managers
