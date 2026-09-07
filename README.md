# univ_gogo

27학년도 수시 대학입시 경쟁률 확인 서비스.
**유웨이어플라이 파워경쟁률**(`info.uway.com/power`) 목록을 진입점으로,
실제 경쟁률은 **uwayapply**와 **진학어플라이(jinhakapply)** 두 제공처에서 가져와
지정한 대학의 전형/학과별 실시간 경쟁률을 웹 대시보드로 보여준다.

## 구조 (npm workspaces 모노레포)

```
apps/
  web/       # 대시보드 웹앱 (Express + vanilla JS) - 경쟁률 표, 추이 그래프, 크롤링 RUN/STOP
  crawler/   # 크롤링 로직 (매핑/상세 파서/DB 저장) - CLI로도, web의 API에서도 재사용
packages/
  shared/    # 공통 타입, 유틸 (예정, 아직 미사용)
  db/        # Prisma 스키마 + SQLite 클라이언트
docs/        # 크롤링 대상 사이트별 조사 문서, 설계 문서
scripts/     # 배포/운영 스크립트 (예정)
```

## 기술 스택

- 언어: TypeScript / Node.js
- 웹: Express + 정적 HTML/vanilla JS, 그래프는 Chart.js (CDN) — 상세는 [apps/web/README.md](apps/web/README.md)
- 크롤링: cheerio + iconv-lite — 상세는 [apps/crawler/README.md](apps/crawler/README.md)
- DB: Prisma + SQLite (`packages/db/prisma/schema.prisma`, `packages/db/prisma/dev.db`)
- 알림: 카카오톡 / 이메일 (미정)
- 배포: 미정

## 실행

```bash
npm install
cd packages/db && npx prisma db push   # 최초 1회: SQLite DB 생성
cd ../.. && npm run dev -w @univ-gogo/web   # http://localhost:4000
```

대시보드에서 RUN을 누르면 `apps/crawler/src/targets.ts`에 등록된 대학들을 2분 간격으로 크롤링해서 DB에 쌓는다.

## 크롤링 대상 관리

전체 대학이 아니라 `apps/crawler/src/targets.ts`에 정식 명칭으로 등록한 대학만 크롤링한다. 원서접수 시작 전이라 목록에 없는 대학, 이름이 다른 캠퍼스와 겹쳐 확인이 필요한 대학은 자동으로 구분해서 건너뛴다 — 자세한 내용은 [apps/crawler/README.md](apps/crawler/README.md) 참고.

## 현재 상태

- 크롤링 대상 사이트 조사 완료 (`docs/sources.md`)
- DB 스키마 작성 및 실제 SQLite DB로 동작 확인 (`packages/db/prisma/schema.prisma`) — University / AdmissionType / Department / RatioSnapshot
- 매핑 크롤러 + uwayapply/jinhakapply 상세 경쟁률 파서 + DB 저장(`crawlAndPersistAll`) 프로토타입 동작 확인 (`apps/crawler`)
- 대시보드 웹앱 동작 확인 (`apps/web`): 경쟁률 표, 대학별 시간대별 추이 그래프, 크롤링 RUN/STOP 컨트롤

## 다음 단계

1. 크롤링 주기/스케줄을 접수기간 기준으로 자동 조정 (현재는 고정 2분 간격)
2. 서버 재시작 시 크롤링 실행 상태(RUN/STOP)가 초기화되는 문제 — 필요하면 영속화
3. 9/8 이후 접수 시작하는 나머지 대상 대학들 재확인 및 등록
4. 학교/전형/학과 검색·필터 UI 추가
