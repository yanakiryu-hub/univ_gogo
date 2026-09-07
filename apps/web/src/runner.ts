import { kstToUtcDate } from "../../crawler/src/kst.js";
import { crawlAndPersistAll, type CrawlRunResult } from "../../crawler/src/persist.js";

const INTERVAL_MS = 10 * 60 * 1000; // 10분마다 재수집

// 9/8 오전 10시 전까지는 uwayapply 대학들도 접수 시작 전이라 크롤링해봐야 "링크 없음"만 반복된다.
// 9/11 20시(원서접수 마감 근처)가 지나면 더 이상 크롤링할 필요가 없어 자동으로 멈춘다.
// 둘 다 "매일 반복"이 아니라 이번 수시 접수 기간에 한정된 특정 시각이다.
const CRAWL_START_AT = kstToUtcDate(2026, 9, 8, 10, 0);
const CRAWL_END_AT = kstToUtcDate(2026, 9, 11, 20, 0);

let timer: NodeJS.Timeout | null = null;
let running = false;
let inFlight = false;
let lastRunAt: Date | null = null;
let lastResultSummary: string | null = null;
let lastSkippedReason: "before-start" | "after-end" | null = null;
let lastResults: CrawlRunResult[] = [];

function isBeforeStart(now: Date): boolean {
  return now < CRAWL_START_AT;
}

function isAfterEnd(now: Date): boolean {
  return now >= CRAWL_END_AT;
}

async function tick(opts: { force?: boolean } = {}) {
  if (inFlight) return;

  const now = new Date();

  if (isAfterEnd(now) && !opts.force) {
    lastSkippedReason = "after-end";
    if (running) {
      console.log(`[crawl] ${now.toISOString()} - 종료 시각(9/11 20:00 KST) 경과, 자동으로 정지`);
      stopCrawlLoop();
    }
    return;
  }

  if (isBeforeStart(now) && !opts.force) {
    lastSkippedReason = "before-start";
    console.log(`[crawl] ${now.toISOString()} - 시작 시각(9/8 10:00 KST) 전이라 이번 주기는 건너뜀`);
    return;
  }

  lastSkippedReason = null;
  inFlight = true;
  try {
    const results = await crawlAndPersistAll({ skipJinhakapply: true });
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
  void tick(); // 시작하자마자 1회 즉시 실행 (시작 전/종료 후 시간대면 내부에서 알아서 건너뜀)
  timer = setInterval(() => void tick(), INTERVAL_MS);
}

/** 시작/종료 시각과 무관하게 강제로 한 번 크롤링한다 (수동 새로고침/디버깅용). 반복 루프 상태는 건드리지 않는다. */
export async function forceTickOnce() {
  await tick({ force: true });
}

export function stopCrawlLoop() {
  running = false;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function getCrawlStatus() {
  const now = new Date();
  return {
    running,
    inFlight,
    intervalMs: INTERVAL_MS,
    crawlStartAt: CRAWL_START_AT.toISOString(),
    crawlEndAt: CRAWL_END_AT.toISOString(),
    isBeforeStart: isBeforeStart(now),
    isAfterEnd: isAfterEnd(now),
    lastSkippedReason,
    lastRunAt: lastRunAt ? lastRunAt.toISOString() : null,
    lastResultSummary,
    lastErrors: lastResults.filter((r) => r.status === "error"),
  };
}
