import { crawlAndPersistAll, type CrawlRunResult } from "../../crawler/src/persist.js";

const INTERVAL_MS = 10 * 60 * 1000; // 10분마다 재수집

// 아직 접수를 시작하지 않은 대학들은 접수 시작 시각(보통 오전 10시) 전까지 크롤링해봐야
// 매번 "링크 없음"만 반복되므로, 그 시간대에는 크롤링 자체를 건너뛴다.
const QUIET_HOUR_BEFORE = 10;

let timer: NodeJS.Timeout | null = null;
let running = false;
let inFlight = false;
let lastRunAt: Date | null = null;
let lastResultSummary: string | null = null;
let lastSkippedQuietHours = false;
let lastResults: CrawlRunResult[] = [];

function isQuietHours(now: Date): boolean {
  return now.getHours() < QUIET_HOUR_BEFORE;
}

async function tick() {
  if (inFlight) return;

  const now = new Date();
  if (isQuietHours(now)) {
    lastSkippedQuietHours = true;
    console.log(`[crawl] ${now.toISOString()} - 오전 ${QUIET_HOUR_BEFORE}시 이전이라 이번 주기는 건너뜀`);
    return;
  }
  lastSkippedQuietHours = false;

  inFlight = true;
  try {
    const results = await crawlAndPersistAll();
    lastRunAt = new Date();
    lastResults = results;
    const ok = results.filter((r) => r.status === "ok").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const errors = results.filter((r) => r.status === "error");
    lastResultSummary = `성공 ${ok} / 대기 ${skipped} / 실패 ${errors.length}`;
    console.log(`[crawl] ${lastRunAt.toISOString()} - ${lastResultSummary}`);
    for (const e of errors) {
      console.error(`[crawl] 실패: ${e.target} - ${e.detail}`);
    }
  } catch (err) {
    console.error("[crawl] 실행 중 오류:", err);
  } finally {
    inFlight = false;
  }
}

export function startCrawlLoop() {
  if (running) return;
  running = true;
  void tick(); // 시작하자마자 1회 즉시 실행 (단, 오전 10시 이전이면 건너뜀)
  timer = setInterval(tick, INTERVAL_MS);
}

export function stopCrawlLoop() {
  running = false;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function getCrawlStatus() {
  return {
    running,
    inFlight,
    intervalMs: INTERVAL_MS,
    quietHourBefore: QUIET_HOUR_BEFORE,
    inQuietHours: isQuietHours(new Date()),
    lastSkippedQuietHours,
    lastRunAt: lastRunAt ? lastRunAt.toISOString() : null,
    lastResultSummary,
    lastErrors: lastResults.filter((r) => r.status === "error"),
  };
}
