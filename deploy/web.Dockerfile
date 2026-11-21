# Build context: repository root.   docker build -f deploy/web.Dockerfile .
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY angular.json tsconfig*.json tailwind.config.js postcss.config.js ./
COPY src/ src/
RUN npx ng build --configuration production

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/fraudguard-ai/browser /usr/share/nginx/html
EXPOSE 80
