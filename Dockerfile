# use Node.js 18 alpine base image
FROM node:18-alpine

# set the working directory
WORKDIR /app

# copying package manifests first (for better caching)
COPY package.json yarn.lock /app/

# install dependencies
RUN yarn install --frozen-lockfile

# copy rest of the project
COPY . .

ENV PATH=/app/node_modules/.bin:${PATH}


# create docker image with installed dependencies
# push the image to container registry
# pull the image in circleci
# run yarn test and build
# how to test my image