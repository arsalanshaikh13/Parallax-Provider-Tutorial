#!/usr/bin/env bash
set -e

echo "Setting up Git configuration..."
git config --global user.email "ci@example.com"
git config --global user.name "CI user"

echo "Adding Gitlab remote"
git remote add gitlab "https://oauth2:${GITLAB_PUSH_TOKEN}@gitlab.com/arsalanshaikh13/Parallax-Provider-Tutorial.git"






echo "Triggering Gitlab pipeline..."
LATEST_TAG=$(git describe --tags 2>/dev/null || echo "")
if [ -n "$LATEST_TAG" ]; then
    echo " Latest Tag is : $LATEST_TAG and pushing it to gitlab"
    git push  gitlab HEAD:$LATEST_TAG
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