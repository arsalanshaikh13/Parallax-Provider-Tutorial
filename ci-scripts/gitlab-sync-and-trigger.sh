#!/usr/bin/env bash
set -e

echo "Setting up Git configuration..."
git config --global user.email "ci@example.com"
git config --global user.name "CI user"

echo "Adding Gitlab remote"
git remote add gitlab "https://oauth2:${GITLAB_PUSH_TOKEN}@gitlab.com/arsalanshaikh13/Parallax-Provider-Tutorial.git"



echo "Fetching latest from Gitlab"
git fetch gitlab ${GITLAB_BRANCH}   

echo "Rebasing Github HEAD onto Gitlab branch: ${GITLAB_BRANCH}"
git pull gitlab "${GITLAB_BRANCH}" --rebase


echo "Pushing latest commit to Gitlab branch: ${GITLAB_BRANCH}"
git push gitlab HEAD:${GITLAB_BRANCH}

echo " Triggering Gitlab pipeline..."
curl -X POST \
    -H "PRIVATE-TOKEN: ${GITLAB_PAT}" \
    -H "Content-Type: application/json" \
    -d "{\"ref\":\"${GITLAB_BRANCH}\"}" \
    "https://gitlab.com/api/v4/projects/${GITLAB_PROJECT_ID}/pipeline"
