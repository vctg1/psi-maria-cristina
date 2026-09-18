import * as dotenv from "dotenv";

// Next.js usa .env.local; o Prisma CLI não carrega .env sozinho.
dotenv.config({ path: ".env.local" });
dotenv.config(); // fallback .env

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
