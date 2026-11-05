# patient-record-service (Node.js / Express / MongoDB)
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src src
EXPOSE 8082
USER node
CMD ["node", "src/server.js"]
