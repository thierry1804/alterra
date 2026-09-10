FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl chromium postgresql16-client

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
# Élague les devDependencies (le client Prisma est déjà généré au-dessus et
# @prisma/client est une dépendance runtime, donc conservé).
WORKDIR /app
RUN npm prune --omit=dev

FROM base AS runtime
ENV NODE_ENV=production
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
WORKDIR /app/backend
# node_modules racine : deps hoistées par les workspaces npm (dotenv, express,
# client Prisma généré…). Sans elles, `node dist/index.js` ne résout pas ses imports.
COPY --from=build /app/node_modules /app/node_modules
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
