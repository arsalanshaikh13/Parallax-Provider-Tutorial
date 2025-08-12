# Parallax Provider Tutorial — CircleCI Implementation & Post-mortem

Practical, actionable documentation for the modular/dynamic CircleCI pipeline
used in **Parallax-Provider-Tutorial**. This README explains what I built, the
problems I hit, the fixes I applied, and the real impact — so other engineers
can reproduce and avoid the same traps.

---

## Overview / Goals

- Move from a monolithic `.circleci/config.yml` → many small modular fragments
  (jobs/workflows) packed at runtime.
- Detect file changes, map them to parameters and config fragments, generate a
  final pipeline and continue only when needed.
- Trigger pipelines across branches and projects (CircleCI ↔ CircleCI and
  CircleCI → GitHub Actions).
- Optimize speed & reliability by using lightweight images (Alpine) and caching
  dependencies.

---

## What I implemented

1. Modularized `shared-config.yml` into fragments under `.circleci/shared/`
   (jobs & workflows).
2. `preprocessor.sh` (or `circleci config pack`) assembles fragments in a
   **controlled order** (explicit order — because
   `circleci config pack`/filesystem alphabetical order may not match required
   job order).
3. `generate-config` job persists the generated config to workspace.
4. `path-filtering/set-parameters` (forked to a bash friendly script) creates
   `/tmp/pipeline-parameters.json` and `/tmp/filtered-config-list`.
5. `path-filtering/generate-config` (or a custom `yq` merge) builds
   `/tmp/generated-config.yml`; then `continuation/continue` is called with the
   parameters file so `pipeline.parameters` are available to the continued
   pipeline.
6. Optionally trigger other pipelines (same branch, other branch, other project)
   via API using a service account / personal token.

---

## Problems encountered (short)

- `circleci config pack`/dynamic import order was alphabetical → wrong job
  ordering.
- Generated continuation file not visible to filter job (workspace
  attach/checkout ordering).
- Using `busybox` image: missing `git`, `bash`, `curl`, `jq`.
- `requires: [generate-config]` + missing tag filters caused jobs to be silently
  skipped on tag pushes.
- `path-filtering/set-parameters` produced parameters JSON, but continuation ran
  with `{}` because `parameters:` was not passed to `continuation/continue`.
- Bash-specific scripts run under `/bin/sh` caused syntax errors (unexpected
  `(`).
- Project API tokens cannot call v2 `/pipeline` endpoint for cross-repo triggers
  — personal/service tokens are required.

---

## Root-cause analysis (key points)

- **Order**: CircleCI pack/merge logic is not aware of your semantic order; you
  must explicitly control concatenation order.
- **Workspace & ordering**: Jobs that read generated files must run after the
  generator job and must `attach_workspace` (and usually `checkout`) in the
  right order.
- **Token scoping**: CircleCI project tokens are limited; cross-repo and API v2
  pipeline triggers require a personal (or service) token.
- **Orb contract**: `set-parameters` writes a parameter JSON but
  `generate-config`/`continuation` do not implicitly wire that JSON into the
  continued pipeline — you must pass it explicitly.
- **Shell runtime**: Use `bash` if your scripts use bash features.

---

## Fixes (what I changed, why)

### 1. Controlled packing order

`preprocessor.sh` collects fragments in the exact order needed and writes
`.circleci/config_continued.yml`. This avoids relying on alphabetical packing.

### 2. Persist & attach workspace correctly

- `generate-config` job:

  ```yaml
  - persist_to_workspace:
      root: .
      paths:
        - .circleci/config_continued.yml
  ```

- `path-filtering/filter` job (pre-steps or pre-steps equivalent):

  ```yaml
  pre-steps:
    - checkout
    - attach_workspace:
        at: .
  ```

  (Checkout before attaching workspace prevents “not a git repo” errors.)

### 3. Use a suitable base image

Use `alpine:latest` (and `apk add --no-cache bash git curl jq`) or
`cimg/base:stable` instead of busybox.

### 4. Tag filters on generator if dependent job has tag filters

