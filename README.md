Below is a polished, publish-ready **README** you can drop into the
`parallax-provider-tutorial-library` repo. It’s focused on your CircleCI
implementation, the real problems you found, the exact fixes you applied, and
the impact those fixes had. You can copy/paste this into `README.md` (or edit
further to match your repo voice).

---

# Parallax Provider Tutorial — CircleCI Implementation & Post-mortem

> Practical notes, debugging and fixes for a modular/dynamic CircleCI pipeline
> It’s focused on my CircleCI implementation, the real problems i found, the
> exact fixes i applied, and the impact those fixes had

---

## Table of Contents

- Overview
- Goals
- What I implemented
- Impact of the fixes
- Problems encountered (summary)
- Deep root-cause analysis
- Fixes (what I changed, why)
- Example config snippets
- Debug checklist / commands
- Best practices & recommendations
- Result of the fixes

---

## Overview

This project demonstrates a robust and scalable CI/CD pipeline built with
CircleCI. It utilizes a modular approach to configuration, dynamic pipeline
generation, and intelligent caching to optimize build times and enhance security
the core of this setup is `circleci/path-filtering` orb to detect file changes,
map and pass parameters and generate pipeline and then run only the relevant
jobs . During implementation I hit several practical problems (workspace
ordering, missing commands in BusyBox, tag-trigger filtering and `requires`
logic, and parameter propagation). This README explains what went wrong, how I
fixed it, and why those fixes matter.

---

## Goals

- **Modularize Configuration:** Break down the monolithic `config.yml` into
  smaller, manageable files and folders for different jobs and workflows.
- **Dynamically packing modular files:** Use a preprocessor script
  (`preprocessor.sh`) to dynamically pack modular code into a single
  configuration file in the correct order.
- **Conditional Execution:** Control pipeline and workflow execution based on
  specific conditions like pipeline.parameters with when rules, branch pushes,
  Git tags, and API triggers from GitHub Actions.
- **Optimize Performance:** Implement effective caching strategies for
  dependencies (e.g., `node_modules`) and utilize lightweight Docker images to
  speed up pipeline execution.
- **Efficient Artifact Management:** Use `persist_to_workspace` and
  `attach_workspace` to share artifacts and dependencies between jobs, avoiding
  redundant work.
- **Secure Credential Management:** Store and access sensitive information and
  tokens via CircleCI's environment variables and contexts.
- **Inter-Pipeline Communication:** Pass parameters between parent and child
  pipelines to enable complex, multi-stage workflows.

---

## What I implemented

- **Preprocessor Script (`preprocessor.sh`):** A custom shell script that reads
  a list of modular YAML files, concatenates them in a specified order, and
  outputs a final `config_continue.yml`. This bypasses CircleCI's alphabetical
  loading order and ensures dependencies are correctly defined. this script has
  all the workflows and parameters in it
- **Dynamic Config Generation:** A `config.yml` (setup: true) that runs a small
  generation job and then uses the `path-filtering` orb to decide whether to
  continue with `.circleci/config_continue.yml` .
- **Parameter Passing:** The mapped parameters on relevant file change detected
  by matching the regex of related file, is used to trigger a child pipeline
  from a parent pipeline, and to control jobs in the child pipeline.

- **Conditional Logic:**
  - **Pipeline Generation:** The `path-filtering/filter` orb is used to
    conditionally generate a child pipeline only when specific files are
    changed.
  - **Workflow Execution:** Workflows are conditionally executed using `filters`
    for branch names, tag patterns (`only: /^v\d+\.\d+\.\d+/`), and
    `when: << pipeline.parameters.* >>` rules
- **Workspace Management:**
  - After the preprocessor, the generated `config.yml` and any other required
    files are persisted to the workspace using `persist_to_workspace`.
  - Dependent jobs in case of `path-filtering/filter` workflow, `workspace_path`
    to access these files, ensuring they have the correct configuration and
    artifacts.
- **Caching Strategy:**
  - **Cache:** `save_cache` and `restore_cache` are used to store and retrieve
    dependencies like `node_modules`. A cache key based on the `yarn.lock` file
    ensures the cache is only updated when dependencies change. This is ideal
    for independent jobs.
  - **Workspaces:** `persist_to_workspace` is used to share artifacts and
    dependencies between jobs within the same workflow, especially when a job
    depends on the output of a previous job (e.g., `yarn install`).

---

## Impact of the implementation and fixes to the problems i faced

- The implemented changes result in a highly flexible, performant, and secure
  CI/CD pipeline.
