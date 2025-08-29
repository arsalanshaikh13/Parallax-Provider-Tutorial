#!/bin/sh
set +e # gitlabci exits immediately by default due set -e so reverse the exit condition here to capture error
# initalize the bool variable
# if [  "$CI_COMMIT_BEFORE_SHA" = "0000000000000000000000000000000000000000" ] ||
#     ! git cat-file -e "$CI_COMMIT_BEFORE_SHA" >/dev/null 2>&1; then

#     CHANGED=$(git show --pretty="" --name-only "$CI_COMMIT_SHA" 2>&1 | grep -E '\.js$|\.json$|\.yml$|\.lock$|\.sh$|\..*rc$' )
#     echo "used git show"
# else
#     CHANGED=$(git diff --pretty="" --name-only "$CI_COMMIT_BEFORE_SHA" "$CI_COMMIT_SHA" 2>&1  | grep -E '\.js$|\.json$|\.yml$|\.lock$|\.sh$|\..*rc$' )
#     echo "used git diff with variable using from api commit before sha -> $CI_COMMIT_BEFORE_SHA and current commit $CI_COMMIT_SHA"
# fi
CHANGED=$(git diff --pretty="" --name-only "$CI_COMMIT_BEFORE_SHA" "$CI_COMMIT_SHA" 2>&1  | grep -E '\.js$|\.json$|\.yml$|\.lock$|\.sh$|\..*rc$' )
echo "used git diff with variable using from api commit before sha -> $CI_COMMIT_BEFORE_SHA and current commit $CI_COMMIT_SHA"

echo "output of diff: $CHANGED "
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