If a dependent (child) job/workflow is filtered to run only on certain tags,
then the parent `generate-config` job must also be allowed for those tags —
otherwise the `requires` chain causes the workflow to be skipped.

### 5. Ensure parameters propagate to continuation

**CRITICAL**:

```yaml
- continuation/continue:
    configuration_path: /tmp/generated-config.yml
    parameters: /tmp/pipeline-parameters.json
```

Without the `parameters:` field, the continued pipeline will see `{}` and
`when: << pipeline.parameters.* >>` will fall back to defaults.

### 6. Use bash shebang and pipefail

Top of scripts:

```bash
#!/usr/bin/env bash
set -eo pipefail
```

### 7. Cross-repo/branch pipeline triggering

Use a **personal/service account token** stored in project environment
variables;
`curl POST https://circleci.com/api/v2/project/gh/<org>/<repo>/pipeline` with
proper slug `gh/...`.

---

## Example snippets

**Install & cache / persist node modules (install job)**

```yaml
jobs:
  install:
    docker:
      - image: cimg/node:18.20
    steps:
      - checkout
      - restore_cache:
          keys:
            - yarn-deps-{{ checksum "yarn.lock" }}
      - run: yarn install --frozen-lockfile
      - save_cache:
          paths: [node_modules]
          key: yarn-deps-{{ checksum "yarn.lock" }}
      - persist_to_workspace:
          root: .
          paths: [node_modules]
```

Use `attach_workspace` in dependent jobs (instead of reinstalling).

**Merge fragments and apply params last (yq)**

```bash
CONFIG_FILES=$(xargs < /tmp/filtered-config-list)
yq eval-all 'explode(.) | . as $item ireduce ({}; . * $item )' $CONFIG_FILES > /tmp/merged-config.yml

echo "parameters:" > /tmp/params.yml
yq eval -P '.' /tmp/pipeline-parameters.json | sed 's/^/  /' >> /tmp/params.yml

yq eval-all 'explode(.) | . as $item ireduce ({}; . * $item )' /tmp/merged-config.yml /tmp/params.yml > /tmp/generated-config.yml
```

**Trigger GitHub Actions from CircleCI (workflow_dispatch):**

```bash
curl -X POST \
  -H "Authorization: Bearer $GITHUB_API_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/OWNER/REPO/actions/workflows/build.yml/dispatches \
  -d '{"ref":"main"}'
```

**Trigger CircleCI pipeline (v2 API)**

```bash
curl -X POST "https://circleci.com/api/v2/project/gh/<org>/<repo>/pipeline" \
  -H "Circle-Token: $PERSONAL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"branch":"alpine-branch","parameters":{"run_post_pipeline":true}}'
```

- Use `gh` in the slug; personal token (or service account token) required for
  v2 endpoints.

---

## Debug checklist & useful commands

- Confirm mapping output:

  ```bash
  cat /tmp/pipeline-parameters.json
  cat /tmp/filtered-config-list
  ```

- Check generated continuation:

  ```bash
  cat .circleci/config_continued.yml
  cat /tmp/generated-config.yml
  circleci config validate /tmp/generated-config.yml
  ```

- Validate project slug & token:

  ```bash
  curl -H "Circle-Token: $TOKEN" https://circleci.com/api/v2/project/gh/<org>/<repo>
  ```

- If API returns `Permission denied`, check token type & repo permissions; for
  v2 pipeline triggers use personal/service token.
- If you see `syntax error: unexpected ("` — ensure script shebang is
  `#!/usr/bin/env bash`.

---

## Best practices & recommendations (short)

- If a job that is `requires:` another has filters (tags/branches), **the
  required job must also allow those filters**.
- Cache `node_modules` (or persist workspace) to avoid repeated installs.
- Use `yarn install --frozen-lockfile` to enforce `yarn.lock`.
- If jobs depend on an install step, `persist_to_workspace` the installed
  artifacts and `attach_workspace` in dependents.
