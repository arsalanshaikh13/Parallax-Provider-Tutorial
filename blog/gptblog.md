# 🧩 How I Built a Modular GitLab CI/CD Pipeline (Runtime-Driven, Child Pipelines, and Fewer Wasted Runs)

### TL;DR

Monolithic `.gitlab-ci.yml` files are hard to maintain and love wasting CI
minutes. I rebuilt my pipeline around **runtime file-diff gating**, **dynamic
child pipelines** (full vs empty), and **modular templates**. The result is a
setup that’s faster, easier to reason about, and resilient to shallow clones,
force pushes, and API triggers.

---

## What You’ll Learn

- How to design a **modular GitLab CI/CD** system using **parent/child
  pipelines**
- Why **runtime change detection** beats `rules:changes` for reliability
- How to **avoid implicit artifact downloads** and trim pipeline time
- Patterns for **lint/test/build/release** that scale across repos
- How to **export Jest coverage** that shows up in merge requests

---

## About This Guide

This is a practical “how I built it” guide. It doubles as:

- A **copy-and-adapt** reference for developers setting up GitLab CI/CD.
- A **design narrative** for senior engineers and hiring managers evaluating
  tradeoffs, resilience, and maintainability.

---

## My Learning Approach

- Start with a monolith → extract **responsibilities** into **reusable
  templates**.
- Replace brittle compile-time logic with **runtime decisions**.
- Measure results and **kill unnecessary work** (implicit artifacts, heavy
  images).
- Document root causes for the weird failures everyone hits once.

---

## The Problem / Challenge

**Initial state:** one giant pipeline file; everything ran on every push; flaky
`rules:changes`; slow images; artifacts pulled when not needed.

**Pain points:**

- `rules:changes` broke on **shallow clones**, **first commits**, **API
  triggers**
- **Detached HEAD** checkout made base SHAs unreliable
- The YAML grew into an unreviewable blob
- **Implicit artifacts** slowed jobs that didn’t need them

---

## Solution Architecture (Modular + Runtime Driven)

```
.gitlab-ci.yml               # parent pipeline (orchestrates)
.gitlab/
  build/
    build.yml
  lint_and_test/
    lint_and_test.yml
  release/
    release.yml
  child-pipeline/
    ci-full.yml              # full workflow
    ci-empty.yml             # no-op workflow (clean “skip”)
generate-pipeline.sh         # decides full vs empty at runtime based on git diff
ci-scripts/
  gitlab-sync-and-trigger.sh # optional: trigger GitLab via API from elsewhere
.github/workflows/
  gitlab-sync-and-trigger.yml# optional: GitHub Actions to call the GitLab API
```

**Key ideas:**

- **Parent pipeline** runs a small **check** job that decides which child
  pipeline to include.
- **Child pipelines**:
  - `ci-full.yml` → lint, test, build, (optional) release
  - `ci-empty.yml` → prints “skipped” and exits fast

- **Templates** for lint/test/build/release live in their own files and are
  included by the full child pipeline.

---

## Why Modular Workflows Matter

- **Maintainability:** Each template has one job (lint, build, release).
- **Reusability:** Drop the same blocks into other repos.
- **Scalability:** Add features (coverage, release) without touching unrelated
  parts.
- **Efficiency:** Skip entire workflows when no relevant files changed.

---

## Design Decisions & Tradeoffs

- **Runtime diff vs `rules:changes`**
  - _Tradeoff:_ Slightly more scripting.
  - _Win:_ Works with shallow clones, first commits, tags, and API triggers.

- **Parent/child pipelines**
  - _Tradeoff:_ One more moving part (trigger + include).
  - _Win:_ You can load **full** or **empty** workflows at runtime.

- **Busybox/Alpine over Ubuntu**
  - _Tradeoff:_ Fewer preinstalled tools (install what you need).
  - _Win:_ Faster pulls and starts.

- **Artifacts opt-out**
  - _Tradeoff:_ More explicit YAML.
  - _Win:_ No more silent, slow artifact downloads.

---

## Implementation Deep Dive (Feature → Problem → Cause → Solution → Why It Matters → Impact)

### 1) Runtime Change Detection

**Problem** `rules:changes` failed for first commits, shallow clones, force
pushes, and API triggers.

