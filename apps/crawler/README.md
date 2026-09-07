# @univ-gogo/crawler

유웨이어플라이 파워경쟁률(`info.uway.com/power`) 목록 페이지를 진입점으로 삼는 크롤러 프로토타입.
목록에 나오는 대학은 실제 경쟁률 데이터를 두 제공처 중 하나에서 가져온다:

- **uwayapply** (`ratio.uwayapply.com`)
- **jinhakapply** (`addon.jinhakapply.com`) — 진학어플라이. 유웨이 목록에 링크만 걸려있을 뿐 실제 페이지는 진학사 계열 시스템

두 제공처 모두 로그인 없이 정적 HTML로 접근 가능해서 둘 다 크롤링 대상에 포함했다.

## 사용법

```bash
npm install
npm run mapping                       # 전체 대학 목록 + 상세 URL 매핑 + 소스(uwayapply/jinhakapply) 출력
npm run detail -- "가톨릭관동대학교"    # uwayapply 대학 예시
npm run detail -- "가야대학교"          # jinhakapply 대학 예시

npm run targets                       # targets.ts에 지정한 대학들의 현재 매핑 상태 확인
npm run crawl                         # targets.ts에 지정한 대학 중 준비된 것만 순회 크롤링
```

`fetchDetail.ts`는 매핑에서 찾은 `detailSource`에 따라 파서를 자동으로 선택한다.

## 크롤링 대상 관리 (`src/targets.ts`)

전체 대학이 아니라 `TARGET_SELECTIONS` 배열에 등록한 **(대학, 전형, 학과) 조합만** 크롤링/저장한다. 대학 상세 페이지는 통째로 한 번만 불러오고, 그 안에서 등록된 조합에 해당하는 행만 골라 DB에 남긴다.

```ts
export const TARGET_SELECTIONS: TargetSelection[] = [
  { university: "가천대학교", department: "AI인문대학", admissionType: "가천바람개비" },
  // ...
];
```

- `university`는 유웨이 목록 페이지에 쓰이는 정식 명칭이어야 매핑과 대조된다 ("숙명여대" 대신 "숙명여자대학교").
- `department`/`admissionType`은 사이트 표기와 완전히 같지 않아도 된다. `matchSelection.ts`가 공백·괄호·"전형" 접미사 차이 등을 정규화하고, 그래도 안 맞으면 글자 2-gram 유사도로 근접 일치를 찾는다. 단, 방향은 "사이트 표기가 적어놓은 이름을 포함하는지"만 확인한다 — 반대 방향은 "화학과"가 "일본언어문화학과"에 우연히 포함되는 식의 오탐을 유발해서 의도적으로 막아뒀다.
- `resolveTargets.ts`가 대학 단위로 최신 유웨이 페이지와 대조해서 분류함
  - ✅ 정확히 일치하는 대학 발견 → 크롤링 진행
  - ⚠️ 부분일치(예: "건국대학교" 검색 시 "건국대학교(글로컬)"만 걸림 — 서울캠퍼스가 아니라 분교) → 사람 확인 필요, 자동 크롤링에서는 건너뜀
  - ⏳ 목록에 아예 없음 → 아직 원서접수 전이라 상세 링크가 생성되지 않은 상태로 추정
- `crawlAndPersistAll()`이 한 대학 안에서도 전형/학과가 매칭 안 되면(`status: "error"`) 결과에 "사이트에서 OOO를 찾지 못함" 메시지를 남긴다. 이 경우 `npm run detail -- "대학명"`으로 실제 사이트 표기를 확인해서 targets.ts 문구를 조정하면 된다.
- 현재(2026.09.08 기준) 숙명여대·한국외대·숭실대·경희대·광운대·성신여대·중앙대·서울여대는 유웨이 목록 페이지 자체에 아직 등장하지 않음 — 접수 시작 후 다시 확인 필요
- "건국대학교"는 유웨이 목록에 글로컬(충주)캠퍼스만 있고 서울캠퍼스는 없음 — 서울캠퍼스 원서접수는 다른 시스템(자체 사이트 등)일 가능성이 있어 별도 확인 필요

