# Building Dynamic CircleCI Pipelines: An Implementation Guide

### Intro: The Common Problems

In most real-world CI/CD setups, developers run into the same set of
frustrations:

- **Longer build times** that kill feedback loops and developer productivity.
- **Monolithic config files** that are hard to navigate, maintain, and extend.
- **Pipelines running unnecessarily** on every file change, even when
  irrelevant.

These issues don’t just waste compute resources — they erode the developer
experience, slow down delivery, and make pipelines feel like a cumbersome and
overwhelming to manage.

### Why This Matters

Why should we bother fixing these? Because solving them pays off directly:

- **Avoid wasted runs → save compute resources.**
- **Cleaner, modular configs → easier maintenance and onboarding.**
- **Control over pipelines → pipelines run when they should, not when they
  shouldn’t.**
- **Faster builds → keep developers in the flow and coding with confidence.**

The result? A pipeline that boosts productivity, not become a bottleneck.

### My Implementation Approach

To address these problems, I designed a **CircleCI implementation setup** that:

- Speeds up build times.
- Modularizes configuration for easier maintenance.
- Provides complete control over when and how jobs run.

This design not only improved performance but also made the pipeline scalable,
predictable, and pleasant to work with.

### What You’ll Learn in This Deep Dive

In the sections ahead, I’ll break down my implementation step by step.
Specifically, I’ll cover:

1. **The 4 Core Implementations** — what I built, what problems it solves and
   how it works.
2. **Edge cases and Problem Resolution**: the challenges came up during
   implementation
3. **Root Cause Analysis** — critical insights into CircleCI behavior.
4. **Best Practices & Recommendations** — lessons distilled into guidelines you
   can apply to your own pipelines.

So, let’s dive in.

## Implementation Details

### 1. Modular Architecture

**Layout**

```
.circleci/
├── config.yml                  # parent pipeline (setup: true)
├── preprocessor.sh
└── src/                        # child pipeline
    ├── @config.yml             # contains all the common code like executors, parameters
    ├── jobs/                   # individual jobs
    │   ├── install.yml
    │   ├── lint_and_test.yml
    │   ├── build.yml
    │   └── publish.yml
    └── workflows/              # individual workflows
        └── workflow.yml
```

#### Component Responsibilities

| Component               | Purpose                                                                   | Key Benefit                                                                  |
| ----------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Parent Pipeline**     | runs preprocessor and generates child pipeline by detecting changed files | handles all the decision making logic                                        |
| **Child Pipelines**     | group all the related workflows together                                  | Clean separation of concerns and isolate execution logic from decision logic |
| **Modular Templates**   | isolate jobs to their own files                                           | Reusable job whenever required                                               |
| **Preprocessor Script** | Concatenate all the modular files for child pipeline                      | allows to keep files modular                                                 |

#### Design Decision: Monolithic vs Modular CI/CD Workflows

When weighing **monolithic vs. modular CI/CD**, the tradeoff is clear:

- **Monolithic** pipelines are simpler to set up initially but quickly become
  slow, fragile, and difficult to maintain as the codebase grows.
- **Modular** pipelines require more upfront design but provide scalability,
  easier debugging, and safer parallel development.

I chose **modular** because the long-term benefits—**faster feedback, reduced
duplication, and maintainable workflows**—far outweigh the short-term simplicity
of monolithic setups.

### 2. Dynamic Parent/Child Pipeline Architecture for Conditional Execution

**Problems with the Previous Approach:**

- The **entire pipeline is triggered** for any file change (even irrelevant
  ones).
- Each job requires **duplicated conditional checks**, which makes the setup:
  - **Cumbersome** to implement and maintain.
  - **Error-prone** to debug as complexity grows.
  - **Slower to evaluate** since developers must scan through all jobs.
  - **Redundant** with repeated conditions across jobs.
  - **Hard to scale** with growing file/job count.

- **Developer productivity loss**: wasted CI minutes and slow, non-deterministic
  feedback loops when pipelines run unnecessarily.

**Root Causes:**

- **Monolithic pipeline structure**: All jobs are visible to the scheduler even
  if irrelevant.
- **No job grouping**: No mapping between changed files and impacted jobs.
- **Decentralized logic**: Conditions scattered across multiple jobs, leading to
  inconsistency.
- **Unreliable feedback**: Developers can’t clearly see what triggered
  execution.

