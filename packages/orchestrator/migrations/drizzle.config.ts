import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "../src/models/schema.ts",
  out: "./",
  driver: "d1",
  strict: true,
  dbCredentials: {
    databaseId: process.env.D1_DATABASE_ID ?? "",
    accountId: process.env.CF_ACCOUNT_ID ?? ""
  }
});
