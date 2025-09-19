FROM node:18-alpine

WORKDIR /app

COPY package.json yarn.lock  /app

RUN yarn install --frozen-lockfile

COPY . .

# Expose the port used in webpack.config.js
EXPOSE 3000

# Default command
CMD ["yarn", "start"]
