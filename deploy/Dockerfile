FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev --ignore-scripts && npm rebuild esbuild sharp workerd
COPY dist ./dist
COPY drizzle ./drizzle
COPY deploy/server.mjs ./deploy/server.mjs
ENV NODE_ENV=production DATA_DIR=/data
RUN mkdir /data && chown node:node /data /app
USER node
EXPOSE 8787
CMD ["node", "deploy/server.mjs"]
