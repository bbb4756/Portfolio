# Phase 4.1 — CMS 운영 보완 보고서

작성일: 2026-10-22

## 해결한 문제

### 실행 소스가 없는 ZIP

이전 패키징은 Documents 동기화 경로에서 산출물 디렉터리 복사가 끝나기 전에 ZIP 작업이 시작됐습니다. ZIP이 `src/` 디렉터리를 먼저 순회한 뒤 실제 파일이 복사되어, 폴더 엔트리만 포함된 불완전한 결과가 만들어졌습니다.

새 패키징은 원본을 `/tmp`의 새 staging directory에 완전히 복사하고 프로세스 종료를 기다린 뒤 다음 조건을 검사합니다.

- `src/` TypeScript/TSX 파일이 모두 존재하고 0 byte가 아님
- source SHA-256 manifest 검증
- ZIP 무결성 검사
- 새 디렉터리에 추출 후 `npm ci`, `npm run lint`, `npm run build`

### 20MB 이상 영상 업로드

영상과 4MB 초과 파일은 Netlify Function body를 통하지 않습니다. 인증된 서버가 Cloudflare R2용 10분짜리 presigned PUT URL을 발급하고 브라우저가 object storage로 직접 업로드합니다. Git에는 URL, object key, 크기, 해상도 등 JSON metadata만 저장합니다.

업로드 완료 시 서버가 object HEAD와 첫 32-byte range read로 크기, content type, file signature를 검증합니다. 검증·확정·Git metadata commit 중 실패하면 새 object를 삭제합니다. 브라우저가 완료 전에 종료한 pending object는 R2 lifecycle rule로 정리합니다.

## 로컬 실검증

- 관리자 UI를 통한 24,230,673-byte MP4 직접 업로드: PASS
- metadata 저장과 object key 기록: PASS
- 임시 공개 프로젝트에서 MP4 로딩·재생: PASS
- 프로젝트, media metadata, object 삭제: PASS
- 잘린 업로드 422 거부와 cleanup: PASS
- 기존 CRUD 29개 회귀: PASS
- 데스크톱·모바일 브라우저 회귀: PASS
- production-mode local preview 우회 차단: PASS
- GitHub Contents API create/update/delete 계약: PASS (local mock)
- lint, TypeScript, optimized build: PASS
- production dependency audit: 취약점 0

## 외부 연동 판정

- 실제 GitHub OAuth: **NOT VERIFIED**
- 실제 GitHub repository commit: **NOT VERIFIED**
- 실제 Cloudflare R2 credential/CORS/custom domain: **NOT VERIFIED**
- 실제 Netlify Preview 자동 재배포: **NOT VERIFIED**
- Production 배포와 `main` 병합: 수행하지 않음

외부 계정이 준비되면 `docs/DEPLOYMENT_VERIFICATION.md`의 절차를 Preview 환경에서 실행해야 합니다. 로컬 mock 결과를 외부 연동 PASS로 간주하지 않습니다.

