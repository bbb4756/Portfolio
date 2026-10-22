# Phase 4.2 Preview 실환경 검증 절차

Production 배포와 `main` 병합 전, 별도 Netlify site·Neon Preview project·R2 Preview bucket에서만 수행한다. 외부 자격증명 없이 완료할 수 없는 항목은 PASS로 기록하지 않는다.

## 사전 설정

- GitHub branch: `phase4-neon-preview`
- Netlify: 기존 `gyurikim` site와 분리된 고정 Preview site
- Neon: `portfolio-cms-preview`; `CMS_ENVIRONMENT=preview`
- R2: `portfolio-media-preview`; object prefix `preview/`
- GitHub OAuth callback: `https://<preview-host>/api/auth/github/callback`
- Node: 22.13.x

환경변수와 계정별 절차는 `PHASE4.2_NEON_CMS.md`를 따른다.

## 인증

1. 익명 `/admin`은 GitHub 로그인 CTA만 표시한다.
2. 익명 `/api/admin/content/projects`는 401이다.
3. 허용되지 않은 GitHub ID 또는 login은 관리자로 승인되지 않는다.
4. 허용 계정도 저장소 write 이상 권한이 없으면 거부된다.
5. session cookie는 HttpOnly, Secure, SameSite=Lax이다.
6. logout 또는 8시간 만료 후 관리자 API는 다시 401이다.
7. Production build에서 `CMS_LOCAL_PREVIEW=true`는 인증을 우회하지 못한다.

## PostgreSQL CRUD와 즉시 반영

1. JSON migration 25건과 collection별 count를 확인한다.
2. Draft 프로젝트를 생성하고 DB version 1을 확인한다.
3. 수정 후 version 증가를 확인한다.
4. 같은 구버전 `If-Match` 요청이 409이고 최신 값이 보존되는지 확인한다.
5. Draft 상세는 관리자만 볼 수 있고 익명 요청은 404인지 확인한다.
6. Published 전환 후 Netlify 재배포 없이 새 공개 요청에서 최신 값이 보이는지 확인한다.
7. Archived 또는 삭제 후 공개 목록에서 즉시 제거되는지 확인한다.
8. 테스트 레코드를 삭제한다.

## R2

1. PNG/JPG와 20MB 이상 MP4를 업로드한다.
2. file body가 Netlify가 아니라 R2 S3 endpoint로 PUT되는지 확인한다.
3. 완료 API 후 R2 object와 PostgreSQL media metadata가 모두 존재하는지 확인한다.
4. 잘못된 MIME, size mismatch, 위조 signature, 만료 upload token을 거부한다.
5. 공개 이미지·영상·poster 재생을 확인한다.
6. 참조 중 media 삭제는 409다.
7. 참조 해제 후 metadata와 R2 object가 함께 삭제된다.
8. 중단된 `preview/pending/` object가 lifecycle rule로 정리되는지 확인한다.

## 디자인 회귀

- H2 Magnetic Letterfield: 포인터·키보드·터치·복귀
- W1 Editorial Transformation: 수동 스크롤 진행률
- M2 Exhibition Stage와 Graphite + Titanium frame
- 모바일 390×844, 데스크톱 1440×900
- reduced-motion에서 불필요한 변형 없음
- console/page error 없음

## 최종 판정

실제 URL과 외부 서비스 증적이 있는 항목만 PASS다. Local JSON fixture, PGlite, R2 local adapter는 구현 검증이며 Neon/R2/OAuth 실환경 PASS를 대체하지 않는다.
