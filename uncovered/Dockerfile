# Uncovered: the site, the research engine and its API in one Node process.
#
#   docker build -t uncovered --build-arg SITE_URL=https://uncovered.example .
#   docker run -p 8080:8080 -v uncovered-data:/data \
#     -e ANTHROPIC_API_KEY=... -e UNCOVERED_ACCESS_CODES=... uncovered

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG SITE_URL
ENV SITE_URL=${SITE_URL}
RUN npm run build && npm run build:server

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-ssr ./dist-ssr
COPY --from=build /app/dist-server ./dist-server
# The scripted test engine's document, for UNCOVERED_ENGINE=fixture demonstrations.
COPY server/fixtures/primer-letno-porocilo-2025.pdf ./server/fixtures/
RUN mkdir -p /data && chown node:node /data
USER node
ENV PORT=8080 \
    UNCOVERED_DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist-server/main.js"]
