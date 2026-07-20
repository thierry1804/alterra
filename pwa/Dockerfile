FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY pwa/package.json ./pwa/
RUN npm ci --workspace=pwa --include-workspace-root
COPY pwa ./pwa
WORKDIR /app/pwa
RUN npm run build

FROM nginx:1.26-alpine AS runtime
COPY --from=build /app/pwa/dist /usr/share/nginx/html
COPY pwa/nginx.static.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
