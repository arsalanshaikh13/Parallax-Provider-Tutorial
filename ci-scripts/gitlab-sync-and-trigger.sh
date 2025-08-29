#!/usr/bin/env bash
set -e


echo "Adding Gitlab remote"
echo "$GITHUB_REF_TYPE  is github_ref_type and $GITHUB_REF  is github_Ref and ${GITHUB_REF#refs/tags/}"
# https://docs.gitlab.com/topics/git/troubleshooting_git/#error-on-git-fetch-http-basic-access-denied
git config --global user.name "arsalanshaikh13"
git remote add gitlab "https://oauth2:${GITLAB_PUSH_TOKEN}@gitlab.com/arsalanshaikh13/Parallax-Provider-Tutorial.git"
PREVIOUS_COMMIT=$(git rev-parse HEAD~1)
echo "COMMIT_BEFORE_SHA: $PREVIOUS_COMMIT"


if [[ "$GITHUB_REF_TYPE" == "tag" ]]; then
    echo "tag found"
    echo "Waiting for GitLab to register the tag..."
    LATEST_TAG="${GITHUB_REF#refs/tags/}"
    git push  gitlab $LATEST_TAG
    sleep 5
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
    # https://docs.gitlab.com/api/pipelines/#:~:text=Basic%20example:,/projects/1/pipeline?
    curl -X POST \
        -H "PRIVATE-TOKEN: ${GITLAB_PAT}" \
        -H "Content-Type: application/json" \
        -d "{\"ref\":\"${GITLAB_BRANCH}\", \"variables\":[{\"key\":\"CI_COMMIT_BEFORE_SHA\", \"value\":\"COMMIT_BEFORE_SHA_HERE\"}]}" \
        "https://gitlab.com/api/v4/projects/${GITLAB_PROJECT_ID}/pipeline"
fi

