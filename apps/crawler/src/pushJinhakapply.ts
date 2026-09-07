import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getKstHour } from "./kst.js";
import { matchSelection } from "./matchSelection.js";
import { parseJinhakapplyDetail } from "./parseJinhakapplyDetail.js";
import { resolveTargets } from "./resolveTargets.js";
import { TARGET_SELECTIONS } from "./targets.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "..", ".env.local") });

const INGEST_URL = process.env.INGEST_URL; // 예: https://univ-gogoweb-production.up.railway.app
const INGEST_SECRET = process.env.INGEST_SECRET;

/**
 * addon.jinhakapply.com(진학어플라이)은 해외 IP를 막아서 Railway 등 해외 서버에서 직접 크롤링이 안 된다.
 * 그래서 한국 IP인 이 기기(로컬)에서 대신 크롤링해 Railway의 /api/ingest/selection으로 결과를 전송한다.
 * cron으로 주기 실행하는 걸 전제로, 오전 10시 이전에는 서버(runner.ts)와 동일하게 스킵한다.
 */
async function main() {
  if (!INGEST_URL || !INGEST_SECRET) {
    console.error("INGEST_URL / INGEST_SECRET이 설정되지 않았습니다. apps/crawler/.env.local을 확인하세요.");
    process.exit(1);
  }

  const now = new Date();
  if (getKstHour(now) < 10 && process.env.FORCE_RUN !== "1") {
    console.log(`[push] 오전 10시 이전이라 건너뜀 (${now.toISOString()}, 강제 실행하려면 FORCE_RUN=1)`);
    return;
  }

  const resolved = await resolveTargets();

  for (const r of resolved) {
    const selections = TARGET_SELECTIONS.filter((s) => s.university === r.target);
    if (selections.length === 0) continue;

    if (!r.mapping?.detailUrl) {
      console.log(`⏳ ${r.target} - 상세 링크 없음 (접수 시작 전으로 추정)`);
      continue;
    }
    if (r.mapping.detailSource !== "jinhakapply") {
      continue; // uwayapply는 Railway가 직접 크롤링하니 여기서 할 일 없음
    }
    if (r.ambiguous) {
      const candidateNote = r.candidates && r.candidates.length > 1 ? ` (후보: ${r.candidates.join(", ")})` : "";
      console.log(`⚠️  ${r.target} - 이름 부분일치("${r.mapping.name}")${candidateNote} - 확인 필요, 건너뜀`);
      continue;
    }

    const m = r.mapping;
    try {
      const detail = await parseJinhakapplyDetail(m.detailUrl!, m.name);

      for (const s of selections) {
        const match = matchSelection(detail, s);
        if (!match.admissionType || !match.department) {
          console.error(`❌ ${r.target} ${s.department} (${s.admissionType}) - 사이트에서 매칭 실패`);
          continue;
        }

        const res = await fetch(`${INGEST_URL}/api/ingest/selection`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-ingest-secret": INGEST_SECRET },
          body: JSON.stringify({
            universityMapping: m,
            capturedAt: detail.capturedAt ? detail.capturedAt.toISOString() : null,
            admissionType: match.admissionType,
            department: match.department,
          }),
        });

        if (!res.ok) {
          console.error(`❌ ${r.target} ${s.department} - 전송 실패 (${res.status}): ${await res.text()}`);
        } else {
          console.log(`✅ ${r.target} ${s.department} (${s.admissionType}) - 경쟁률 ${match.department.ratio ?? "-"} : 1 전송 완료`);
        }
      }
    } catch (err) {
      console.error(`❌ ${r.target} - 크롤링 실패:`, err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
