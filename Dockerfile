FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ARG APP_VERSION=dev
ENV NEXT_PUBLIC_APP_VERSION=${APP_VERSION}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache python3 py3-pip && python3 -m venv /opt/print-venv
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION}
LABEL org.opencontainers.image.version=${APP_VERSION}
COPY --from=builder /app .
RUN /opt/print-venv/bin/pip install --no-cache-dir -r requirements-print.txt
ENV PATH="/opt/print-venv/bin:${PATH}"
EXPOSE 3000
CMD ["npm", "run", "start"]
