#!/bin/sh
set +e # gitlabci exits immediately by default due set -e so reverse the exit condition here to capture error
# initalize the bool variable
if [ "$CI_COMMIT_BEFORE_SHA" = "0000000000000000000000000000000000000000" ] ||
    ! git cat-file -e "$CI_COMMIT_BEFORE_SHA" >/dev/null 2>&1; then

    CHANGED=$(git show --pretty="" --name-only "$CI_COMMIT_SHA" 2>&1 | grep -E '\.js$|\.json$|\.yml$|\.lock$|\..*rc$' )
else
    CHANGED=$(git diff --pretty="" --name-only "$CI_COMMIT_BEFORE_SHA" "$CI_COMMIT_SHA" 2>&1  | grep -E '\.js$|\.json$|\.yml$|\.lock$|\..*rc$' )
fi
echo "output of diff: $CHANGED "
if [ -z "$CHANGED" ]; then
    echo "No relevant changes found. Generating empty pipeline."
    cat  > .gitlab/pipeline-config.yml <<EOF
include:
  - local: '.gitlab/ci-empty.yml'
EOF
        echo "Reached end of condition block"
else
    echo "Found relevant changes: $CHANGED"
    cat > .gitlab/pipeline-config.yml <<EOF
include:
  - local: '.gitlab/ci-full.yml'
EOF
    echo "Reached end of condition block"
fi
