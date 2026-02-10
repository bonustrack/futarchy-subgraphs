FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN node scripts/patch-checkpoint.js || true
RUN node scripts/patch-rpc-optimization.js || true
RUN node scripts/patch-batch-size.js || true
RUN node scripts/patch-upsert.js || true
RUN node scripts/patch-block-range.js || true
RUN node scripts/patch-throttle.js || true
RUN node scripts/patch-rate-limiter.js || true
RUN npx checkpoint generate
RUN npx tsc --noEmit false --skipLibCheck true || true
EXPOSE 3000
CMD ["npm", "start"]
