# 크롤링 대상 사이트 조사

## 결론

진학사(jinhak.com) 메인 사이트의 "실시간 모의지원 경쟁률"은 로그인이 필요해 크롤링 대상에서 제외.
대신 **원서접수 대행사 두 곳의 "실제 접수 경쟁률" 페이지**가 로그인 없이 공개되어 있고,
데이터 구조도 동일해서 크롤링 대상으로 적합함.

- **유웨이어플라이 파워경쟁률**: https://info.uway.com/power/?isApply=1 (대학 목록 + 상세 URL 매핑의 진입점)
- **진학어플라이(진학사 계열) 경쟁률**: 유웨이 목록 페이지에서 일부 대학이 `addon.jinhakapply.com` 링크로 노출됨

두 서비스 모두 "실제 원서 접수 경쟁률"(모의지원이 아닌 진짜 지원 인원 기준)이고 로그인 없이 접근 가능해서, 유웨이 목록을 진입점으로 두 제공처(uwayapply/jinhakapply) 상세 페이지를 모두 크롤링 대상에 포함한다. (2026.09.07 기준 171개 대학 중 uwayapply 86개 / jinhakapply 70개 / unknown·준비중 15개 — `apps/crawler` 프로토타입으로 둘 다 파싱 확인 완료)

## 1. 대학 목록 페이지

`https://info.uway.com/power/?isApply=1`

- 로그인 불필요, 서버렌더링 HTML
- 4년제/전문대/편입학/고등학교/법전원 탭, 수시/정시/추가모집 탭
- 대학별 행(row)에 `경쟁률 보기` 링크가 있고, 이 링크가 실제 상세 경쟁률 페이지 URL
  - 예: 가야대 → `http://addon.jinhakapply.com/RatioV1/RatioH/Ratio10010711.html`
  - 예: 가천대 → `http://addon.jinhakapply.com/RatioV1/RatioH/Ratio10190711.html`
  - 예: 가톨릭관동대 → `http://ratio.uwayapply.com/Sl5KOjlMSmYlJjomSjdmVGY=` (인코딩된 경로, 대학마다 상이)
- 즉 대학별 상세 페이지가 **진학어플라이(addon.jinhakapply.com)** 또는 **유웨이(ratio.uwayapply.com)** 둘 중 하나로 흩어져 있음
  → 대학별 상세 URL 매핑 테이블을 이 목록 페이지에서 미리 수집해둬야 함 (URL이 예측 불가능한 패턴이라 직접 파싱 필요)
- "준비중" 상태인 대학도 있음 (아직 경쟁률 미공개) → 크롤러가 이 상태를 구분해서 스킵해야 함

## 2. 대학별 상세 경쟁률 페이지 (2종류, 구조는 거의 동일)

### 2-1. 진학어플라이 (`addon.jinhakapply.com/RatioV1/RatioH/Ratio*.html`)

예시: 가야대학교 (`Ratio10010711.html`)

- 상단에 기준 시각 표시 (예: `2026-09-07 오후 11:20 현황`)
- "전형별 경쟁률 현황" 표: 전형명 / 모집인원 / 지원인원 / 경쟁률
- 전형별로 "OOO 경쟁률 현황" 표가 이어짐: 모집단위(학과) / 모집인원 / 지원인원 / 경쟁률
- 순수 HTML 테이블, JS 렌더링 없이 요청 시점에 서버에서 값이 박혀 나옴 → 정적 파싱(Cheerio)으로 충분

### 2-2. 유웨이 (`ratio.uwayapply.com/<encoded-path>`)

예시: 가톨릭관동대학교

- 상단에 기준 시각 표시 (예: `2026년 09월 07일 23시 20분 기준`), "9월 7일부터 10분 단위로 업데이트" 안내 문구
- "전형별 경쟁률 현황" 표: 구분(정원내/정원외) / 전형명 / 총모집인원 / 지원인원 / 경쟁률
- 전형별 상세 표: 단과대학 / 모집단위(학과) / 모집인원 / 지원인원 / 경쟁률
- 마찬가지로 정적 HTML

## 3. 공통 데이터 모델 (초안)

```
University { id, name, source: 'jinhakapply' | 'uwayapply', detailUrl, region, type }
AdmissionType { universityId, name, quotaInside: boolean }  // 전형 (모집인원 등)
Department { admissionTypeId, name, capacity, applicants, ratio }
Snapshot { departmentId, capturedAt, applicants, ratio }  // 시간대별 변동 추적용
```

## 4. 다음 단계

1. `info.uway.com/power` 목록 페이지를 주기적으로 파싱해 대학별 상세 URL 매핑 테이블 생성/갱신
2. 대학별 상세 페이지 파서 2종(`jinhakapply`, `uwayapply`) 구현 — 테이블 헤더가 약간 달라 파서 분리 필요
3. "학교/전형/학과 검색" UI에서 사용할 정규화된 학교/학과명 테이블 설계 (약칭·오탈자 매칭 고려)
4. 접수기간 외에는 페이지가 비활성/준비중 상태이므로, 접수기간(대학마다 상이)을 함께 저장해 크롤링 스케줄링에 활용
5. 진학어플라이 자체 목록 페이지(있다면)도 있는지 확인해 유웨이 목록에 없는 대학 커버 여부 확인
