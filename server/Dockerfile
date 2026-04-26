FROM node:22-alpine AS builder
WORKDIR /app

# prisma.config.ts requires POSTGRESQL_URL when Prisma loads the config; `generate` does not connect.
ENV POSTGRESQL_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

EXPOSE 5000
CMD ["node", "dist/src/server.js"]
