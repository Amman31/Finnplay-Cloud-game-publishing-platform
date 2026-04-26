import path from "node:path";
import fs from "node:fs";
import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Prisma loads this file before commands run; `env("POSTGRESQL_URL")` requires the var to exist.
// Match local dev docs: prefer server/.env, then server/.env.example (same defaults as Docker dev Postgres on 5433).
const searchRoots = [process.cwd()];
if (path.basename(process.cwd()) !== "server") {
  searchRoots.push(path.join(process.cwd(), "server"));
}

for (const root of searchRoots) {
  const envPath = path.join(root, ".env");
  if (fs.existsSync(envPath)) {
    loadEnv({ path: envPath });
    break;
  }
}

if (!process.env.POSTGRESQL_URL) {
  for (const root of searchRoots) {
    const examplePath = path.join(root, ".env.example");
    if (fs.existsSync(examplePath)) {
      loadEnv({ path: examplePath });
      break;
    }
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("POSTGRESQL_URL"),
  },
});
