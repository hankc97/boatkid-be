FROM node:latest

WORKDIR /app

COPY . .

COPY ["package.json","bun.lockdb"] .

RUN npm i -g bun

RUN bun install

RUN bun add -g @nestjs/cli

CMD [ "npm","run","start:dev" ]