**Cause** `CI_COMMIT_BEFORE_SHA` can be **all zeros** or absent; shallow history
may miss the base.

**Solution (defensive diff logic)** Generate a small config file at runtime that
includes **full** or **empty** child pipeline:

```yaml
# .gitlab-ci.yml (parent)
image: alpine:latest
stages: [check, trigger]

check_for_relevant_files:
  stage: check
  image: alpine:latest
  script:
    - apk add --no-cache git
    - chmod +x ./generate-pipeline.sh
    - ./generate-pipeline.sh
  artifacts:
    paths: [.gitlab/pipeline-config.yml]
    expire_in: 10 min

trigger_child_pipeline:
  stage: trigger
  trigger:
    include:
      - artifact: .gitlab/pipeline-config.yml
        job: check_for_relevant_files
    strategy: depend
```

```bash
# ./generate-pipeline.sh
#!/usr/bin/env sh
set -eu

BEFORE="${CI_COMMIT_BEFORE_SHA:-0000000000000000000000000000000000000000}"

if [ "$BEFORE" = "0000000000000000000000000000000000000000" ] || \
   ! git cat-file -e "$BEFORE" 2>/dev/null; then
  CHANGED=$(git show --pretty="" --name-only "$CI_COMMIT_SHA" | grep -E '\.js$|\.json$|\.yml$|\..*rc$' || true)
else
  CHANGED=$(git diff --pretty="" --name-only "$BEFORE" "$CI_COMMIT_SHA" | grep -E '\.js$|\.json$|\.yml$|\..*rc$' || true)
fi

mkdir -p .gitlab

if [ -z "$CHANGED" ]; then
  echo "No relevant changes — generating EMPTY pipeline."
  cat <<'YAML' > .gitlab/pipeline-config.yml
include:
  - local: '.gitlab/child-pipeline/ci-empty.yml'
YAML
else
  echo "Relevant changes detected:"
  echo "$CHANGED"
  cat <<'YAML' > .gitlab/pipeline-config.yml
include:
  - local: '.gitlab/child-pipeline/ci-full.yml'
YAML
fi
```

**Why it matters** You control the logic and stop relying on brittle
compile-time rules.

**Impact** No more “bad object 000000…” failures; predictable, audited decisions
in logs.

---

### 2) Dynamic Child Pipelines (full vs empty)

```yaml
# .gitlab/child-pipeline/ci-empty.yml
image: busybox:latest
stages: [skip]

skip_job:
  stage: skip
  script:
    - echo "No relevant changes — skipping downstream jobs."
```

```yaml
# .gitlab/child-pipeline/ci-full.yml
image: node:18-alpine
stages: [test, build, release]

# Optional shared cache (pull-only)
.cache_common: &cache_common
  key: yarn-cache
  paths: [/root/.cache/yarn/]

lint_and_test:
  stage: test
  cache:
    <<: *cache_common
    policy: pull
  script:
    - yarn install --frozen-lockfile --ignore-scripts
    - yarn lint
    - yarn test --coverage --coverageReporters=cobertura
  artifacts:
    when: always
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
    paths:
      - coverage/
    expire_in: 1 week

build:
  stage: build
  needs: [{job: lint_and_test, artifacts: false}] # <- opt out of implicit artifacts
  cache:
    <<: *cache_common
    policy: pull
  script:
    - yarn install --frozen-lockfile --ignore-scripts
    - yarn build
  artifacts:
    paths: [dist/]
    expire_in: 1 week

release:
  stage: release
  needs: [{job: build, artifacts: true}]
  rules:
    - if: '$CI_COMMIT_TAG =~ /^v[0-9]+\.[0-9]+\.[0-9]+(-gitlabci\.[0-9]+)?$/'
      when: on_success
    - when: never
  script:
    - echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > ~/.npmrc
    - cp package.json dist/
    - cd dist
    - npm publish --access public
```

**Why it matters** Skip entire workflows when nothing relevant changed. When
there _is_ work, you get a clean, well-labeled pipeline with
`test → build → release`.

**Impact** Fewer wasted minutes, clearer UI, and a pipeline that behaves like a
product.

---

### 3) Stop Unwanted Artifact Downloads

**Problem** Later jobs implicitly pulled artifacts from earlier jobs.

**Cause** Default artifact inheritance and `needs:` behavior.

**Solution** Explicitly opt out:

