# node:sqlite needs Node 22.13 or later.
FROM node:22-slim
WORKDIR /app

COPY . .
RUN npm ci
# The client carries the version it was built as; version.txt says what is being served now.
RUN export VITE_BUILD_VERSION=$(date +%s) \
  && npx vite build client \
  && echo "$VITE_BUILD_VERSION" > client/dist/version.txt

ENV NODE_ENV=production
ENV DATABASE_PATH=/data/runic.db
RUN mkdir /data && chown node /data
USER node
EXPOSE 2567

# Exec form, and node itself rather than npm or the tsx wrapper, so SIGTERM reaches the shutdown save.
CMD ["node", "--import", "tsx", "server/src/main.ts"]