**Solution – Dynamic Parent/Child Architecture:**

- **Group jobs** logically into a “full pipeline” (child pipeline) that only
  runs when relevant files are changed.
- Use a **lightweight parent pipeline** to detect file changes.
- Based on detection:
  - If **relevant files change** → trigger the **child-full pipeline** (grouped
    jobs executed).
  - If **no relevant files change** → skip pipeline.

**Parent Pipeline code**: It is a **lightweight orchestrator** that generates
the actual child pipeline (`config_continued.yml`) and uses **file-change
detection** to decide which workflows/jobs in the child should execute.

```yml
# .circleci/config.yml
# this is the main setup file for dynamic configuration
version: 2.1

#this is the required directive to enable dynamic configuration
setup: true

# Use the path-filtering orb to check for changed files
orbs:
  path-filtering: circleci/path-filtering@2.0.2

executors:
  default-executor:
    # using the lightweight image as their is no complex script involved
    docker:
      - image: busybox:latest

jobs:
  generate-config:
    executor: default-executor
    steps:
      - checkout
      - run:
          # concatenate different modular files into single file used for child pipeline
          name: Generate config_continued.yml
          command: sh .circleci/preprocessor.sh

      # making config_continued.yml file available for path-filtering/filter job
      - persist_to_workspace:
          root: .
          paths:
            - .circleci/config_continued.yml

# the setup workflow that runs first on everypipeline
workflows:
  path-filtering-setup:
    jobs:
      # by default runs on any branch(but can set any specific branch if you want) and only on specific tag
      - generate-config:
          filters:
            tags:
              only: /^v\d+\.\d+\.\d+-circleci\.\d+$/

      - path-filtering/filter:
          # this job is dependent on generate-config job
          requires:
            - generate-config

          # compare the current commit against the previous commit in this branch
          # set it to the branch on which you are triggering pipeline
          base-revision: circleci
          # this is the path to the second configuration file to run
          config-path: .circleci/config_continued.yml
          # Define the mapping of regex patterns to pipeline parameters
          mapping:
            # Trigger the build_and_release workflow for this file extenisons
            # this regex will match any .js, .json, .yml, or .rc
            (.*\.(js|json|yml)$)|(\..*rc$) run-build-and-release true
          # by default path-filter always works for branches so no need for mentioning filter branch
          # filters is only required for tag push
          filters:
            tags:
              only: /^v\d+\.\d+\.\d+-circleci\.\d+$/
          checkout: true
          workspace_path: .
```

**Child pipeline**: handles all the job execution logic

```yml
# this file is concatenating different modular files from shared folder using preprocessor.sh which i will cover in next section
# .circleci/config_continued.yml
# this file is dynamically loaded by the setup config if file changes are detected
version: 2.1
# this parameter will be passed from the path-filtering orb.
# it is set to 'true' if the file regexes in config.yml have a match
parameters:
  run-build-and-release:
    type: boolean
    default: false
# Define reusable executor
executors:
  node_executor:
    docker:
      # - image: cimg/node:18.20
      # updated: using the lightweight 'node:18-alpine' image for faster download in ci setup and faster pipelines
      - image: node:18-alpine

anchors:
  tag_filter: &tag_filter
    tags:
      only: /^v\d+\.\d+\.\d+-circleci\.\d+$/ # Updated regex to match the corrected tag format
  branch_filter: &branch_filter
    branches:
      only: circleci

jobs:
  install:
    executor: node_executor
    steps:
      - checkout
      - restore_cache:
          keys:
            - yarn-deps-{{ checksum "yarn.lock" }}
      # may not have git or yarn pre-installed
      - run: apk add --no-cache git
      - run: yarn install
      - save_cache:
          paths:
            - node_modules
          key: yarn-deps-{{ checksum "yarn.lock" }}
      - persist_to_workspace:
          root: .
          paths:
            - node_modules

  lint_and_test:
    executor: node_executor
    steps:
      - checkout
      - attach_workspace:
          at: .
      - run: yarn lint
      - run: yarn test

  build:
    executor: node_executor
    steps:
      - checkout
      - attach_workspace:
          at: .
      - run: yarn build
      - persist_to_workspace:
          root: .
          paths:
            - dist

  publish:
    executor: node_executor
    steps:
      - checkout
      - attach_workspace:
          at: .
      - run:
          name: Authenticate with npm
          command: |
            # Use the NPM_TOKEN environment variable for authentication
            echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" >> ~/.npmrc
      - run: npm publish

# Consolidate workflows into a single, filtered workflow
workflows:
  version: 2.1
  build_and_release:
    when: << pipeline.parameters.run-build-and-release >>
    jobs:
      - install:
          filters:
            <<: *branch_filter
            <<: *tag_filter
      - lint_and_test:
          requires:
            - install
          filters:
            <<: *branch_filter
            <<: *tag_filter
      - build:
          requires:
            - lint_and_test
          filters:
            <<: *branch_filter
            <<: *tag_filter
      - publish:
          requires:
            - build
          filters:
            branches:
              ignore: /.*/ # Ignore all branches
            <<: *tag_filter
```

