FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --ignore-scripts

# Apply Graph-Node style patches (idempotent writes, reorg skip, block range, error resilience)
COPY scripts/patch-graphnode-style.js scripts/
RUN node scripts/patch-graphnode-style.js

# Apply nested where_ filter patches
COPY patches/ node_modules/

# Copy source
COPY . .

# Generate models from schema
RUN npx checkpoint generate

# Build TypeScript
RUN npm run build || true

EXPOSE 3000

CMD ["npm", "run", "dev"]
