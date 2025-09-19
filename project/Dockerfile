FROM node:18-alpine

WORKDIR /app

COPY package.json yarn.lock /app

RUN yarn install --frozen-lockfile

COPY . .

# Expose the port used in webpack.config.js
EXPOSE 3000

# Default command
CMD ["yarn", "start"]


copy the webpack.config.js , dockerfile in parallaxturtlelib
in ci yml files, instead of publishing the package to npm package manageer
create a new job where we are building the dockerimage for only project folder 
push that dockerimage to docker hub
pull the image from kubernetes to run the container
upload the image to vercel/githubpages/netlify/aws