FROM node:20-alpine AS deps
WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/backend/package.json apps/backend/package.json

RUN npm install --legacy-peer-deps

FROM deps AS builder
COPY . .
RUN cd apps/backend && npx prisma generate
RUN npm run build --workspace backend

FROM node:20-alpine AS runner
WORKDIR /workspace
ENV NODE_ENV=production

# Install FFmpeg for stream processing
RUN for i in 1 2 3; do apk update && apk add --no-cache ffmpeg && break || sleep 5; done

COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=builder /workspace/apps/backend/dist ./apps/backend/dist
COPY --from=builder /workspace/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder /workspace/node_modules/.prisma ./node_modules/.prisma

# Create storage directory
RUN mkdir -p /app/storage/frames

EXPOSE 4000
CMD ["node", "apps/backend/dist/main.js"]
