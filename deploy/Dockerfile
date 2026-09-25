FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .

ARG NEXT_PUBLIC_URL=https://cristinapsi.online
ARG NEXT_PUBLIC_MP_PUBLIC_KEY=
ENV NEXT_PUBLIC_URL=$NEXT_PUBLIC_URL
ENV NEXT_PUBLIC_MP_PUBLIC_KEY=$NEXT_PUBLIC_MP_PUBLIC_KEY
# Prisma config requires a URL while generating the client and building pages.
# The real database URL is supplied only when the container runs.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate \
    && DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build

USER node
EXPOSE 3000
