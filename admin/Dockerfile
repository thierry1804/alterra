FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY admin/package.json ./admin/
RUN npm ci --workspace=admin --include-workspace-root
COPY admin ./admin
COPY design ./design
WORKDIR /app/admin
RUN npm run build

FROM nginx:1.26-alpine AS runtime
COPY --from=build /app/admin/dist /usr/share/nginx/html
COPY admin/nginx.static.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
