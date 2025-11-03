import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import "../src/routes/openapi";
import { openApiBuilder } from "../src/models/zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const spec = openApiBuilder.getSpec();
  const outputPath = resolve(__dirname, "../openapi.json");
  await writeFile(outputPath, JSON.stringify(spec, null, 2));
  console.log(`OpenAPI schema written to ${outputPath}`);
}

main().catch((error) => {
  console.error("Failed to generate OpenAPI schema", error);
  process.exitCode = 1;
});
