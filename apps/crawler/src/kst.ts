/**
 * 크롤링 대상 사이트는 전부 한국 시간(KST, UTC+9, 서머타임 없음) 기준으로 시각을 표기한다.
 * 서버가 어느 시간대(Railway는 미국/싱가포르 등)에서 돌든 항상 KST로 해석/판단하기 위한 유틸.
 */

/** 사이트에 표시된 "YYYY-MM-DD HH:mm(KST)" 값을 실제 UTC 시각(Date)으로 변환한다. */
export function kstToUtcDate(y: number, month1to12: number, d: number, h = 0, mi = 0): Date {
  return new Date(Date.UTC(y, month1to12 - 1, d, h - 9, mi));
}

/** 임의의 Date가 가리키는 시각을 KST 기준 "시(0~23)"로 반환한다. */
export function getKstHour(date: Date): number {
  return (date.getUTCHours() + 9) % 24;
}
