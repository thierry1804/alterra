FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl chromium

FROM base AS deps
COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/
# postinstall runs prisma generate — schema not copied yet; generate runs in build stage
RUN npm ci --workspace=backend --include-workspace-root --ignore-scripts

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY backend ./backend
COPY package.json ./
WORKDIR /app/backend
RUN npx prisma generate
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
WORKDIR /app/backend
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/backend/package.json ./package.json

RUN addgroup -S alterra && adduser -S alterra -G alterra
USER alterra

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
