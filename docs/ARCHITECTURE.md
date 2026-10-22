# Architecture & CMS Decision

작성일: 2026-10-22

## 결정

기존 Next.js 12 Pages Router를 직접 확장하지 않고, 격리된 Next.js 16 App Router 애플리케이션을 구축했습니다. Phase 4.2부터 콘텐츠와 미디어 metadata는 Neon PostgreSQL에, 이미지·영상 binary는 R2에 저장합니다. Next.js Route Handler는 Netlify에서 요청 시에만 실행되는 OAuth·PostgreSQL·presigning 어댑터이며 별도 상시 실행 서버는 없습니다. 상세 결정은 `PHASE4.2_NEON_CMS.md`를 따릅니다.

## Decap CMS 검토

| 선택지 | 장점 | 제약 | 판단 |
|---|---|---|---|
| Decap + Netlify Git Gateway | 빠른 설정, 기존 CMS UI | Git Gateway는 deprecated이며 신규 설정에 권장되지 않음 | 제외 |
| Decap GitHub backend | Git 기반 CRUD와 editorial workflow | GitHub OAuth 프록시와 클라이언트 CMS의 credential 경계가 이번 요구의 서버 전용 token 원칙과 맞지 않음 | 제외 |
| Decap Turbo | hosted auth/proxy, 별도 서버 불필요 | 외부 control plane과 사전 site provisioning 필요, 현재 계정 권한 없음 | 대안으로 보존 |
| Custom Git adapter | Git 이력과 단순한 원본 | 저장마다 commit·재배포가 필요하고 build source 불일치 위험 | Phase 4.1 이후 제외 |
| Neon PostgreSQL adapter | 재배포 없는 즉시 반영, JSONB로 기존 모델 보존, 낙관적 잠금 | DB 프로젝트와 migration 운영 필요 | Phase 4.2 채택 |

## 왜 마이그레이션이 필요한가

- 기존 `next@12.1.6`은 현행 Next.js 지원 정책에서 unsupported입니다.
- Netlify의 현행 OpenNext adapter 안내는 Next.js 13.5 이상을 유지 범위로 설명합니다.
- 기존 `/edit`와 API는 development-only 파일 편집기이며 인증·Git commit·미디어 관계 검증이 없습니다.
- Phase 4는 라우팅 교체가 목적이 아니라 안전한 운영 콘텐츠 경계를 만드는 작업이므로 신규 격리 앱에서 검증했습니다.

## 보안 경계

- GitHub OAuth authorization code + PKCE + state
- 관리자 GitHub 고유 ID와 login allowlist
- repository collaborator permission이 `write` 이상인지 서버에서 재검증
- GitHub token을 AES-256-GCM 암호화 HttpOnly/SameSite cookie로 저장
- mutation API same-origin 및 `Sec-Fetch-Site` 검사
- 직접 업로드 ticket에 file name, MIME, size, object key, 만료시각을 HMAC으로 결합
- 모든 이미지·영상은 10분짜리 object-scoped presigned PUT 사용
- 완료 API가 object HEAD와 range read로 size, MIME, file signature 재검증
- HTTP(S) 외부 URL만 허용
- 사용자 HTML/MDX를 렌더링하지 않음; Mermaid는 `securityLevel: strict`
- CSP, nosniff, frame-ancestors, permissions policy
- production에서 local preview 인증 우회 불가
- 서버가 암호화 세션의 만료 시각을 직접 검증하며, 기본 OAuth scope는 `read:user`

## 데이터 안정성

- Zod schema로 모든 collection과 14개 block 유형 검증
- 프로젝트·Engineering Case Slug 중복 차단
- media 및 project relation 존재 여부 검증
- 참조 중인 media 삭제 차단
- 파일 단위 parsing 실패는 해당 레코드만 제외해 공개 사이트 전체 장애를 방지
- 공개 query는 `published`만 반환

## 미디어 시스템

Phase 3.6의 프로젝트 단위 설정을 `presentation` schema로 확장했습니다. `source-led`는 DBS에서 선택한 품질 정책이며 공통 기기 상한이 아닙니다. 고해상도 프로젝트는 `regular`·`large` 또는 별도 preset을 선택할 수 있습니다.

목록에서는 poster와 단일 대표 프레임만 사용합니다. 상세 페이지에서는 복수 기기, gallery, browser frame, full bleed, editorial split, 사용자 요청 재생을 block 조합으로 구성합니다.

### 대용량 업로드 트랜잭션

1. 인증된 관리자만 upload ticket과 R2 presigned PUT URL을 요청할 수 있습니다.
2. 브라우저는 Netlify Function을 통과하지 않고 `pending/` key로 R2에 직접 전송합니다.
3. 완료 API가 원격 object를 검증하고 server-side copy로 `media/` key에 확정합니다.
4. PostgreSQL에는 public URL, object key, 크기, 해상도 등 media metadata만 저장합니다.
5. 검증·copy·DB 저장 실패 시 새 object를 삭제합니다. 완료 호출 자체가 유실된 pending object는 lifecycle rule로 정리합니다.
6. 명시적 삭제 시 참조 무결성 검증 → DB metadata 삭제 → object 삭제 순서로 실행하며, object 삭제 실패 시 metadata를 복원합니다.

단일 PUT은 현재 목표인 수십~수백 MB 녹화본에 사용합니다. 100MB를 크게 넘는 영상이나 중단 재개가 필수인 경우에는 같은 storage adapter 뒤에서 multipart upload로 확장합니다.

## 아직 검증하지 못한 것

- 실제 GitHub OAuth App 로그인과 token exchange
- 실제 Neon Preview 연결과 DB CRUD
- DB 저장 직후 공개 페이지 즉시 반영
- 실제 Cloudflare R2 credential을 사용한 MP4/WebM 업로드
- 신규 고해상도 모바일 프로젝트의 최종 배치

이 항목들은 계정·미디어가 준비된 Preview 배포에서 검증해야 합니다.
