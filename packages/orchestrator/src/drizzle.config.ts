import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./models/schema.ts",
  out: "../migrations",
  driver: "d1",
  strict: true,
  dbCredentials: {
    databaseId: process.env.D1_DATABASE_ID ?? "",
    accountId: process.env.CF_ACCOUNT_ID ?? ""
  }
});
