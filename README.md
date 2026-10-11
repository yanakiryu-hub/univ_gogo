# univ_gogo

27학년도 수시 학생부종합 **면접대비** 정리 사이트.
지원한 6개 학교(전형·학과)의 1차 합격자 발표, 면접평가일, 전형료 납부, 서류/면접 배점,
입학처·학교 위치 링크를 카드로 모아 보여준다.

- 배포: Vercel 정적 사이트 — https://univ-gogo.vercel.app
- 구성: `public/` 안의 HTML/CSS/vanilla JS만 사용 (서버·DB 없음)

## 현재 구조

```
public/
  index.html        # 면접대비 페이지 (카드 스와이프 뷰 ↔ 목록 뷰 토글)
  interview.js      # 카드 렌더링, 스와이프(캐러셀) 동작
  interviewInfo.js  # 학교별 일정·배점·링크 데이터 (여기만 고치면 내용이 바뀐다)
  style.css
vercel.json         # public/ 을 dist/ 로 복사해 배포
```

## 내용 수정하기

1. `public/interviewInfo.js`에서 학교별 값을 고친다.
   - `step1Announce` 1차 합격자 발표, `interviewDate` 면접평가일, `step2Payment` 전형료 납부,
     `examRoomNotice` 시험장 안내, `finalAnnounce` 합격자 발표, `additionalAnnounce` 추가 합격자 발표
   - `docScore` / `interviewScore` 서류·면접 배점, `homepageUrl` / `locationUrl` 링크
   - `step1SortKey`는 카드 정렬용(월일 숫자, 1차 발표가 없는 서류형은 `Infinity`)
2. `git push` 하면 Vercel이 자동으로 다시 배포한다.

로컬에서 보려면 `public/` 폴더를 아무 정적 서버로 열면 된다.

```bash
cd public && python3 -m http.server 4100   # http://localhost:4100
```

## 보관 중인 코드 (경쟁률 기능, 사용 종료)

수시 접수 기간(2026.9.8 ~ 9.11) 동안 실시간 경쟁률을 수집·표시하던 코드로, 지금은 배포하지 않는다.
이력 보존용으로 남겨두었다.

- `apps/crawler/` — 유웨이어플라이/진학어플라이 크롤러
- `apps/web/` — Express 대시보드 서버 (경쟁률 표·보드·추이 그래프)
- `packages/db/` — Prisma + SQLite 스키마
- `docs/sources.md` — 크롤링 대상 사이트 조사 문서

수집했던 경쟁률 데이터(Railway 볼륨)는 Railway 체험 종료로 접근할 수 없다.
