#!/usr/bin/env bash
set -e


echo "Adding Gitlab remote"
echo "$GITHUB_REF_TYPE  is github_ref_type and $GITHUB_REF  is github_Ref and ${GITHUB_REF#refs/tags/}"

git remote add gitlab "https://oauth2:${GITLAB_PUSH_TOKEN}@gitlab.com/arsalanshaikh13/Parallax-Provider-Tutorial.git"

# git diff section
# don't exit immediately in this operation since we want to capture the error to display the message
set +e
PREVIOUS_COMMIT=$(git rev-parse HEAD~1)
echo "COMMIT_SHA: $GITHUB_SHA"
echo "COMMIT_BEFORE_SHA: $PREVIOUS_COMMIT"

# CHANGED=$(git show --pretty="" --name-only "$GITHUB_SHA"  | grep -E '\.js$|\.json$|\.yml$|\..*rc$' 2>/dev/null)

CHANGED=$(git diff --name-only "$PREVIOUS_COMMIT" "$GITHUB_SHA"  | grep -E '\.js$|\.json$|\.yml$|\..*rc$' 2>/dev/null)
if [ -z "$CHANGED" ]; then
echo "No relevant changes found. Stopping pipeline."
exit 1
fi
echo "Found relevant changes: $CHANGED"
# now if there is any error below exit immediately
set -e

if [[ "$GITHUB_REF_TYPE" == "tag" ]]; then
    echo "tag found"
    echo "Waiting for GitLab to register the tag..."
    LATEST_TAG="${GITHUB_REF#refs/tags/}"
    git push  gitlab $LATEST_TAG
    sleep 1
    echo "Triggering Gitlab pipeline on tag push..."
    curl -X POST \
        -H "PRIVATE-TOKEN: ${GITLAB_PAT}" \
        -H "Content-Type: application/json" \
        -d "{\"ref\":\"$LATEST_TAG\"}" \
        "https://gitlab.com/api/v4/projects/${GITLAB_PROJECT_ID}/pipeline"

else
    echo "No tags found"
    echo " pushing latest commit GitHub code to GitLab..."
    git push --force gitlab HEAD:${GITLAB_BRANCH}

    echo "Triggering Gitlab pipeline on branch push..."
    curl -X POST \
        -H "PRIVATE-TOKEN: ${GITLAB_PAT}" \
        -H "Content-Type: application/json" \
        -d "{\"ref\":\"${GITLAB_BRANCH}\"}" \
        "https://gitlab.com/api/v4/projects/${GITLAB_PROJECT_ID}/pipeline"
fi