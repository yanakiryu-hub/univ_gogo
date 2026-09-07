import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// sqlite 파일 경로를 항상 packages/db/prisma/dev.db로 고정한다.
// 어느 앱(crawler/web)에서 이 client를 import하든 CWD와 무관하게 같은 DB를 보게 하기 위함.
if (!process.env.DATABASE_URL) {
  const dbPath = path.join(__dirname, "..", "prisma", "dev.db");
  process.env.DATABASE_URL = `file:${dbPath}`;
}

export const prisma = new PrismaClient();
export { PrismaClient };
