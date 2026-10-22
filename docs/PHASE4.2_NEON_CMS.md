# Phase 4.2 — Neon PostgreSQL CMS 전환

작성일: 2026-10-22

## 결론

Preview CMS의 관리형 데이터베이스로 **Neon Free**를 선택한다. Cloudflare R2는 이미지·영상 바이너리 저장소로 유지한다. Supabase는 좋은 대안이지만, 이 프로젝트는 GitHub OAuth와 R2를 이미 사용하므로 Supabase Auth·Storage·Realtime을 함께 도입할 이점보다 중복되는 운영 표면이 더 크다.

공식 자료:

- Neon Free 현행 한도: <https://neon.com/blog/neon-free-plan-1-gb-per-project>
- Neon Serverless Driver: <https://neon.com/blog/serverless-driver-ga>
- Supabase Free 및 과금 구조: <https://supabase.com/docs/guides/platform/billing-on-supabase>
- Supabase 서버리스 연결: <https://supabase.com/docs/guides/database/connecting-to-postgres/serverless-drivers>
- Cloudflare R2 요금: <https://developers.cloudflare.com/r2/pricing/>
- R2 Presigned URL: <https://developers.cloudflare.com/r2/api/s3/presigned-urls/>
- R2 CORS: <https://developers.cloudflare.com/r2/buckets/cors/>

## Neon Free와 Supabase Free 비교

| 항목 | Neon Free | Supabase Free | 이번 프로젝트 판단 |
|---|---|---|---|
| 데이터베이스 | 프로젝트당 1GB | 프로젝트당 500MB | 두 서비스 모두 포트폴리오 CMS에는 충분 |
| 무료 프로젝트 | 최대 100개 | 활성 프로젝트 2개 | Preview/Production을 별도 프로젝트로 분리할 때 Neon이 여유로움 |
| 비활성 동작 | Compute scale-to-zero | 1주 비활성 시 프로젝트 일시정지 | 간헐적으로 접속하는 포트폴리오에는 Neon이 단순함 |
| 서버리스 연결 | HTTP 기반 `@neondatabase/serverless` | Data API 또는 transaction pooler | Netlify Function의 짧은 요청에는 Neon HTTP driver가 작은 변경으로 적합 |
| 부가 서비스 | Postgres 중심으로 선택 가능 | Auth·Storage·Realtime 통합 | 이미 GitHub OAuth와 R2가 있어 Supabase의 통합 기능이 중복됨 |
| Preview 분리 | 프로젝트 또는 DB branch | 별도 프로젝트 권장 | 별도 Neon 프로젝트를 사용해 실수 범위를 줄임 |

무료 한도는 변경될 수 있으므로 Production 전 공식 요금 페이지에서 다시 확인한다. Supabase Free는 공식 가격 페이지 기준 1주 비활성 시 일시정지될 수 있다.

## 데이터 모델

기존 Zod 콘텐츠 모델과 관리자 UI를 유지하기 위해 정규화된 다수 테이블 대신 `cms_documents` JSONB 문서 테이블을 사용한다.

- 기본 키: `environment + collection + id`
- collection: projects, media, experience, engineering, settings
- payload: 기존 JSON 전체를 손실 없이 저장
- slug/status/sort_order: 공개 조회와 무결성 검사용 보조 컬럼
- version: 낙관적 잠금용 정수
- Preview와 Production은 별도 Neon 프로젝트를 사용하며, `environment` 컬럼으로 한 번 더 격리
- 같은 environment/collection 안의 slug는 고유함

관리자 목록 API는 레코드별 version을 반환한다. 저장·삭제 요청은 `If-Match`로 읽은 버전을 보내고, DB 버전이 달라졌으면 `409 Conflict`를 반환한다. 브라우저의 미저장 draft는 유지되므로 다시 불러오기 전 기존 데이터를 덮어쓰지 않는다.

## 동적 조회와 캐시 정책

- 루트 layout은 `dynamic = "force-dynamic"`으로 설정한다.
- 콘텐츠 함수는 `noStore()`를 유지한다.
- 공개 페이지는 요청마다 PostgreSQL에서 조회하며 Git commit이나 Netlify 재배포를 기다리지 않는다.
- Draft는 공개 쿼리에서 제외하고, Draft 상세는 유효한 관리자 세션에서만 반환한다.
- 관리자 API 응답과 `/admin`은 Netlify에서 `Cache-Control: no-store`를 유지한다.

## 미디어 저장

