import { promises as fs } from "node:fs";
import path from "node:path";

const pairs = [
  { example: ".env.example", target: ".env" },
  { example: "apps/frontend/.env.example", target: "apps/frontend/.env" },
  { example: "apps/backend/.env.example", target: "apps/backend/.env" },
  { example: "apps/ai/.env.example", target: "apps/ai/.env" },
];

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

for (const { example, target } of pairs) {
  const examplePath = path.resolve(example);
  const targetPath = path.resolve(target);

  if (!(await exists(examplePath))) continue;
  if (await exists(targetPath)) continue;

  await fs.copyFile(examplePath, targetPath);
}