- When jobs are independent, rely on CircleCI cache (restore/save).
- Prefer lightweight images (Alpine or cimg) for cold starts.
- Make scripts executable (`chmod +x .circleci/preprocessor.sh`).
- Store tokens in CI environment variables and use service account tokens for
  cross-repo triggers.
- Use explicit merging so `params` override defaults (pass params file into
  continuation).
- Avoid committing empty continuation files — generate them at runtime.

---

## Major impact (why this matters)

- **MAJOR:** Fixing parameter propagation and modular packing enables passing
  **any number** of parameters and files in mappings to fully control
  jobs/workflows in the generated pipeline. Previously, mappings’ parameters
  were effectively unused in the continuation flow; now they can gate workflows
  (`when: << pipeline.parameters.* >>`) and drive complex multi-repo
  orchestration.
- Result: reduced wasted builds, clearer separation of concerns, faster
  pipelines (smaller images + caching), and true dynamic configuration
  flexibility for real-world projects.

---

## Repro & support notes

- Keep a minimal reproducible example: `config.yml` (setup) → `generate-config`
  job → pack fragments → `continuation/continue` with `parameters`.
- I raised the CircleCI docs issue about the missing `parameters:` example in
  the official guide; include the fix in your README so others won’t run into
  the same trap.
- If you need, I can create a tiny sample repo (configs + preprocessor +
  scripts) you can run locally with `circleci local execute`.

---

## Closing / Next steps

- If you want a minimal working repo or a short flow diagram to include in
  README, I can generate that now (text diagram or repo skeleton).
- Happy to convert this README into a `CONTRIBUTING.md` or split it into
  Quickstart + Deep Dive pages.

---

If you want me to tailor this README for direct copy-paste into your repo (or
shorten it to a one-page quickstart), say which format and I’ll produce it.

Got it — you want a **flow diagram** for your Parallax Provider Tutorial
pipeline that captures all the moving parts you just described. Here’s a clean
text-based version you can put in your README without waiting for heavy images:

```
                ┌───────────────────────────────┐
                │        Code Push / API        │
                │ (branch push / tag / GH API)  │
                └───────────────┬───────────────┘
                                │
                                ▼
              ┌─────────────────────────────────────┐
              │       config.yml (setup: true)       │
              │  - Detect trigger type & filters     │
              │  - Call preprocessor.sh              │
              └───────────────────┬─────────────────┘
                                  │
                                  ▼
         ┌──────────────────────────────────────────┐
         │       preprocessor.sh (custom order)      │
         │  - Pack modular config parts (not alpha)  │
         │  - Output packed config_post.yml          │
         └───────────────────┬──────────────────────┘
                              │
                              ▼
        ┌──────────────────────────────────────────┐
        │ Persist packed config to workspace        │
        │   workspace_path: /tmp/generated-files    │
        └───────────────────┬──────────────────────┘
                              │
                              ▼
   ┌────────────────────────────────────────────────────────┐
   │ Path-filtering / set-parameters job                     │
   │  - Reads from workspace (not fresh checkout)            │
   │  - Generates /tmp/parameters.json                       │
   │  - Passes params to next jobs or pipelines              │
   └───────────────────┬────────────────────────────────────┘
                        │
                        ▼
     ┌────────────────────────────────────────────────────┐
     │ Conditional Workflow Execution                      │
     │  - Based on branch/tag regex, API trigger, params    │
     │  - Install job (persist node_modules to workspace)   │
     │  - Dependent jobs attach workspace                   │
     │  - Independent jobs restore yarn cache               │
     └───────────────────┬─────────────────────────────────┘
                          │
                          ▼
         ┌───────────────────────────────────────────┐
         │ External Pipeline Trigger (optional)       │
         │  - CircleCI API (same branch / other branch)│
         │  - GitHub Actions API (workflow_dispatch)   │
         │  - Pass parameters to control target jobs   │
         └────────────────────────────────────────────┘
```

If you want, I can also give you a **compact “one-line” version** for the README
to show the big picture without all the details.

Do you want me to make that compact summary diagram too?