- Build times are significantly reduced due to effective caching and dependency
  management. The modular configuration is easy to maintain and scale.
- By controlling pipeline execution, we avoid unnecessary builds, saving credits
  and providing a clear, auditable workflow.
- **Net effect:** fewer wasted runs, clearer modular structure, and reliable tag
  & branch behavior , clearer separation of concerns, faster pipelines (smaller
  images + caching), and true dynamic configuration flexibility for real-world
  projects.

---

## Problems encountered (summary)

- CircleCI's default alphabetical config file loading prevents modular files
  from being loaded in the correct dependency order.
- `generate-config` workflow requires a `tag` filter on the job if the dependent
  workflow `path-filtering/filter` has one, otherwise the workflow won't be
  generated.
- Getting caching strategies right between `save_cache`/`restore_cache` and
  `persist_to_workspace` to optimize for both independent and dependent jobs.
- `preprocessor.sh` generated config not visible to `path-filtering/filter` —
  file missing or empty.
- `attach_workspace` / `checkout` ordering caused
  `Directory not empty and not a git repository` errors.
- Conditionally running workflows on multiple conditions (e.g., tags and API
  triggers) was complex and required careful use of regex

---

## Deep root-cause analysis (key points)

- **Workspace & ordering:** all the separate workflow run on separate containers
  files can only be transferred through workspaces, If the generated
  continuation file is not persisted and attached before the `path-filtering`
  job runs, the orb cannot find it. You must `persist_to_workspace` in the
  generator job and `attach_workspace` in the consumer job (or run the generator
  as a pre-step).
- **Checkout vs attach_workspace:** `checkout` must run before
  `attach_workspace` in jobs that expect a Git repo + attached workspace
  (otherwise Git complains or double-checkout occurs). Some orb jobs implicitly
  run a checkout; ordering in `pre-steps` matters.
- **filters interaction:** filters are evaluated during compile time and not on
  run time. If `generate-config` doesn't has filters as its dependent job (e.g.,
  missing tag filter), any job that `requires` it will also be excluded if that
  job has tag filters. That causes silent skipping on tags. Either ensure
  `generate-config` has on tags filter,
- **Order**: CircleCI config pack logic is not aware of your semantic order it
  packs in alphabetical order as per files order; you must explicitly control
  concatenation order.

---

## Fixes — what I changed and why

### 1) Ensure generator output is available to the filter job

- Job: `generate-config`:
  - `checkout`
  - `sh .circleci/preprocessor.sh` (creates `.circleci/config_continue.yml`)
  - `persist_to_workspace: root: . paths: - .circleci/config_continue.yml`

- Consumer job (`path-filtering/filter` or pre-steps) must attach to workspace
  using `workspace_path` before using the file.

Why: persist + attach guarantees the dynamically generated file exists when the
filter runs.

### 2) `checkout` before `attach_workspace` in pre-steps

- Add input to `path-filtering/filter`:

  ```yaml
  path-filtering/filter:
    checkout: true
    workspace_path: .
  ```

Why: avoids `Directory not empty and not a git repository` and prevents failure
when attaching workspace overlays files onto working dir.

Note: if checktout and attach_workspace is used as a prestep will cause a double
checkout in logs because some orb jobs internally checkout — harmless but
expected.

### 3) Use proper base images (no BusyBox)

- Replace `busybox:latest` with one of:
  - `cimg/base:stable` (recommended)
  - `alpine:latest` + `apk add --no-cache git openssh bash curl jq`
  - Or your own custom image with tools preinstalled

Why: Git, SSH, bash, and curl are required during generation and for
path-filtering orb logic.

### 4) Avoid silent skipping by controlling `requires` & filters

- Add tag filters to the `generate-config` job so it runs for release tags:

  ```yaml
  jobs:
    generate-config:
      filters:
        tags:
          only: /^v\d+\.\d+\.\d+-circleci\.\d+$/
  ```

Why: If `generate-config` is excluded on tags, jobs requiring it will be
excluded too.

### 5) **Caching Strategy:**

- Created a clear distinction: \_ **`persist_to_workspace`:** For jobs that have
  a direct dependency on a preceding job within the same workflow (e.g.,
  `install-dependencies` -\> `test`). **`save_cache`:** For jobs that are
  largely independent but need to restore a common set of dependencies, like
  `node_modules` for a build and a test job running in separate, parallel
  workflows.

### 6) **Conditional Triggers:**

- Used a combination of CircleCI's built-in branch/tag filters and
  `when: <<pipeline.parameters.*>>` create precise conditional logic.

---

## Example snippets (parallax-focused)

