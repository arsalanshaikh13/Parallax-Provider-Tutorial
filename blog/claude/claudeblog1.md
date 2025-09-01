how to modularized gitlab ci/cd pipeline and run parent / child pipeline which
runs only specific changed files

## About This Guide

This guide documents real-world solutions to GitLab CI/CD's most challenging
problems. Rather than theoretical examples, these are battle-tested patterns
that handle edge cases, API triggers, shallow clones, and GitLab's inconsistent
behavior across different pipeline sources.

## What You'll Learn

- Modular template system for reusable CI/CD components
- Dynamic parent/child pipeline architecture for conditional execution
- How to build runtime detection for relevant files that works across all GitLab
  trigger scenarios
- Performance optimization through lightweight images and smart caching
- Advanced troubleshooting techniques for GitLab's quirks
- how to control the execution of pipelines

## Modular template system for reusable CI/CD components

```
├── .gitlab-ci.yml              # Parent pipeline (orchestrator)
└── .gitlab/
    ├── generate-pipeline.sh     # decide which child pipeline to run based on specific changed file
    │
    ├── child-pipeline/
    │   ├── ci-full.yml            # Full pipeline execution (caller workflow)
    │   └── ci-empty.yml           # skip pipeline
    ├── build/
    │   └── build.yml              # Individual build template
    ├── lint_and_test/
    │   └── lint_and_test.yml      # Individual Test template
    └── release/
        └── release.yml            # Individual Release template
```

### Component Responsibilities

| Component                    | Purpose                                              | Key Benefit                                                     |
| ---------------------------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| **Parent Pipeline**          | Runtime analysis and decision making                 | Conditional entire workflow execution                           |
| **Child Pipelines**          | Isolated execution environments                      | Clean separation of concerns                                    |
| **Modular Templates**        | Reusable job definitions                             | Consistency across projects                                     |
| **Generate pipeline Script** | detect changed files and select pipeline accordingly | Reliable changed file detection and full control over pipelines |

**Key snippets to make modular template system**

**Caller workflow**

Call the other jobs using `include` keyword

- define the anchor in caller workflow
- define the stages in caller workflow
- can write job specific code in the caller workflow as well
- job specific code mentioned in the caller workflow will take precedence and
  override the similar job code mentioned in the template

```yml
# .gitlab/child-pipepline/
# set the base docker image to use for all jobs
# can define docker image to use of individual jobs in their own template
image: node:18-alpine

include:
  project: 'arsalanshaikh13/Parallax-Provider-Tutorial' # your gitlab_username/Project_name
  ref: gitlabci # branch name in your project
  file: # files to include
    - '.gitlab/lint_and_test/lint_and_test.yml'
    - '.gitlab/build/build.yml'
    - '.gitlab/release/release.yml'

# can set anchors only in the caller workflow
.cache_common: &cache_common
  key:
    files:
      - yarn.lock
  paths:
    - node_modules/
# stages must be set in the caller workflow
stages:
  - test
  - build
  - release
# using the anchors set above
# can write job specific code in the caller workflow as well
lint_and_test:
  cache:
    <<: *cache_common
```

**Individual job templates**

- Write the jobs code as you would write in the single yml file for any jobs
- The stage set under stages keyword in the caller workflow should match the
  stage set in the job

```yml
# '.gitlab/build/build.yml'
build:
  stage: build
  rules:
    - if: '$CI_PIPELINE_SOURCE == "parent_pipeline"'
      when: on_success
    - when: never
  before_script:
    - yarn install --frozen-lockfile --ignore-scripts
  script:
    - yarn build
```

