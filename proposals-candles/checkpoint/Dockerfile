FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx checkpoint generate
RUN npx tsc --noEmit false --skipLibCheck true || true
EXPOSE 3000
CMD ["npm", "start"]
