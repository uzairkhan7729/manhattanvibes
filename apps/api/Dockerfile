# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS deps
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ packages/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter=@mv/api...

FROM deps AS build
COPY apps/api ./apps/api
RUN pnpm --filter=@mv/api build

FROM gcr.io/distroless/nodejs22-debian12 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/package.json ./package.json
COPY --from=build /repo/node_modules ./node_modules
USER nonroot
EXPOSE 3000
CMD ["dist/main.js"]
