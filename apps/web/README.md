# @univ-gogo/web

크롤링된 경쟁률을 보여주는 대시보드. Express + 정적 HTML/vanilla JS (Chart.js는 CDN)로, 별도 프론트엔드 빌드 없이 바로 실행된다.

## 실행

```bash
npm install                      # 루트에서 한 번
npm run dev -w @univ-gogo/web    # http://localhost:4000
```

`packages/db`가 먼저 `npx prisma db push`로 SQLite DB(`packages/db/prisma/dev.db`)를 만들어둔 상태여야 한다.

## 화면 구성

- `/` (대시보드)
  - 크롤링 중인 대학 목록(`apps/crawler/src/targets.ts`에 등록되고 상세 링크가 확인된 대학만)을 카드로 나열
  - 각 카드 펼치면 전형/학과별 모집인원·지원인원·경쟁률 표
  - 대학명 클릭 시 `/university.html?id=...`로 이동
  - 상단에 마지막 업데이트 시각, 크롤러 실행 상태(RUN/STOP 배지) 표시
  - RUN 버튼: 10분 간격 크롤링 루프 시작 (누르는 즉시 1회 크롤링도 실행됨, 단 오전 10시 이전이면 건너뜀)
  - STOP 버튼: 루프 정지 (이미 실행 중이던 크롤링은 끝까지 완료)
  - 오전 10시 이전에는 "실행중 (오전 10시 이전이라 대기중)"으로 표시되고 실제 크롤링은 수행하지 않음 — 접수 시작이 보통 오전 10시라 그 전엔 매번 "링크 없음"만 반복되는 걸 막기 위함
- `/university.html?id=...` (경쟁률 추이)
  - 전형/학과 선택 드롭다운
  - Chart.js 라인 차트로 경쟁률·지원인원 시간대별 변화 표시 (데이터는 크롤링 실행마다 쌓이는 `RatioSnapshot`)

## API

- `GET /api/state` — 대학 목록 + 전형 + 학과(현재값) + 크롤러 상태
- `GET /api/universities/:id/history` — 대학 하나의 전형/학과별 스냅샷 이력
- `POST /api/crawl/start` / `POST /api/crawl/stop` / `GET /api/crawl/status`

## 알아둘 것

- 크롤링 루프는 이 서버 프로세스 안에서 `setInterval`로 도는 인메모리 상태라, 서버를 재시작하면 RUN 상태는 초기화된다 (DB는 유지됨)
- `apps/crawler/src/persist.ts`의 `crawlAndPersistAll()`을 그대로 재사용 — 크롤링 로직은 crawler 패키지에만 있고 web은 실행 스케줄링과 조회만 담당
- 대시보드는 15초마다 `/api/state`를 폴링해서 갱신 (별도 웹소켓 없음, 프로토타입 수준)
