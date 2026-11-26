# Image de production autonome (hébergement hors Vercel : Azure, Scaleway, OVH…).
# Build : docker build -t apex .
# Run   : docker run -p 3000:3000 --env-file .env apex

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S apex && adduser -S apex -G apex
COPY --from=build /app/public ./public
COPY --from=build --chown=apex:apex /app/.next/standalone ./
COPY --from=build --chown=apex:apex /app/.next/static ./.next/static
USER apex
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