- PNG, JPG, WebP, GIF, MP4, WebM 모두 R2 Presigned PUT으로 브라우저에서 직접 업로드한다.
- Netlify Function은 파일 body를 중계하지 않는다.
- 완료 API가 R2 HEAD, Content-Type, 크기, file signature를 확인한다.
- 바이너리는 R2, metadata는 PostgreSQL에 저장한다.
- object key는 `preview/pending/`, `preview/media/`처럼 환경 prefix를 가진다.
- Preview와 Production은 서로 다른 R2 bucket, public domain, API token을 사용한다.
- 기존 `public/media` 원본은 R2 이관 검증이 끝나도 삭제하지 않는다.

## Preview 외부 설정

### 1. Neon

1. Neon에서 `portfolio-cms-preview` 프로젝트를 만든다.
2. Production용 프로젝트는 지금 만들지 않아도 된다. Production 승인 시 별도 `portfolio-cms-production` 프로젝트를 만든다.
3. Preview 프로젝트의 pooled/serverless connection string을 Netlify Preview의 `DATABASE_URL`에 등록한다.
4. `CMS_ENVIRONMENT=preview`, `CMS_CONTENT_ADAPTER=postgres`를 등록한다.
5. 비밀값을 채팅, Git, 브라우저 번들에 넣지 않는다.

초기 이관:

```bash
nvm use
npm ci
npm run db:migrate:check
CMS_ENVIRONMENT=preview \
CMS_DB_MIGRATION_CONFIRM=preview \
DATABASE_URL='Neon Preview connection string' \
npm run db:migrate
```

`db:migrate`는 대상 namespace가 비어 있지 않으면 중단한다. 재실행이 필요할 때만 데이터를 검토한 뒤 `--allow-existing`을 명시한다. 마이그레이션은 원본 JSON을 수정하거나 삭제하지 않는다.

### 2. GitHub OAuth App

GitHub Settings → Developer settings → OAuth Apps에서 Preview 전용 App을 만든다.

- Homepage URL: 고정 Netlify Preview URL
- Authorization callback URL: `https://<preview-host>/api/auth/github/callback`
- Netlify secret: `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`
- `CMS_PUBLIC_ORIGIN=https://<preview-host>`
- `CMS_ADMIN_GITHUB_LOGIN=bbb4756`
- `CMS_ADMIN_GITHUB_ID=99451642`
- `CMS_GITHUB_REPO=bbb4756/Portfolio`
- `CMS_GITHUB_OAUTH_SCOPE=read:user`

관리자 권한은 OAuth 성공 여부가 아니라 GitHub 고유 사용자 ID, login allowlist, 저장소 write 이상 권한을 모두 통과해야 부여된다.

### 3. Cloudflare R2

1. `portfolio-media-preview` Standard bucket을 만든다.
2. 해당 bucket만 Object Read & Write 가능한 API token을 만든다.
3. Preview public custom domain 또는 개발용 public endpoint를 준비한다.
4. Preview origin에 대해서만 `PUT`과 `Content-Type`을 허용하는 CORS를 설정한다.
5. `preview/pending/` prefix는 1일 뒤 삭제하는 lifecycle rule을 설정한다.
6. 다음 값을 Netlify Preview secrets에 등록한다: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `CMS_MEDIA_PUBLIC_BASE_URL`.

R2 Standard 무료 구간은 월 10GB-month, Class A 100만 회, Class B 1,000만 회이며 직접 R2 egress는 무료다. R2 사용 시작 시 계정의 결제 등록 절차가 표시될 수 있으므로 사용자가 직접 완료해야 한다.

### 4. Netlify Preview

- 기존 `gyurikim.netlify.app` 사이트는 변경하지 않는다.
- 별도 Netlify site를 만들고 `phase4-neon-preview` branch만 연결한다.
- Node는 `.nvmrc`, `package.json`, `netlify.toml` 모두 22.13.x로 맞춘다.
- 환경변수는 Preview site에만 등록한다.
- Production용 Neon/R2/OAuth 비밀값을 Preview site에 재사용하지 않는다.

## 외부 E2E 완료 조건

1. 익명 `/admin`에서 GitHub OAuth 시작
2. 허용 ID 로그인 성공, 비허용 계정 거부
3. Draft 생성 후 DB version 1 확인
4. 수정 후 version 증가와 공개 페이지 즉시 미노출 확인
5. Published 전환 후 재배포 없이 새 요청에서 공개 확인
6. stale `If-Match` 저장이 409이고 기존 데이터 유지
7. 20MB 이상 MP4 직접 업로드·재생·삭제
8. 참조 중 media 삭제 409
9. 로그아웃·세션 만료 후 쓰기 401
10. H2/W1/M2/Graphite+Titanium 디자인 회귀 없음

실제 Preview URL, OAuth App, Neon 및 R2 credential이 없으면 위 외부 항목을 PASS로 기록하지 않는다.
