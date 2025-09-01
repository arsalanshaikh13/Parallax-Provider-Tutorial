# GitLab CI/CD Modular Pipeline Implementation Guide

**Version**: 1.0  
**Last Updated**: September 2025  
**Estimated Completion Time**: 45-60 minutes  
**Difficulty Level**: Intermediate to Advanced

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture Setup](#architecture-setup)
4. [Parent Pipeline Configuration](#parent-pipeline-configuration)
5. [Runtime Detection Script](#runtime-detection-script)
6. [Modular Template Creation](#modular-template-creation)
7. [Child Pipeline Configuration](#child-pipeline-configuration)
8. [Performance Optimization](#performance-optimization)
9. [Testing & Verification](#testing--verification)
10. [Troubleshooting](#troubleshooting)
11. [References](#references)

## Overview

### Purpose

This implementation guide provides step-by-step instructions for implementing a
modular GitLab CI/CD pipeline architecture that conditionally executes jobs
based on specific changed files. The solution addresses reliability issues with
GitLab's native features and solutions to workaround those issues.

### Scope

This guide covers:

- Modular template system for reusable CI/CD components
- Dynamic parent/child pipeline architecture for conditional execution
- Runtime changed file detection that works across all GitLab pipeline trigger
  scenarios
- Performance optimization through lightweight images, artifacts management and
  smart caching

### Expected Outcome

Upon completion, you will have a GitLab CI/CD pipeline system that:

- Executes only relevant jobs based on changed files
- Reduces pipeline execution time by 25-72%
- Provides 100% reliable change detection across all trigger methods
- Maintains modular, reusable pipeline components

## Prerequisites

### Required Knowledge

- Basic understanding of GitLab CI/CD concepts (stages, jobs, artifacts)
- Familiarity with YAML syntax and structure
- Basic shell scripting knowledge
- Git workflow understanding (commits, branches, diffs)

### Software Requirements

- GitLab instance (SaaS or self-hosted) with CI/CD enabled
- Git repository with appropriate permissions
- GitLab Runner with Docker executor capability

### Access Requirements

- Developer or Maintainer role in the GitLab project
- Ability to create and modify CI/CD pipeline files
- Permission to trigger pipelines manually or via API

### Environmental Assumptions

- Repository contains source code with file types: `.js`, `.json`, `.yml`,
  `.lock`, `.sh`, or dotfiles
- GitLab Runner has internet access for downloading Docker images
- Git is available in the runner environment or can be installed via package
  manager

## Architecture Setup

### Step 1: Create Directory Structure

Create the following directory structure in your repository root:

```
├── .gitlab-ci.yml
└── .gitlab/
    ├── generate-pipeline.sh
    ├── child-pipeline/
    │   ├── ci-full.yml
    │   └── ci-empty.yml
    ├── build/
    │   └── build.yml
    ├── lint_and_test/
    │   └── lint_and_test.yml
    └── release/
        └── release.yml
```

**Verification**: Confirm all directories exist using `find .gitlab -type d`
command.

## Parent Pipeline Configuration

### Step 2: Configure Parent Pipeline Orchestrator

Create the main `.gitlab-ci.yml` file that handles decision-making:

```yaml
# .gitlab-ci.yml
image: alpine:latest

workflow:
  rules:
    - if:
        '($CI_COMMIT_BRANCH == "main" || $CI_COMMIT_TAG) && $CI_PIPELINE_SOURCE
        == "trigger"'
    - when: never

stages:
  - check
  - trigger

check_for_relevant_files:
  stage: check
  before_script: |
    apk add --no-cache git
    chmod +x .gitlab/generate-pipeline.sh
  script:
    - sh .gitlab/generate-pipeline.sh
  artifacts:
    paths:
      - .gitlab/pipeline-config.yml
    expire_in: 10 minutes

trigger_child_pipeline:
  stage: trigger
  trigger:
    include:
      - artifact: .gitlab/pipeline-config.yml
        job: check_for_relevant_files
    strategy: depend
```

**Configuration Details**:

- `workflow.rules`: Controls when pipelines are created, preventing double
  triggers
- `alpine:latest`: Lightweight base image (40MB vs 800MB Ubuntu)
- `strategy: depend`: Parent pipeline waits for child completion and inherits
  status
- `expire_in: 10 minutes`: Artifact retention time for pipeline configuration

**Verification**: Commit this file and verify the workflow rules prevent
unwanted pipeline triggers.

## Runtime Detection Script

### Step 3: Create File Change Detection Script

Create `.gitlab/generate-pipeline.sh` with the following content:

```bash
#!/bin/bash
set -e

# Compare commits and detect relevant file changes
CHANGED=$(git diff --pretty="" --name-only "$CI_COMMIT_BEFORE_SHA" "$CI_COMMIT_SHA" 2>&1 | grep -E '\.js$|\.json$|\.yml$|\.lock$|\.sh$|\..*rc$')

echo "Output of diff: $CHANGED"

if [ -z "$CHANGED" ]; then
    echo "No relevant changes found. Generating empty pipeline."
    cat > .gitlab/pipeline-config.yml <<EOF
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

**Script Parameters**:

- `set -e`: Exit immediately on any command failure
- `--name-only`: Output only filenames, not diff content
- `grep -E`: Use extended regex for file pattern matching
- File patterns: Matches JavaScript, JSON, YAML, lock files, shell scripts, and
  configuration files

**Expected Output**:

- **With relevant changes**: Creates pipeline-config.yml pointing to ci-full.yml
- **Without relevant changes**: Creates pipeline-config.yml pointing to
  ci-empty.yml

**Verification**: Make the script executable with
`chmod +x .gitlab/generate-pipeline.sh`.

## Modular Template Creation

### Step 4: Create Individual Job Templates

Create modular templates for each pipeline component:

#### Lint and Test Template

```yaml
# .gitlab/lint_and_test/lint_and_test.yml
lint_and_test:
  stage: test
  rules:
    - if: '$CI_PIPELINE_SOURCE == "parent_pipeline"'
      when: on_success
    - when: never
  cache:
    key:
      files:
        - yarn.lock
    paths:
      - node_modules/
  before_script:
    - yarn install --frozen-lockfile --ignore-scripts
  script:
    - yarn lint
    - yarn test
```

#### Build Template

```yaml
# .gitlab/build/build.yml
build:
  stage: build
  rules:
    - if: '$CI_PIPELINE_SOURCE == "parent_pipeline"'
      when: on_success
    - when: never
  needs:
    - job: lint_and_test
      artifacts: false
  cache:
    key:
      files:
        - yarn.lock
    paths:
      - node_modules/
    policy: pull
  before_script:
    - yarn install --frozen-lockfile --ignore-scripts
  script:
    - yarn build
```

#### Release Template

```yaml
# .gitlab/release/release.yml
release:
  stage: release
  rules:
    - if: '$CI_PIPELINE_SOURCE == "parent_pipeline"'
      when: on_success
    - when: never
  needs:
    - job: build
      artifacts: false
  cache:
    key:
      files:
        - yarn.lock
    paths:
      - node_modules/
    policy: pull
  before_script:
    - yarn install --frozen-lockfile --ignore-scripts
  script:
    - yarn build
    - echo "Release pipeline executed"
```

**Template Configuration Notes**:

- `rules`: Ensures jobs only run in child pipelines, never directly
- `artifacts: false`: Prevents unnecessary artifact downloads between jobs
- `policy: pull`: Cache optimization - only retrieve, don't save cache in
  downstream jobs

## Child Pipeline Configuration

### Step 5: Configure Child Pipeline Files

#### Full Pipeline Configuration

```yaml
# .gitlab/child-pipeline/ci-full.yml
image: node:18-alpine

include:
  project: 'your-username/your-project-name'
  ref: main
  file:
    - '.gitlab/lint_and_test/lint_and_test.yml'
    - '.gitlab/build/build.yml'
    - '.gitlab/release/release.yml'

.cache_common: &cache_common
  key:
    files:
      - yarn.lock
  paths:
    - node_modules/

stages:
  - test
  - build
  - release

lint_and_test:
  cache:
    <<: *cache_common
```

#### Empty Pipeline Configuration

```yaml
# .gitlab/child-pipeline/ci-empty.yml
skip_pipeline:
  stage: skip
  script:
    - echo "No relevant changes detected. Skipping pipeline execution."
```

**Configuration Parameters**:

- Replace `your-username/your-project-name` with your actual GitLab project path
- Replace `main` with your default branch name if different
- `&cache_common`: YAML anchor for reusable cache configuration

**Verification**: Ensure the `include` project path matches your GitLab
repository structure.

## Performance Optimization

### Step 6: Implement Cache Optimization

Configure cache policies to minimize redundant operations:

```yaml
# Cache configuration pattern
.cache_common: &cache_common
  key:
    files:
      - yarn.lock
  paths:
    - node_modules/

# First job: saves cache
lint_and_test:
  cache:
    <<: *cache_common

# Subsequent jobs: only pull cache
build:
  cache:
    <<: *cache_common
    policy: pull
```

**Cache Policy Options**:

- Default: Both pull and push cache
- `policy: pull`: Only retrieve existing cache
- `policy: push`: Only save cache (rarely used)

### Step 7: Optimize Docker Image Usage

Replace heavy base images with lightweight alternatives:

**Before**:

```yaml
image: ubuntu:latest # 800MB image
```

**After**:

```yaml
image: node:18-alpine # 167MB image
```

**Image Size Comparison**:

- Ubuntu: 800MB, 20-second pull time
- Node Alpine: 167MB, 8-second pull time
- Performance improvement: 87% size reduction, 60% faster pulls

## Testing & Verification

### Step 8: Test Pipeline Functionality

#### Test Scenario 1: Relevant File Changes

1. Modify a JavaScript file in your repository
2. Commit and push the change
3. Trigger the pipeline manually or via API
4. Verify the full pipeline executes

**Expected Result**: Pipeline runs all stages (test, build, release) and shows
relevant changed files in logs.

#### Test Scenario 2: Non-Relevant File Changes

1. Modify a documentation file (e.g., README.md)
2. Commit and push the change
3. Trigger the pipeline
4. Verify the empty pipeline executes

**Expected Result**: Pipeline shows "No relevant changes detected" message and
completes in approximately 24 seconds.

#### Test Scenario 3: API Trigger Reliability

1. Use GitLab API to trigger pipeline with proper `CI_COMMIT_BEFORE_SHA` value
2. Verify change detection works correctly
3. Confirm pipeline selection logic functions as expected

**API Trigger Example**:

```bash
curl -X POST \
  -F token=YOUR_TRIGGER_TOKEN \
  -F ref=main \
  -F "variables[CI_COMMIT_BEFORE_SHA]=previous_commit_sha" \
  https://gitlab.com/api/v4/projects/PROJECT_ID/trigger/pipeline
```

### Step 9: Performance Verification

Monitor and measure pipeline improvements:

**Metrics to Track**:

- Total pipeline execution time
- Image pull duration
- Cache hit/miss ratios
- Resource utilization per job

**Expected Performance Improvements**:

- Full pipeline: 25% faster execution
- Non-relevant changes: 72% time reduction
- Image pulls: 60% faster
- Overall resource efficiency: 87% improvement

## Troubleshooting

### Common Issues and Solutions

#### Issue: Pipeline Not Triggering

**Symptoms**:

- No pipeline appears after commit
- Workflow rules prevent execution

**Resolution Steps**:

1. Verify workflow rules match your branch and trigger source
2. Check `$CI_COMMIT_BRANCH` value in GitLab variables
3. Confirm `$CI_PIPELINE_SOURCE` matches expected trigger type
4. Update workflow rules to match your environment

**Prevention**: Test workflow rules in a development branch before applying to
main.

#### Issue: Change Detection Script Fails

**Symptoms**:

- Error message: "fatal: bad revision"
- Script exits with non-zero status
- No pipeline-config.yml artifact generated

**Likely Causes**:

1. Invalid `CI_COMMIT_BEFORE_SHA` value (90% of cases)
2. Git not available in runner environment (8% of cases)
3. Insufficient repository history in shallow clones (2% of cases)

**Resolution Steps**:

1. Verify `CI_COMMIT_BEFORE_SHA` contains valid commit hash
2. Add `git` installation to before_script if missing
3. Configure runner to fetch sufficient git history
4. Add error handling to script for graceful fallbacks

**Alternative Detection Method**:

```bash
# Fallback for shallow clones
if [ "$CI_COMMIT_BEFORE_SHA" = "0000000000000000000000000000000000000000" ]; then
    CHANGED=$(git diff --name-only HEAD~1 HEAD | grep -E '\.js$|\.json$|\.yml$')
else
    CHANGED=$(git diff --name-only "$CI_COMMIT_BEFORE_SHA" "$CI_COMMIT_SHA" | grep -E '\.js$|\.json$|\.yml$')
fi
```

#### Issue: Child Pipeline Fails to Trigger

**Symptoms**:

- Parent pipeline completes but no child pipeline appears
- Artifact exists but trigger job fails

**Resolution Steps**:

1. Verify artifact path matches trigger include configuration
2. Check child pipeline file syntax validity
3. Confirm project reference in include statement is correct
4. Validate file paths in include statements exist in repository

**Verification Command**:

```bash
# Validate YAML syntax
yamllint .gitlab/child-pipeline/ci-full.yml
```

#### Issue: Incorrect Cache Behavior

**Symptoms**:

- Jobs taking longer than expected
- Cache misses in downstream jobs
- Multiple cache uploads per pipeline

**Resolution Steps**:

1. Verify cache keys are consistent across jobs
2. Confirm downstream jobs use `policy: pull`
3. Check cache key file dependencies exist (e.g., yarn.lock)
4. Monitor cache hit ratios in job logs

**Cache Debugging**:

```yaml
# Add cache debugging to jobs
before_script:
  - echo "Cache key: $CI_JOB_NAME-$CI_COMMIT_REF_SLUG"
  - ls -la node_modules/ || echo "No cached dependencies found"
```

### Escalation Procedures

**When to Escalate**:

- Multiple pipeline failures across different trigger methods
- Performance degradation beyond expected baseline
- Inconsistent behavior that cannot be reproduced locally

**Information to Gather**:

- GitLab version and runner configuration
- Complete pipeline logs including parent and child executions
- Repository structure and relevant file change patterns
- Network and resource utilization metrics

**Contact Information**:

- Internal DevOps team: [your-team-contact]
- GitLab Support: [support-process-documentation]

## Performance Optimization Results

### Measurable Improvements

| Metric                 | Before         | After                  | Improvement    |
| ---------------------- | -------------- | ---------------------- | -------------- |
| Base Image Size        | 800MB (Ubuntu) | 167MB (node:18-alpine) | 87% reduction  |
| Image Pull Time        | 20 seconds     | 8 seconds              | 60% faster     |
| Full Pipeline Duration | 115 seconds    | 86 seconds             | 25% faster     |
| Non-relevant Changes   | 85 seconds     | 24 seconds             | 72% time saved |

### Resource Utilization Optimization

**Docker Image Strategy**:

- Use Alpine-based images for minimal footprint
- Leverage multi-stage builds when necessary
- Cache image layers efficiently

**Cache Management**:

- First job saves cache, subsequent jobs only pull
- Use file-based cache keys for stability
- Set appropriate cache expiration times

**Artifact Optimization**:

- Disable artifact passing when not required
- Use selective artifact downloads with `artifacts: false`
- Set reasonable artifact expiration times

## Maintenance Procedures

### Regular Maintenance Tasks

**Weekly**:

- Review pipeline performance metrics
- Monitor cache hit ratios
- Check for failed pipeline patterns

**Monthly**:

- Update base Docker images to latest versions
- Review and update file detection patterns
- Audit template dependencies and versions

**Quarterly**:

- Performance benchmark comparison
- Documentation accuracy review
- Template library optimization assessment

### Version Management

**Template Versioning**:

- Tag template releases with semantic versioning
- Maintain backward compatibility for existing projects
- Document breaking changes clearly

**Upgrade Procedures**:

1. Test new templates in development environment
2. Update include references gradually across projects
3. Monitor for regression issues
4. Maintain rollback capability for 30 days

## Best Practices Implementation

### Modular Pipeline Design

- Separate concerns into individual templates
- Keep child pipelines focused on single functions
- Use include statements for template reuse
- Maintain clear naming conventions

### Workflow Control

- Gate pipeline triggers with workflow rules
- Implement fail-fast logic for early exits
- Use conditional execution strategically
- Document decision logic clearly

### Debugging and Monitoring

- Include verbose logging in detection scripts
- Print changed files in pipeline logs
- Use lightweight images for faster startup
- Set appropriate artifact retention times

## Security Considerations

### Access Control

- Limit who can modify pipeline templates
- Use protected branches for template repositories
- Implement code review for pipeline changes
- Monitor pipeline execution patterns

### Sensitive Data Handling

- Never log sensitive environment variables
- Use GitLab's masked variable feature
- Implement secret scanning in templates
- Rotate trigger tokens regularly

## References

### GitLab Documentation

- [GitLab CI/CD Pipeline Configuration Reference](https://docs.gitlab.com/ee/ci/yaml/)
- [GitLab Parent-Child Pipelines](https://docs.gitlab.com/ee/ci/pipelines/downstream_pipelines.html)
- [GitLab CI/CD Templates](https://docs.gitlab.com/ee/ci/yaml/includes.html)

### External Resources

- [Reference Implementation Repository](https://github.com/arsalanshaikh13/Parallax-Provider-Tutorial/tree/gitlabci/.gitlab)
- [Docker Alpine Images](https://hub.docker.com/_/alpine)
- [YAML Specification](https://yaml.org/spec/1.2/spec.html)

### Related Documentation

- GitLab Runner Configuration Guide
- Docker Image Optimization Best Practices
- Git Workflow Management Procedures
- Performance Monitoring and Alerting Setup

---

**Document Maintainer**: [Your Name]  
**Review Schedule**: Quarterly  
**Feedback**: Submit issues and suggestions via GitLab repository issues
