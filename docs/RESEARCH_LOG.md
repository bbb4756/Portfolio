# CMS 기술 검토 기록

검토일: 2026-10-22

## 결정

격리된 프로토타입은 Next.js 16 App Router, 서버 Route Handler, GitHub OAuth, GitHub Contents API, JSON 콘텐츠 저장을 사용합니다. 별도 데이터베이스와 상시 실행 백엔드는 사용하지 않습니다.

## 근거

- 기존 Next.js 12는 현재 지원 범위를 벗어났습니다. Next.js 공식 지원 정책은 최신 major를 Active LTS, 직전 major를 Maintenance LTS로 관리합니다: https://nextjs.org/support-policy
- Netlify Git Gateway는 deprecated 상태이며 신규 구성이 권장되지 않습니다: https://docs.netlify.com/manage/security/secure-access-to-sites/git-gateway/
- Decap의 GitHub backend는 OAuth 서버가 필요합니다. hosted OAuth/proxy인 DecapBridge/Cloud 계열은 별도 서비스 계정과 운영 의존성이 생깁니다: https://decapcms.org/docs/github-backend/
- Netlify의 현대 Next.js adapter는 App Router와 최신 Next 기능을 지원합니다: https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/
- GitHub Contents API는 파일 create/update/delete와 branch 지정, Git commit 이력을 지원합니다: https://docs.github.com/en/rest/repos/contents?apiVersion=2026-03-10
- GitHub OAuth 보안 원칙에 따라 client secret과 access token은 서버 측에서만 다룹니다: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/best-practices-for-creating-an-oauth-app
- Netlify Functions의 buffered payload는 6MB이며 binary Base64 overhead 때문에 실효 상한은 약 4.5MB입니다. 따라서 영상은 Function body를 통하지 않습니다: https://docs.netlify.com/build/functions/configuration/
- Cloudflare R2는 브라우저가 서버를 경유하지 않고 업로드하도록 S3 presigned PUT을 지원하며, 단일 PUT은 5GiB까지 지원합니다: https://developers.cloudflare.com/r2/objects/upload-objects/
- 브라우저 presigned upload에는 bucket CORS가 필요하고, 허용 origin·method·header를 제한할 수 있습니다: https://developers.cloudflare.com/r2/buckets/cors/
- 공개 미디어는 production에서 R2 custom domain을 사용해야 하며 `r2.dev` URL은 개발 용도입니다: https://developers.cloudflare.com/r2/buckets/public-buckets/

## Decap과 커스텀 Git adapter 비교

| 항목 | Decap + GitHub backend | 선택한 adapter |
| --- | --- | --- |
| OAuth | 별도 OAuth 서버 필요 | Next Route Handler 내부 구현 |
| Git Gateway | deprecated | 사용하지 않음 |
| 토큰 노출 | 구성에 따라 브라우저 CMS가 토큰 사용 | 암호화 HttpOnly cookie, client JS 미노출 |
| 데이터 검증 | collection config 중심 | Zod + 관계 무결성 검사 |
| 디자인 프리셋 | 커스텀 widget 필요 | 애플리케이션 타입과 직접 연결 |
| 운영 의존성 | hosted proxy 선택 시 외부 계정 | GitHub + Netlify만 사용 |

최종 운영 전에는 실제 OAuth App, 대상 저장소 권한, `portfolio-content` branch, Netlify production/branch deploy 설정을 Preview 환경에서 검증해야 합니다.
