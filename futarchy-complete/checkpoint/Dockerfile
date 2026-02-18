FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Apply patches to node_modules (fixes nested where_ filter bug in checkpoint)
COPY patches/ node_modules/

# Copy source
COPY . .

# Generate models from schema
RUN npx checkpoint generate

# Build TypeScript
RUN npm run build || true

EXPOSE 3000

CMD ["npm", "run", "dev"]