> You can find the source code in the
> [reference repository](https://github.com/arsalanshaikh13/Parallax-Provider-Tutorial/tree/circleci/.circleci).

#### Here's How it works

**Key Components**

1. **Dynamic Setup Mode (`setup: true`)**
   - This tells CircleCI that this pipeline is not the final one — instead, it’s
     a **setup pipeline** that will dynamically generate or select the _real_
     child pipeline to run.
   - Think of it as a bootstrapper.

2. **Path Filtering Orb (`circleci/path-filtering`)**
   - This orb is like a **file change detector**.
   - It compares files changed in the commit against regex rules you define
     (e.g., `.js`, `.json`, `.yml`).
   - Based on matches, it sets pipeline parameters (like
     `run-build-and-release = true`).

3. **Executor (`busybox`)**
   - A **lightweight container image** is used since the parent only needs to
     run simple shell scripts — no heavy build environment is required.

4. **`generate-config` Job**
   - Runs first.
   - It **concatenates modular pipeline files** into a single
     `config_continued.yml`.
   - That file represents the **child pipeline** (the real pipeline to run).
   - Then, it shares the file via **workspace** so the next job can access it.

5. **Setup Workflow**
   - Runs two jobs:
     - `generate-config` → builds the child pipeline config.
     - `path-filtering/filter` → checks changed files, applies regex rules, and
       decides which workflows in the child config should run.

   - The `filter` job reads from `config_continued.yml` and triggers the right
     child workflows based on your mapping rules.

**Execution**

1. A commit or tag push happens → Parent pipeline starts.
2. Parent runs `generate-config` → produces `config_continued.yml`.
3. Parent runs `path-filtering/filter`:
   - Looks at changed files.
   - Matches them against regex rules.
   - Sets parameters (e.g., `run-build-and-release = true`).
   - Passes control to the **child pipeline (`config_continued.yml`)** with the
     right parameters.

**Benefit of this implementation**

- **Centralized logic**: Instead of sprinkling `when` conditions across dozens
  of jobs, logic is handled once in the parent.
- **Efficiency**: Pipelines only run when relevant files change.
- **Scalability**: New jobs can be added in modular configs without editing the
  parent.
- **deterministic feedback and Clarity**: Developers know exactly _why_ a
  pipeline triggered, because the decision-making is explicit in path-filter
  rules.
- Saves **CI resources and developer time**, focusing runs only on meaningful
  changes.

### 3. Script to concatenate modular files

**Problem:** CircleCI's native tool `circleci config pack` has **rigid
structural requirements**:

- Everything must be organized inside a `shared/` folder.
- Job folder name must match job name.
- All jobs must live inside a `jobs/` folder.
- All workflows must live inside a `workflows/` folder.
- It will concatenate the files in alphabetical order and not in job relevance
  order

This makes it cumbersome when projects have different conventions or when teams
want more flexibility.

**Cause:**

- It was designed with a **one-size-fits-all assumption**, prioritizing
  standardization over flexibility.
- Enforcing folder naming conventions makes parsing easier for the tool but
  harder for developers maintaining real-world pipelines.
- it follows the standard alphabetical file naming convention

**Solution:**

- **preprocessor script** removes all structural constraints.
- You can organize jobs, workflows, and templates **in any folder or naming
  convention** that makes sense for your team.
- The preprocessor concatenates them automatically into a valid child config.

```sh
# .circleci/preprocessor.sh
# you can customise the preprocessor script to suit your file naming convention

#!/bin/bash
set -e

OUTPUT_FILE=".circleci/config_continued.yml"

echo "# Circle CI config split up in modules" > $OUTPUT_FILE
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

> You can find the source code in the
> [reference repository](https://github.com/arsalanshaikh13/Parallax-Provider-Tutorial/tree/circleci/.circleci).

#### Here’s how it works step by step:

The **preprocessor** acts as a **config builder**. Instead of maintaining one
giant `config.yml`, you split it into smaller, modular files (executors, jobs,
workflows). The script then stitches them together into a single
`config_continued.yml` that CircleCI can run.

1. **Initialization**
   - Creates a `config_continued.yml`.
   - Adds a header comment for clarity.

2. **Executors Section**
   - If a base executor config (`@config.yml`) exists, it appends it first.
   - This lets you define shared codes (like executors, anchors, parameters)
     once.

3. **Jobs Section**
   - Adds a `jobs:` key.
   - Iterates through all `.yml` files in `.circleci/src/jobs/`.
   - Each job file is indented properly (so CircleCI recognizes them as part of
     `jobs:`) and appended to the output.

4. **Workflows Section**
   - Adds a `workflows:` key.
   - Appends the content of a single workflow definition file (`workflow.yml`).
   - This ensures all jobs defined earlier are connected via workflows.

5. **Result**
   - Final output is a **syntactically valid single config file**
     (`config_continued.yml`) ready for CircleCI.
   - Developers never touch this file directly — they only work with modular
     files.

#### Why It’s Useful

- **Keeps config modular** → Each job or workflow is in its own file.
- **Reduces duplication** → Shared logic lives in one place.
- **Improves maintainability** → Easier to add/remove jobs without breaking
  everything.
- **Keeps CircleCI happy** → Even though CircleCI requires a single YAML, you
  still work in modular files.
- **Full flexibility**: Teams can adopt folder structures that match their
  codebase, not a tool’s rigid rules.
- **Scalability**: As the pipeline grows, you can modularize logically (by
  service, feature, or team) instead of being forced into a flat structure.

### 4. Performance optimization through lightweight images and caching strategy

#### Lightweight images vs Full-featured base Images

**Problem**: Default `cimg/base:latest` images taking long time to just load the
images

**Cause**: Base images are bigger in size because having high amount of tools
built in

**Solution**: Most of the base images features were not required by my projects
so i used `node-18:Alpine` Linux for most jobs, `busybox:latest` images only
when needed

**Benefit** Huge size reduction significantly improved pipeline speed

#### Caching strategy

- **Problem:** time wasted in installing same dependencies in many jobs

- **Cause:** no cache set in the jobs

- **Solutions:**
  - install job restores and saves cache and persists the node_modules
  - the subsequent jobs use the node_modules saved in the workspace as these
    jobs are largely independent but need to restore a common set of
    dependencies, like node_modules

```yml
install:
    steps:
      - restore_cache:
          keys:
            - yarn-deps-{{ checksum "yarn.lock" }}
      - run: yarn install
      - save_cache:
          paths:
            - node_modules
          key: yarn-deps-{{ checksum "yarn.lock" }}
      - persist_to_workspace:
          root: .
          paths:
            - node_modules

  lint_and_test:
    steps:
      - attach_workspace:
          at: .

  build:
    steps:
      - attach_workspace:
          at: .

```

> You can find the source code in the
> [reference repository](https://github.com/arsalanshaikh13/Parallax-Provider-Tutorial/tree/circleci/.circleci).

**Benefit**: Improved job execution speed

## Edge Cases & Problem Resolution

### Case 1: Workspace File Availability

**Problem**: Generated configuration files not accessible to path-filtering jobs

**Root Cause**: Files generated in one container aren't automatically available
in subsequent containers

**Solution**: Explicit workspace persistence and attachment

```yaml
# Generator job
- persist_to_workspace:
    root: .
    paths:
      - .circleci/config_continue.yml

# Consumer job
path-filtering/filter:
  workspace_path: .
```

**Impact**: Ensures dynamically generated files are available when the filter
runs.

### Case 2: path-filtering/filter job is not executed

**Problem**: `Directory not empty and not a git repository` errors

**Root Cause**: Incorrect ordering of `checkout` and `attach_workspace`
operations. The job has to first checkout in the container and then access the
workspace artifacts

**Solution**: Consistent operation ordering

```yaml
path-filtering/filter:
  checkout: true
  workspace_path: .
```

**Impact**: Prevents git state corruption and eliminates race conditions.

### Case 3: Silent Tag Filtering Failures

**Problem**: Pipeline not running on tag push

**Root Cause**: if the dependent job has tag filter but dependency job does not
has tag filter workflow doesn't get executed, dependency and dependent job both
must have same filter to execute the workflow

**Solution**: dependency and dependent job has same filter to execute the
workflow

```yaml
jobs:
  # dependency job
  - generate-config:
    filters:
      tags:
        only: /^v\d+\.\d+\.\d+-circleci\.\d+$/
  # dependent job
  - path-filtering/filter:
      requires: generate-config # this makes the job dependent
      filters:
        tags:
          only: /^v\d+\.\d+\.\d+-circleci\.\d+$/
```

**Impact**: Ensures tag push trigger appropriate pipeline execution.

## Deep Root-Cause Analysis (Key Points)

- **Workspace & Ordering**
  - Each workflow job runs in its own isolated container.
  - Files must be explicitly shared via **workspaces**.
  - If the generated continuation config (`config_continued.yml`) is not
    **persisted in the generator job** and **attached in the consumer job**, the
    `path-filtering` orb cannot find it.
  - Fix → Always `persist_to_workspace` in the generator and `attach_workspace`
    in the next job (or run the generator as a pre-step).

- **Checkout vs Attach Workspace**
  - `checkout` must come **before** `attach_workspace` in jobs that need both
    repo code + workspace.
  - Otherwise, Git throws errors (`directory not empty`) or double-checkouts
    occur.
  - Note: Some orb jobs automatically run `checkout`, so ordering in `pre-steps`
    is critical.

- **Filters Evaluation**
  - Filters (branch, tags) are resolved at **compile-time**, not at runtime.
  - If the `generate-config` job does not include the same tag filters as its
    dependent jobs, those dependent jobs are silently excluded on tag runs.
  - Fix → Ensure `generate-config` has **matching filters** for branches/tags as
    its dependent path-filtering/filter job.

- **File Concatenation Order**
  - CircleCI’s config pack logic doesn’t infer **semantic ordering** .
  - By default, it merges files in alphabetical order.
  - Fix → Explicitly control file concatenation order (e.g., via the
    preprocessor script).

## Best Practices & Recommendations

- **Filters & Workflow Generation**
  - Ensure the `generate-config` job has the **same filters** (branch/tag) as
    its dependent jobs.
  - Without matching filters, workflows may silently fail to generate.

- **Avoid redundant installs through caching**
  - Use **`save_cache` / `restore_cache`** for independent jobs
  - Use `persist_to_workspace` for dependency jobs and `attach_workspace` at
    jobs that depend directly on outputs of dependency jobs for transferring
    dependencies like `node_modules` across jobs

- **Dependency Management**
  - Always lock dependencies strictly with `yarn install --frozen-lockfile` or
    `npm ci`.
  - Prevents inconsistencies between local and CI builds.

- **Docker Image Selection**
  - Prefer lightweight images over base images (`busybox:latest`,
    `node-18:alpine` + required tools).

- **Shell Scripts & Automation**
  - Always mark scripts executable (`chmod +x script.sh`).
  - Keep scripts small, modular, and version-controlled for easier debugging.

- **Security & Secrets Management**
  - Store sensitive tokens and credentials in **CircleCI environment
    variables**.
  - Access metadata via built-ins (`$CIRCLE_BRANCH`, `$CIRCLE_TAG`,
    `$NPM_TOKEN`) instead of hardcoding.

- **Workspace Ordering & Git Checkout**
  - Run `checkout` **before** `attach_workspace` in job steps or pre-steps.
  - Prevents Git errors and ensures a clean repo state.

## Conclusion

Building a dynamic, modular CircleCI pipeline is not just about cleaner
YAML—it’s about creating a CI/CD system that is predictable, maintainable, and
developer-friendly. By addressing problems associated with monolithic
architecture, unnecessary pipeline execution, slower build times we turn fragile
pipelines into reliable workflows that scale with project complexity. The
implementation of modular architecture, parent/child pipeline, custom script to
concatenate modular files and performance optimization through lightweight
images and caching strategy incrementally added to better performance of the
pipeline. Together, they enable faster feedback loops, fewer wasted runs, and a
development experience that keeps engineers focused on shipping features rather
than wrestling with CI/CD.
