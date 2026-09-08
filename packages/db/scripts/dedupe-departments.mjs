// Department의 unique 키를 (admissionTypeId, college, name)에서 (admissionTypeId, name)으로
// 좁히기 전에, 기존에 college 값 차이로 중복 생성된 학과 행을 정리한다.
// - 같은 (admissionTypeId, name) 그룹 중 college가 채워진 쪽을 남기고
// - 지워질 행에 붙어있던 RatioSnapshot은 남기는 행으로 옮긴 뒤 삭제한다.
// prisma db push(유니크 제약 추가) 실행 전에 반드시 먼저 돌아야 한다.
import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${path.join(__dirname, "..", "prisma", "dev.db")}`;
}

const prisma = new PrismaClient();

async function main() {
  const groups = await prisma.department.groupBy({
    by: ["admissionTypeId", "name"],
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });

  if (groups.length === 0) {
    console.log("[dedupe] 중복된 학과 없음");
    return;
  }

  console.log(`[dedupe] 중복 그룹 ${groups.length}개 발견`);

  for (const g of groups) {
    const rows = await prisma.department.findMany({
      where: { admissionTypeId: g.admissionTypeId, name: g.name },
      orderBy: { id: "asc" },
    });

    const keeper = rows.find((r) => r.college && r.college !== "") ?? rows[0];
    const losers = rows.filter((r) => r.id !== keeper.id);

    for (const loser of losers) {
      await prisma.ratioSnapshot.updateMany({
        where: { departmentId: loser.id },
        data: { departmentId: keeper.id },
      });
      await prisma.department.delete({ where: { id: loser.id } });
    }

    console.log(
      `[dedupe] ${g.admissionTypeId} / ${g.name}: ${rows.length}건 -> 1건 (유지: ${keeper.id}, college="${keeper.college}")`
    );
  }
}

main()
  .catch((err) => {
    console.error("[dedupe] 실패:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