```yaml
build:
  needs: [{job: lint_and_test, artifacts: false}]
```

or

```yaml
dependencies: []
```

**Why it matters** Less network I/O, fewer surprises, and faster “pure compute”
jobs.

---

### 4) Coverage That Shows Up in MRs

**Problem** Coverage existed only in logs or local runs.

**Solution** Export **Cobertura** from Jest and attach as a `coverage_report`.
GitLab will surface it in merge requests automatically (snippet shown in
`lint_and_test` above).

**Why it matters** Reviewers see useful signals where they live: the MR UI.

---

## Performance & DX (What Improved)

- **Runtime gating** saves entire pipelines for non-code changes.
- **Lightweight images** (busybox/alpine) reduce cold starts.
- **Explicit artifacts** cut hidden downloads.
- **Coverage in MR** improves review speed and confidence.

> Tip: Track median job durations and pipeline success rates before/after each
> change. The easiest wins often come from images and artifact control.

---

## Critical Insights

- **GitLab SHAs are event-dependent.** First pushes, tags, and API triggers
  don’t behave like branch pushes. Defend against all-zero
  `CI_COMMIT_BEFORE_SHA`.
- **Compile-time vs runtime.** `rules:` and `include:` are evaluated before any
  `script:` runs. If you need repo state to decide, generate a dynamic include
  at runtime.
- **Child pipelines need valid jobs.** An “empty” child still must define a
  trivial job—don’t include a config file with no jobs.

---

## Lessons Learned

- Prefer **runtime decisions** for reliability across trigger types.
- Keep **each YAML small** and **single-purpose**.
- Make **artifact flow explicit**—implicit behavior is where time disappears.
- Always **normalize line endings** for shell scripts (LF) and make them
  executable.

---

## Common Issues & Fixes

| Symptom / Error                                         | Likely Cause                                 | Fix                                                                                  |
| ------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| `fatal: bad object 000000...`                           | `CI_COMMIT_BEFORE_SHA` zeros or missing base | Use `git show` fallback; fetch base when needed                                      |
| `syntax error: unexpected end of file (expecting "fi")` | Indented/unquoted heredoc; CRLF endings      | Use **quoted** heredocs or external `.sh`; ensure **LF** line endings and `chmod +x` |
| “Unable to create pipeline: include must implement …”   | Included file had no jobs; not triggered     | Generate child file and **trigger** it via `trigger: include:`                       |
| Child job unexpectedly downloads artifacts              | Implicit inheritance                         | `needs: [{ job: X, artifacts: false }]` or `dependencies: []`                        |
| Coverage doesn’t appear in MR                           | Wrong format/path                            | Export **Cobertura**; set `reports: coverage_report` with correct path               |

---

## Best Practices (and Why)

- **Runtime diff over `rules:changes`** (reliability across triggers).
- **Busybox/Alpine** whenever possible (speed, smaller attack surface).
- **One responsibility per YAML** (debuggability, reuse).
- **Opt-out of artifacts explicitly** (`needs: artifacts: false`).
- **Put non-trivial shell in `.sh` files** (avoid heredoc indentation traps).
- **Always log context** in check jobs: `printenv | sort`, SHAs, short
  `git log`.

---

## Conclusion: Why This Matters to the Business

This architecture isn’t just “clean YAML.” It reduces cost (fewer wasted
minutes), increases delivery speed (faster pipelines), and improves reliability
(fewer flaky runs). The modular design scales across teams and repos, and the
runtime gating ensures CI/CD behaves predictably even under odd event sources.

---

## Technical Skills Demonstrated

- GitLab CI/CD: parent/child pipelines, dynamic includes, compile-time vs
  runtime behavior
- Defensive Git scripting for robust change detection
- Performance tuning: images, artifact strategy, caching policy
- Coverage surfacing in MRs (Cobertura from Jest)
- System design: modularization, separation of concerns, reusable templates

---

### Try It / Adapt It

- Start small: add the **runtime check + dynamic child** to your current
  pipeline.
- Move lint/test/build into **separate templates**.
- Replace heavyweight images with **alpine**/**busybox** where possible.
- Hook up **Cobertura** reports so coverage shows in MRs.

If this helped: share it with your team, adapt it to your repos, and keep
iterating. CI/CD should feel like **Lego**, not spaghetti.