### job: generate-config

```yaml
jobs:
  generate-config:
    docker:
      - image: cimg/base:stable
    steps:
      - checkout
      - run: chmod +x .circleci/preprocessor.sh
      - run: .circleci/preprocessor.sh # writes .circleci/config_continue.yml
      - run: cat .circleci/config_continue.yml
      - persist_to_workspace:
          root: .
          paths:
            - .circleci/config_continue.yml
```

### workflow: setup (use path-filtering orb)

```yaml
workflows:
  path-filtering-setup:
    jobs:
      - generate-config:
          filters:
            tags:
              only: /^v\d+\.\d+\.\d+-circleci\.\d+$/ # ensure tag behavior
      - path-filtering/filter:
          requires: [generate-config] # or omit requires
          checkout: true
          workspace_path: .
          base-revision: circleci
          config-path: .circleci/config_continue.yml
          mapping:
            (.*\.(js|json|yml|lock|sh)$)|(\..*rc$) run-build-and-release true
          filters:
            tags:
              only: /^v\d+\.\d+\.\d+-circleci\.\d+$/ # ensure tag behavior
```

---

### `preprocessor.sh` (simple example that writes `.circleci/config_continue.yml`)

```bash
#!/usr/bin/env bash
set -eo pipefail

# Executors
if [ -f ".circleci/src/@config.yml" ]; then
  cat .circleci/src/@config.yml >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
fi

# Jobs
echo "jobs:" >> "$OUTPUT_FILE"
for file in $(ls .circleci/src/jobs/*.yml | sort); do
  sed 's/^/  /' "$file" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
done

# Workflows
echo "# Consolidate workflows into a single, filtered workflow" >> "$OUTPUT_FILE"
echo "workflows:" >> "$OUTPUT_FILE"
if [ -f ".circleci/src/workflows/workflow.yml" ]; then
  sed 's/^/  /' ".circleci/src/workflows/workflow.yml" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
fi
```

---

## Debug checklist & useful commands

- After `generate-config` job, verify output:

  ```sh
  cat .circleci/config_continue.yml
  ```

- If `path-filtering` fails to load the config, check workspace:

  ```sh
  ls -la .
  ```

- Validate generated config:

  ```sh
  circleci config validate /tmp/generated-config.yml
  ```

- Check GitHub webhook deliveries if pipeline never triggered.
- If script errors show `unexpected (`, ensure shebang is `bash`.

---

## Best practices & recommendations

- **Filters:** If a dependent job has a filter, the job that generates its
  configuration must also have the same filter. Otherwise, the workflow won't be
  generated.
- **Caching:** Use `persist_to_workspace` for dependent jobs in a sequence. Use
  `save_cache` and `restore_cache` for independent jobs to avoid redundant
  installations.
- **Lock Dependencies:** Always use `yarn install --frozen-lockfile` or `npm ci`
  to ensure strict adherence to your lock file, preventing inconsistent builds.
- **Docker Images:** Use lightweight Docker images (e.g., `alpine` versions, but
  never busybox) to reduce build times.
- **Shell Scripts:** Always make shell scripts executable
  (`chmod +x script.sh`).
- **Security:** Store sensitive data in CircleCI contexts or environment
  variables. Access information like branch names and tags using built-in
  environment variables (`$CIRCLE_BRANCH`, `$CIRCLE_TAG`, `$NPM_TOKEN`).
- Persist and access generated files with `persist_to_workspace` and
  `attach_workspace`.
- Always run `checkout` before `attach_workspace` in steps/pre-steps.
- Be explicit about tag filters for generation jobs if you expect tag-triggered
  runs.

---

## Result of the fixes

- Fixed missing tag runs and ensured `generate-config` runs for release tags by
  adding tag filters (or removing improper `requires`).
- Guaranteed `.circleci/config_continue.yml` is produced and available at
  runtime — `path-filtering/filter` sees and uses it correctly.
- Resolved workspace/checkout race conditions — eliminated
  `Directory not empty and not a git repository` errors.
- Switched base image — eliminated missing `git`/`ssh`/`bash` problems.
- `pipeline.parameters` (mapping booleans) are correctly used to gate `when:`
  conditions in the generated config, enabling true modular dynamic pipelines
  for the repo.

---

## Closing notes

This README documents the practical issues I hit while building a real
modular/dynamic CircleCI pipeline and the applied engineering fixes. The fixes
are small but crucial (workspace ordering, explicit parameters, correct images,
and filter/require discipline) — together they turn the dynamic configuration
pattern from fragile into reliable.

---
