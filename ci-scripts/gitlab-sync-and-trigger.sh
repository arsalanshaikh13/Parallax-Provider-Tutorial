#!/usr/bin/env bash
set -e

echo "Setting up Git configuration..."
git config --global user.email "ci@example.com"
git config --global user.name "CI user"

echo "Adding Gitlab remote"
git remote add gitlab "https://oauth2:${GITLAB_PUSH_TOKEN}@gitlab.com/arsalanshaikh13/Parallax-Provider-Tutorial.git"


LATEST_TAG=$(git describe --tags 2>/dev/null || echo "")
echo " Latest Tag is : $LATEST_TAG and pushing it to gitlab"

set +e # do not exit immediately on error below
echo "Triggering Gitlab pipeline..."
ERROR_VAR=$(git push  gitlab $LATEST_TAG 2>&1)
echo "ERROR_VAR is $ERROR_VAR"
set -e # if there is any error in below lines exit immediately

if [[  "$ERROR_VAR" != "*error:*" ]]; then
    echo "Push succeeded"
    echo "Waiting for GitLab to register the tag..."
    sleep 5
    echo "Triggering Gitlab pipeline on tag push..."
    
    
    curl -X POST \
        -H "PRIVATE-TOKEN: ${GITLAB_PAT}" \
        -H "Content-Type: application/json" \
        -d "{\"ref\":\"$LATEST_TAG\"}" \
        "https://gitlab.com/api/v4/projects/${GITLAB_PROJECT_ID}/pipeline"
else
    echo "No tags found"
    echo "Force pushing latest commit GitHub code to GitLab..."
    git push --force  gitlab HEAD:${GITLAB_BRANCH}

    echo "Triggering Gitlab pipeline on branch push..."
    curl -X POST \
        -H "PRIVATE-TOKEN: ${GITLAB_PAT}" \
        -H "Content-Type: application/json" \
        -d "{\"ref\":\"${GITLAB_BRANCH}\"}" \
        "https://gitlab.com/api/v4/projects/${GITLAB_PROJECT_ID}/pipeline"
fi