FROM node:20-alpine AS deps
WORKDIR /workspace

# Copy root package files and workspace packages
COPY package.json package-lock.json ./
COPY apps/frontend/package.json ./apps/frontend/package.json

# Install all dependencies for the workspace
RUN npm install --legacy-peer-deps

FROM deps AS builder
WORKDIR /workspace

# Copy the entire frontend app
COPY apps/frontend ./apps/frontend
COPY tsconfig.base.json* ./

# Build the frontend
RUN npm run build --workspace=frontend

FROM node:20-alpine AS runner
WORKDIR /workspace
ENV NODE_ENV=production

# Copy dependencies and built files
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=builder /workspace/apps/frontend ./apps/frontend

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=frontend"]
