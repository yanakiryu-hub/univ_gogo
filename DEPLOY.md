# 배포 가이드 (Vercel)

이 사이트는 빌드할 것이 없는 **정적 사이트**라 Vercel 무료(Hobby) 플랜으로 충분하다.

## 동작 방식

- `vercel.json`의 빌드 명령이 `public/`의 파일을 `dist/`로 복사하고, `dist/`를 그대로 서빙한다.
- 설치(install) 단계는 건너뛴다. 루트 `package.json`의 workspaces/Prisma 의존성은 사용하지 않는다.
- GitHub `main` 브랜치에 push 하면 자동으로 새로 배포된다.

## 처음 연결할 때

1. https://vercel.com 에서 GitHub 계정으로 로그인
2. Add New → Project → `univ_gogo` 저장소 Import
3. Framework Preset은 `Other`로 두고 설정은 건드리지 않은 채 Deploy
   (필요한 설정은 모두 `vercel.json`에 있다)

## 문제 해결

- **404 NOT_FOUND**: 해당 배포의 Build Logs를 연다. `Skipping cache upload because no files were prepared`가 보이면
  출력 폴더에 파일이 없다는 뜻이다. `vercel.json`의 `buildCommand`가 `public/index.html`을 찾아 `dist/`로
  복사하는지 확인한다.
- Settings → General의 Root Directory를 바꾸면 `public/` 경로가 달라질 수 있으니 비워두거나 저장소 루트로 둔다.
- 배포 URL(`univ-gogo-xxxx-...vercel.app`)은 Vercel 로그인 보호가 걸려 302가 나올 수 있다.
  공개 주소는 `univ-gogo.vercel.app`이다.

## 이전 배포 (참고)

경쟁률 수집 기간에는 Railway에서 Express 서버 + SQLite 볼륨으로 운영했다.
기능을 종료하고 Railway 체험도 끝나 Vercel 정적 사이트로 옮겼다.
