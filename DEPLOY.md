# Railway 배포 가이드

이 앱은 SQLite 파일 + 서버 프로세스 내부 타이머(크롤링 RUN/STOP)로 동작하는 **장시간 실행 프로세스**라, Vercel 같은 서버리스 플랫폼과는 맞지 않는다. Railway처럼 Node 서버를 계속 띄워두고 영구 디스크(Volume)를 붙일 수 있는 플랫폼을 쓴다.

## 준비된 것 (코드 쪽)

- 루트 `package.json`에 `build`(Prisma client 생성) / `start`(DB 스키마 반영 후 웹서버 실행) 스크립트 추가
- `packages/db`의 Prisma client가 `DATABASE_URL` 환경변수를 우선 사용하도록 되어 있음 (없으면 로컬 개발용 상대경로로 fallback)
- `apps/web`이 `process.env.PORT`를 그대로 사용 — Railway가 주입하는 포트에 자동으로 맞춰짐

## 로그인/계정이 필요한 부분 (직접 진행해주셔야 함)

Railway 계정 로그인·GitHub 연동·Volume 생성은 본인 계정으로만 할 수 있는 작업이라 아래 단계는 직접 진행해주세요.

### 1. GitHub에 코드 올리기

로컬에서 git 저장소는 이미 초기화해뒀다. GitHub에 새 저장소를 만들고 푸시:

```bash
gh repo create univ-gogo --private --source=. --remote=origin --push
```

(`gh` CLI 로그인이 안 되어 있다면 `gh auth login` 먼저)

### 2. Railway 프로젝트 생성 및 GitHub 연동

1. https://railway.app 에서 로그인 (GitHub 계정으로 로그인 추천)
2. "New Project" → "Deploy from GitHub repo" → 방금 만든 `univ-gogo` 저장소 선택
3. Railway가 자동으로 Node 프로젝트로 인식하고, 루트의 `build`/`start` 스크립트를 사용해서 빌드·실행함

### 3. 영구 디스크(Volume) 추가 — 이거 안 하면 재배포할 때마다 크롤링 데이터가 사라짐

1. Railway 서비스 → "Settings" → "Volumes" → "New Volume"
2. Mount path를 `/data`로 설정
3. 서비스 → "Variables"에 아래 환경변수 추가:
   ```
   DATABASE_URL=file:/data/dev.db
   ```

### 4. 배포 확인

Railway가 배포를 마치면 "Settings" → "Networking"에서 공개 도메인을 발급받을 수 있다 (`xxx.up.railway.app` 형태, 무료). 그 URL로 접속해서 대시보드가 뜨는지 확인.

첫 배포 직후에는 DB가 비어있는 게 정상 — 사이트에서 **RUN** 버튼을 눌러야 크롤링이 시작된다.

## 참고

- Railway 무료 플랜은 일정 시간 트래픽이 없으면 서비스가 슬립될 수 있다. 슬립되면 RUN으로 켜둔 크롤링 루프도 같이 멈춘다 — 계속 돌려두려면 유료 플랜이나 다른 상시구동 플랫폼이 필요하다.
- `apps/crawler/src/targets.ts`에 등록된 대학/전형/학과 목록은 배포 후에도 코드 수정 → 재배포로만 바꿀 수 있다 (UI에서 편집하는 기능은 아직 없음).
- 이 저장소는 npm workspaces 모노레포라 Railway가 루트에서 `npm install`을 실행해야 한다 (서비스 Root Directory를 `apps/web` 등으로 바꾸지 말 것).
