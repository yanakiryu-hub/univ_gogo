import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../../../packages/db/src/client.js";
import { persistSelectionResult, persistUniversity } from "../../crawler/src/persist.js";
import { TARGET_UNIVERSITIES } from "../../crawler/src/targets.js";
import type { AdmissionTypeRatio, DepartmentRatio, UniversityMapping } from "../../crawler/src/types.js";
import { forceTickOnce, getCrawlStatus, startCrawlLoop, stopCrawlLoop } from "./runner.js";

/** targets.ts에 적어둔 대학 순서대로 대시보드에 노출한다. 목록에 없는 이름은 뒤로 보낸다. */
function targetOrderIndex(universityName: string): number {
  const normalized = universityName.replace(/\s*U$/, "").trim();
  const idx = TARGET_UNIVERSITIES.indexOf(normalized);
  return idx === -1 ? TARGET_UNIVERSITIES.length : idx;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(express.static(path.join(__dirname, "..", "public")));
app.use(express.json());

// 대시보드에 필요한 전체 상태: 대학 목록 + 전형 + 학과별 현재 경쟁률 + 크롤러 상태
app.get("/api/state", async (_req, res) => {
  const universities = (
    await prisma.university.findMany({
      include: {
        admissionTypes: {
          orderBy: { name: "asc" },
          include: {
            departments: {
              orderBy: [{ college: "asc" }, { name: "asc" }],
            },
          },
        },
      },
    })
  ).sort((a, b) => targetOrderIndex(a.name) - targetOrderIndex(b.name));

  const lastMappedAt = universities.reduce<Date | null>((max, u) => {
    if (!max || u.lastMappedAt > max) return u.lastMappedAt;
    return max;
  }, null);

  const lastCapturedAt = universities.reduce<Date | null>((max, u) => {
    for (const at of u.admissionTypes) {
      if (!max || at.capturedAt > max) max = at.capturedAt;
    }
    return max;
  }, null);

  res.json({
    universities,
    lastMappedAt,
    lastCapturedAt,
    crawlStatus: getCrawlStatus(),
  });
});

// 대학 하나의 학과별 시간대별 경쟁률 변화 (그래프용)
app.get("/api/universities/:id/history", async (req, res) => {
  const university = await prisma.university.findUnique({
    where: { id: req.params.id },
    include: {
      admissionTypes: {
        orderBy: { name: "asc" },
        include: {
          departments: {
            orderBy: [{ college: "asc" }, { name: "asc" }],
            include: {
              snapshots: { orderBy: { capturedAt: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!university) {
    res.status(404).json({ error: "not found" });
    return;
  }

  res.json(university);
});

app.post("/api/crawl/start", (_req, res) => {
  startCrawlLoop();
  res.json(getCrawlStatus());
});

// 오전 10시 이전이어도 강제로 한 번 크롤링 (수동 새로고침/디버깅용, 반복 루프 상태는 안 건드림)
app.post("/api/crawl/run-once", async (_req, res) => {
  await forceTickOnce();
  res.json(getCrawlStatus());
});

app.post("/api/crawl/stop", (_req, res) => {
  stopCrawlLoop();
  res.json(getCrawlStatus());
});

app.get("/api/crawl/status", (_req, res) => {
  res.json(getCrawlStatus());
});

interface IngestBody {
  universityMapping: UniversityMapping;
  capturedAt: string | null;
  admissionType: AdmissionTypeRatio;
  department: DepartmentRatio;
}

/**
 * 진학어플라이(addon.jinhakapply.com)는 해외 IP를 막아서 Railway 서버가 직접 크롤링할 수 없다.
 * 대신 한국 IP에서 로컬로 크롤링한 결과를 이 엔드포인트로 전송받아 저장한다.
 * (apps/crawler/src/pushJinhakapply.ts 참고)
 */
app.post("/api/ingest/selection", async (req, res) => {
  const secret = process.env.INGEST_SECRET;
  if (!secret || req.get("x-ingest-secret") !== secret) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const body = req.body as Partial<IngestBody>;
  if (!body.universityMapping || !body.admissionType || !body.department) {
    res.status(400).json({ error: "invalid body" });
    return;
  }

  try {
    const university = await persistUniversity(body.universityMapping);
    const capturedAt = body.capturedAt ? new Date(body.capturedAt) : new Date();
    await persistSelectionResult(university.id, capturedAt, body.admissionType, body.department);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`univ_gogo web running at http://localhost:${PORT}`);
  // 사람이 RUN을 누르지 않아도 서버가 켜지면 자동으로 크롤링 루프를 시작한다.
  // 실제 크롤링 여부는 runner.ts의 시작/종료 시각(9/8 10:00 ~ 9/11 20:00 KST)에 따라 알아서 결정됨.
  startCrawlLoop();
});