## 파일 구성

- `src/http.ts` — 유웨이 계열 사이트(euc-kr 인코딩) 공용 fetch 헬퍼
- `src/fetchMapping.ts` — 목록 페이지 파싱, 대학별 상세 URL 매핑 + 소스 분류(uwayapply/jinhakapply/unknown)
- `src/parseUwayDetail.ts` — `ratio.uwayapply.com` 상세 페이지 파싱 (전형별 → 학과별, rowspan 단과대 컬럼 있음)
- `src/parseJinhakapplyDetail.ts` — `addon.jinhakapply.com` 상세 페이지 파싱 (전형별 → 학과별, 단과대 컬럼 없이 평탄한 구조)
- `src/fetchDetail.ts` — CLI 진입점, source에 따라 파서 분기
- `src/targets.ts` — 크롤링 대상 (대학, 전형, 학과) 조합 목록 (사람이 직접 관리)
- `src/matchSelection.ts` — 파싱 결과에서 targets.ts에 적은 전형/학과와 가장 근접한 항목을 찾는 퍼지 매칭
- `src/resolveTargets.ts` — 대상 대학들을 최신 매핑과 대조
- `src/crawlTargets.ts` — 대상 대학 전체 상세를 순회하며 콘솔에 요약 출력 (진단용, DB 저장 없음)
- `src/persist.ts` — `crawlAndPersistAll()`: 대상 (대학,전형,학과) 조합만 크롤링해서 DB에 저장 (web의 RUN 버튼과 `npm run persist`가 공용으로 사용)
- `src/runOnce.ts` — `crawlAndPersistAll()`을 1회 실행하는 CLI

## 확인된 사항

- 목록 페이지(171개 대학, 2026.09.07 기준) 중 uwayapply 86개 / jinhakapply 70개 / unknown(준비중 등) 15개
- 일부 대학은 목록에서 `ratio.uwayapply.com/power/?ratioURL=...` 프레임셋 래퍼로 연결되는데,
  실제 데이터는 `ratioURL` 쿼리 파라미터가 가리키는 URL 그대로이므로 프레임을 거치지 않고 바로 접근하도록 처리함
- **uwayapply** 상세 페이지: euc-kr 인코딩, 모집단위 표가 `rowspan`으로 단과대학 셀을 병합 → 이전 행의 college 값을 이어받는 로직 필요
- **jinhakapply** 상세 페이지: utf-8 인코딩, 전형별로 `<div id="SelTypeXXX">` 안에 평탄한 4열 표(모집단위/모집인원/지원인원/경쟁률), college 개념 없음. 기준시각은 `#RatioTime`에 `"2026-09-07 오후 11:20 현황"` 형식으로 표기
- "N이내" 형태의 모집인원(추가모집 성격 전형, uwayapply에서만 확인됨)은 숫자만 파싱해 `capacity`에 넣고 원문은 `capacityRaw`에 보존. 이 경우 사이트 자체가 개별 경쟁률을 표시하지 않아 `ratio: null`

## 다음 단계

1. `@univ-gogo/db`(Prisma) 스키마에 맞춰 매핑/상세 결과를 실제로 upsert하는 로직 작성
2. 접수기간(`applyPeriodRaw`)을 기준으로 접수중인 대학만 주기적으로(예: 10분 간격) 상세 크롤링하는 스케줄러
3. 대학명 표기 흔들림(예: "가톨릭관동대학교 U") 정규화 — 검색 UI에서 쓸 학교명과 분리해서 관리
4. 요청 과다로 인한 차단 방지를 위한 요청 간격/동시성 제한 (두 제공처 서버에 부담 주지 않도록)