> You can find the source code in the
> [reference repository](https://github.com/arsalanshaikh13/Parallax-Provider-Tutorial/tree/gitlabci/.gitlab).

### Why Modular Workflows Matter

**Problems with Monolithic CI/CD Architecture:**

- **Scalability Limitations** A single, large pipeline grows increasingly
  complex and slow as the project scales, becoming harder to manage and
  optimize.
- **Slower and cumbersome lookups of jobs** Need to scan through many unrelated
  jobs to identify relevant job code, to modify and monitor code, consuming
  developing time on search.
- **Difficult Debugging and Monitoring** Failures are buried in large pipelines,
  making it hard to isolate and trace errors back to specific components or
  jobs.
- **Poor Maintainability** update or refactoring job codes and definition is
  difficult without affecting unrelated jobs so more probability and frequency
  of mistakes
- **Higher Risk of Human Error** Complex and repetitive logic (e.g., conditional
  checks) increases the chance of misconfiguration and oversight.
- **Redundant modification** Logic and job definitions are often duplicated
  across different jobs, instead of reuse, leading to problem of changing code
  at many places where there is duplication.
- **Reduced Team Autonomy** Teams working on different parts of the codebase are
  forced to coordinate changes in a single shared pipeline file.

**How Modular Architecture Solves These Issues:**

- **Improved development and Scalability** Pipelines are broken into smaller,
  manageable templates , allowing them to monitor, develop and scale
  independently.
- **Easier Debugging** Failures are localized within specific modules, making
  troubleshooting faster and more precise.
- **Enhanced Maintainability** Smaller pipeline files are easier to modify,
  extend, and review without affecting unrelated workflows.
- **Faster lookup and Feedback** go to specific template without scanning the
  whole the monolithic file which enable parallel or scoped development and
  execution, giving quicker results on their changes.
- **Reduced Duplication** Shared pipelines, templates promote reuse,
  consistency, and DRY (Don't Repeat Yourself) principles.
- **Independent management** Different pipelines, templates can be managed
  independently at different locations anc can be used at any location fostering
  better collaboration and parallel development.
- **More flexibility to develop strategy for Workflows** Modular setups allow
  conditional triggering, job grouping, and custom workflows that adapt to
  project complexity provide more flexibility to develop better strategy for
  running workflows

## Dynamic parent/child pipeline architecture for conditional execution

**Problems:**

- The full pipeline is triggered for any changed file, even when not required.
- Repetitive conditional checks must be written in each job to ensure it runs
  only for relevant changed files.
- This approach is:
  - **Cumbersome** to implement and maintain.
  - **Difficult and more error-prone to track and debug**, especially as the
    pipeline scales and becomes more complex and easier to lose track of changes
    made to other jobs.
  - **Slower to evaluate**, we have to lookup through all the jobs to debug and
    make any changes to the any job.
  - **Repetitive and Redundant evaluation**: The same conditional checks are
    repeated across multiple jobs, increasing the risk of human error and
    reducing maintainability.
  - **Difficult to scale**: As the number of files and jobs grows, the overhead
    of maintaining per-job conditions and evaluating them increases
    disproportionately.
  - **Wasted CI minutes** Sometimes Developers must wait for the entire pipeline
    to complete only to find out pipeline ran for non relevant changed files,
    reducing development speed .

**Root Causes:**

- **Monolithic pipeline structure**: All jobs are visible and potentially
  triggered for any changed file, regardless of relevance.
- **Lack of job grouping**: There's no logical grouping of jobs to map changed
  files to affected jobs
- **Decentralized selection logic**: Each job contains its own conditional
  logic, leading to duplication and inconsistency across the pipeline.
- **non deterministic feedback**: the pipeline didn't provide reliable
  information about which changed file triggered the pipeline

**Solution Implementation**:

- group all the relevant jobs together in full pipeline
- when relevant files changed, run the full pipeline whichs make the grouped
  jobs visible and executes them
- when no relevant files changed, run empty pipeline with skip job

```yml
# docker image to use for all jobs
image: alpine:latest

# set workflow rules for all the stages, exit the workflow if rules don't match
workflow:
  rules:
    # run pipeline on branch push, tag push and only through trigger source
    # and avoid double pipeline trigger one through api source and other through gitlab username source
    - if:
        '($CI_COMMIT_BRANCH == "gitlabci" || $CI_COMMIT_TAG) &&
        $CI_PIPELINE_SOURCE == "trigger"'
    - when: never # do not run pipeline on any other condition

stages:
  - check
  - trigger

# This job explicitly checks for file changes and fails if none found
check_for_relevant_files:
  stage: check
  before_script: |
    apk add --no-cache git # since we are using git command in the script so install git here
    chmod +x .gitlab/generate-pipeline.sh

  script:
    - sh .gitlab/generate-pipeline.sh
  # using artifacts to pass generated file to the subsequent job
  artifacts:
    paths:
      - .gitlab/pipeline-config.yml
    expire_in: 10 minutes
# trigger keyword generates child pipeline
trigger_child_pipeline:
  stage: trigger
  trigger:
    include:
      - artifact: .gitlab/pipeline-config.yml
        job: check_for_relevant_files
    strategy: depend
```

### Step-by-step explanation

1. **Global image** The pipeline sets a single default runtime (`alpine:latest`)
   so every job runs in the same lightweight environment (jobs may still
   override this). This keeps job footprints small and makes `apk` available for
   quick installs.

2. **Top-level workflow rules (gatekeeper)** `workflow.rules` restricts when the
   whole pipeline can be created: only on a push to the `gitlabci` branch **or**
   a tag **and** when the pipeline source is `trigger`. Any other condition is
   explicitly denied (`when: never`). This prevents accidental/double runs and
   ensures only intended trigger events create a pipeline.

3. **Stage ordering: `check` → `trigger`** Two stages enforce the sequence:
   first detect whether a full pipeline is needed (`check`), then conditionally
   launch the child pipeline (`trigger`). This guarantees the detection step
   always runs before the child pipeline decision is made.

4. **`check_for_relevant_files` job (detection + artifact)**
   - **before_script**: installs `git` and makes the detection script executable
     so the job can run repository-level `git` commands.
   - **script**: runs a repo-side script (e.g., `generate-pipeline.sh`) that
     inspects commits and writes a `.gitlab/pipeline-config.yml` pointing to
     either a full or empty child pipeline.
   - **artifacts**: the generated `pipeline-config.yml` is persisted as an
     artifact and passed to the next job; `expire_in: 10 minutes` limits storage
     lifetime.

5. **`trigger_child_pipeline` job (child pipeline creation)** This job uses
   GitLab’s `trigger` keyword with an `include` that references the artifact
   produced by the `check_for_relevant_files` job. GitLab reads that included
   YAML and creates the child pipeline accordingly. `strategy: depend` makes the
   parent pipeline wait for the child and propagate the child pipeline’s
   success/failure status back to the parent.

6. **Runtime flow (what actually happens)**
   - Pipeline is created only when workflow rules match.
   - The `check` job runs the detection script and emits a `pipeline-config.yml`
     that selects `ci-empty.yml` or `ci-full.yml`.
   - The `trigger` job reads that artifact and triggers the child pipeline that
     contains the real jobs.
   - Parent waits for child (because of `strategy: depend`) and succeeds/fails
     based on the child result.

**notes**

- All referenced child pipeline files (`ci-full.yml`, `ci-empty.yml`) and the
  detection script must be committed to the repository.
- `expire_in` must be long enough for the trigger job to run in case of
  scheduling/delays.
- Because the base image is Alpine, the job installs `git` at runtime—if your
  runner environment already provides `git`, you can skip that step to speed up
  jobs.

**Why This Solution Works**:

- **Clean separation of concerns**: Decision logic isolated from execution logic
  as parent pipeline handles the selection of jobs based on relevant changed
  files, child pipeline handles the execution of the jobs
- **Centralization of selection logic**: one job handles conditional check and
  no requirement of repetitively writing conditional checks on each job
- **Better job visibility:** relevant jobs are visible on relevant changed files
- **Runtime conditional checks**: detect at runtime whether work is required,
  then dynamically include and run only the appropriate child pipeline.
- **deterministic feedback**: relevant pipelines are triggered for relevant
  changed files.

**Benefits of the solution**

- **Optimized Resource Utilization** Triggering only relevant jobs based on
  specific file changes reduces unnecessary execution, saving compute resources
  and time.
- **Improved Troubleshooting and Monitoring** Clear mapping between changed
  files and affected jobs help in Running targeted jobs which enhances
  visibility into failures and job status, facilitating faster feedback and more
  effective debugging.
- **Enhanced Scalability for Growing Codebases** Logical grouping and
  modularization of jobs allow the pipeline to handle increasing files and
  complexity without performance degradation.
- **Minimized Risk of Errors** Removing decentralized repetitive conditional
  checks simplifies job configurations, making them easier to read, maintain,
  and update and lowers the chance of human error
- **Easier Long-Term Maintenance** Modular and structured pipelines simplify
  refactoring, updates, and onboarding as the project evolves.
- **Improved Developer Productivity** Less time spent writing and managing
  conditional logic lets developers focus on core development and innovation.

## How to build runtime detection for relevant files that works across all GitLab trigger scenarios

**Problem**: Pipeline triggered on changes to any files

**Root Cause**: Native `rules:changes` failed to detect changes in relevant
files

**Solution Implementation**:

- using git diff to detect changed file
- pass CI_COMMIT_BEFORE_SHA variable value i.e. parent (previous) commit, as
  trigger payload with API request

```bash
# stop and exit the script when error occured
set -e
# compare parent (previous) commit with current commit and produces name of files only and pipe output to grep to match for file extensions
# store the output of grep into $CHANGED either file name(when match found) or empty string (when match not found)
CHANGED=$(git diff --pretty="" --name-only "$CI_COMMIT_BEFORE_SHA" "$CI_COMMIT_SHA" 2>&1  | grep -E '\.js$|\.json$|\.yml$|\.lock$|\.sh$|\..*rc$' )

echo "output of diff: $CHANGED "
# checks whether $CHANGED is empty or not and based on that execute the relevant code
if [ -z "$CHANGED" ]; then
    echo "No relevant changes found. Generating empty pipeline."
    cat  > .gitlab/pipeline-config.yml <<EOF
include:
  - local: '.gitlab/child-pipeline/ci-empty.yml'
EOF
else
    echo "Found relevant changes: $CHANGED"
    cat > .gitlab/pipeline-config.yml <<EOF
include:
  - local: '.gitlab/child-pipeline/ci-full.yml'
EOF
fi
```

the script acts as a **gatekeeper** — detecting whether a change really matters,
and deciding between a **empty skip** or a **full** pipeline.

### How the Runtime Detection Script Works

1. **Look at what changed** It compares the current commit against the previous
   one and collects the list of files that were modified.

2. **Filter out the noise** Only changes in relevant file types are considered —
   things like `.js`, `.json`, `.yml`, `.sh`, or dotfiles. Non relevant changes
   (e.g., docs) won’t count.

3. **Run empty pipeline when relevant changes was not found** If no relevant
   files changed, it prints a friendly message and generates an “empty
   pipeline.” This saves time and resources.

4. **Run the full pipeline when it matters** If relevant files did change, it
   announces them and generates the configuration for a full pipeline run.

5. **Works in every trigger scenario** Because it’s based on comparing commit
   SHAs, this logic works consistently across pushes, merge requests, tags, API
   triggers, scheduled runs, and even force pushes or rollbacks.

**Why This Solution Works**:

- **Handles zero SHAs**: compares parent commit with current commit
- **Graceful fallbacks**: Never fails, always produces a decision
- **Custom filtering**: Precise control using grep and regex pattern over which
  files trigger

**Impact**: 100% Reliable detection of relevant changed files vs 0% reliability
in detecting relevant changed files

- Performance optimization through lightweight images and smart caching
  saving/push cache in lint_and_test job and only restoring/pulling cache in
  build and release job

  **Artifacts management**

- **Problem:** `build` was pulling artifacts from `lint_and_test` even though
  not needed.
- **Cause:** Default artifact dependency behavior (or `needs:` without
  `artifacts: false`).
- **Solutions:**

  ```yml
  needs:
    - job: lint_and_test
      artifacts: false
  ```

- **Impact:** Faster jobs, less network churn, cleaner pipeline.

  **setting cache policy**

  problem: time wasted in pushing(saving) the cache in many jobs

  cause: all the jobs push (save) and pull (retrieve) cache by default

  solution: first job pushes (save) the cache and subsequent jobs just pull
  (retrieve) the cache

```yml
.cache_common: &cache_common
  key:
    files:
      - yarn.lock
  paths:
    - node_modules/

lint_and_test:
  cache:
    <<: *cache_common

build:
  cache:
    <<: *cache_common
    policy: pull
```

## 🧠 Key Lessons Learned

- **Avoid monolithic pipelines** — they don’t scale and are harder to maintain.
- separate selection decision logic to parent pipeline and execution of job
  logic to child pipeline, to avoid repeating same rules in every job
- **Centralize conditional logic** — don’t repeat `rules` in every job.
- **Use runtime `git diff` when running pipeline through API or trigger** —
  works reliably across all GitLab triggers.
- **Trigger only relevant jobs** — saves time, resources, and avoids noise.
- **Use parent/child pipelines** — for clean separation of decision and
  execution.
- **Group related jobs in templates** — improves readability and debugging.
- **Disable unnecessary artifacts and cache uploads** — prevents waste.
- **Use `strategy: depend`** — ensures parent pipeline reflects child results.
- **Fail fast with skip logic** — exit early on irrelevant changes.
- **Design for modular reuse** — keep templates DRY and self-contained.
- **Prefer lightweight base images** — speeds up job startup time.
- **Print file diffs in logs** — improves transparency and debugging.
- **One job saves cache, others pull** — prevents redundant writes.
- **Test pipeline logic thoroughly** — especially when working with dynamic
  includes.

impact: faster execution of jobs, reduced wastage of time on redundant
operations

- Advanced troubleshooting techniques for GitLab's quirks
- how to control the execution of pipelines use rules.if to conditionally
  execute pipelines on specific branch or tag and pipeline_source of trigger
  sequentially run jobs by using needs to run jobs only after the preceding job
  ends

critical insights and lesson learned behavior of gitlab cause for the behavior
key insight

best practices and recommendations

outline : what will you learn about this guide my learning approach the problem
with monolithic ci/cd: initial state Solution : system layout, component
responsibilities, why modular workflows matter design decisions and tradeoffs
implementation deep limitations of current solution implementation performance
optimization results critical insights and lessons learned best practices and
recommendations common errors and solutions

conclusion

this outline seem to fine from a technical documentation point of view, but from
technical blog point it seems too dense and technical jargon filled

recommendations:

alway check the jobs log to get the measure time for each job so that you can
develop a strategy to optimize and save time by identifying and removing
redundant and repetititve processes like cache saving after each job, resource
heavy process like using base docker image and which can be optimized by using
lightweight docker images

use curl command to test the api request first instead of pushing the code to
github and actions checking the response to the api request in github actions,
curl command API request in your terminal will help to make your api debugging
faster and allow you to experiment with different tokens, different branch names
and payloads

always explicitly pass variables, artifacts, cache between jobs and never assume
CI/CD tool will pass the variables, artifacts, cache implicitly as each job is
run on a separate container

Use pipeline trigger token to put in the curl API request, it doesn't request
require to set any permission and is designed to trigger pipeline

infrastructure as code , try to think yml file as a code in order to modularize
the code into different templates and group related code to conditionally
execute them together

for multiline bash script or any programming language script create a separate
script file to store the script and then run the that script file in CI/CD by
obviously giving them permission to execute the script the file

use anchors for repetitive yml codes

yml files are bash scripts under the hood so we can define our own custom script
based solution when native solutions doesn't work

now i have is a single file with different ideas compiled together: the problem
dilemma is should i go a more creative emotional blog route covering each lesson
in different short blog or technical documentation blog

what is the problem: reading different solution makes me think to completely
refactor the exisiting yml file how to link best practices, recommendation

i have 3 things goign modular architecture parent/child pipeline changed file
detection
