# Phase 4 — Portfolio CMS

Phase 3.6의 Full Dark 디자인과 미디어 시스템을 기반으로 만든 격리형 Next.js 16 CMS입니다. 콘텐츠 metadata는 Neon PostgreSQL, 미디어 binary는 Cloudflare R2에 저장합니다. 운영 사이트와 기존 `main` 브랜치는 변경하지 않습니다.

## Local preview

```bash
cp .env.example .env.local
# JSON fixture QA: CMS_LOCAL_PREVIEW=true, CMS_CONTENT_ADAPTER=json
# PostgreSQL QA: CMS_CONTENT_ADAPTER=postgres, DATABASE_URL 설정
npm install
npm run dev:media # separate terminal, local direct-upload QA only
npm run dev
```

- Public portfolio: `/`
- Projects: `/projects`
- Project detail: `/projects/[slug]`
- Engineering cases: `/engineering`
- Admin: `/admin`

`CMS_LOCAL_PREVIEW=true`는 `NODE_ENV !== production`일 때만 동작합니다. Production에서는 GitHub OAuth와 관리자·저장소 권한 검증을 통과해야 합니다.

## Content model

- `content/projects/*.json`
- `content/media/*.json`
- `content/engineering/*.json`
- `content/experience/*.json`
- `content/settings/site.json`
- runtime source of truth: Neon PostgreSQL `cms_documents`
- image/video binaries: Cloudflare R2; PostgreSQL stores media metadata only
- `content/**/*.json`: initial migration source and local fixture, not runtime writes

공개 페이지는 `published` 콘텐츠만 표시합니다. 잘못된 파일은 개별적으로 제외하고 로그를 남겨 전체 공개 사이트가 함께 실패하지 않게 합니다.

## Managed write path

1. `/admin`에서 GitHub OAuth 시작
2. 서버리스 callback이 OAuth code를 교환하고 관리자 GitHub ID·login·repository 권한 확인
3. GitHub token은 AES-256-GCM으로 암호화된 HttpOnly/SameSite cookie에만 저장
4. 관리자 API가 Zod 검증과 relation 검증 후 PostgreSQL JSONB document를 갱신
5. 모든 이미지·영상은 짧은 수명의 presigned URL로 브라우저에서 R2에 직접 업로드
6. 완료 API가 객체 크기·MIME·시그니처를 확인한 후 PostgreSQL에 metadata 저장
7. 공개 페이지는 동적 DB 조회로 다음 요청부터 변경사항을 표시

OAuth secret와 GitHub token은 client JavaScript에 전달하지 않습니다.

## Before production

실제 GitHub OAuth App, Neon Preview 프로젝트, Cloudflare R2 Preview bucket, Netlify 환경변수 및 Preview branch 설정이 필요합니다. 이번 산출물은 해당 계정 권한을 사용하거나 배포하지 않았습니다.

Phase 4.2 결정과 외부 설정은 [PHASE4.2_NEON_CMS.md](./docs/PHASE4.2_NEON_CMS.md), 관리자 사용법은 [ADMIN_GUIDE.md](./docs/ADMIN_GUIDE.md)를 참고하세요.
