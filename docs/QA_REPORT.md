# Phase 4 QA 보고서

> 이 문서는 Phase 4.1 Git adapter 당시의 과거 검증 기록이다. Phase 4.2 현재 구조는 `PHASE4.2_NEON_CMS.md`와 `DEPLOYMENT_VERIFICATION.md`를 기준으로 한다.

검증일: 2026-10-22

## 결과 요약

| 영역 | 결과 | 근거 |
| --- | --- | --- |
| 기능 API | PASS | 29개 CRUD·검증·관계 무결성 시나리오 |
| 브라우저 | PASS | 1440×900 / 390×844, 5개 화면씩 총 10개 전체 페이지 캡처 |
| 인터랙션 | PASS | poster→GIF, reduced motion, 미디어 프리셋 class, 로딩 실패 fallback, 미저장 경고 |
| 20MB+ 직접 업로드 | PASS (local adapter) | 관리자에서 24,230,673-byte MP4 업로드, metadata commit, 공개 재생, 삭제 |
| 업로드 실패 복구 | PASS (local adapter) | signed size보다 짧은 body 422 거부, cancel cleanup |
| Git Contents adapter | PASS (local mock) | `portfolio-content` create/update/delete commit 계약과 잔여 파일 없음 |
| 비인증 접근 | PASS | 세션 false, 관리자 API 401, 로그인 화면, Draft 상세 404 |
| ESLint | PASS | 오류·경고 0 |
| TypeScript / production build | PASS | Next.js 16.4.2 optimized build |
| production dependency audit | PASS | 취약점 0 |
| 실제 GitHub OAuth / commit | NOT VERIFIED | OAuth App 자격증명 없음 |
| 실제 Cloudflare R2 | NOT VERIFIED | R2 계정·bucket credential 없음 |
| 실제 Netlify branch deploy | NOT VERIFIED | 사용자 승인 전 배포 금지 |

## 기능 검증 범위

- 프로젝트 생성·ID 변경 거부·수정·삭제
- Draft 관리자 Preview 및 Published 공개 전환
- 중복 Slug, 잘못된 URL, cross-site mutation 거부
- Engineering Case 생성·연결·삭제 보호·연결 해제 후 삭제
- 프로젝트가 다른 콘텐츠에서 참조될 때 삭제 보호
- 이미지 업로드·교체·이전 파일 history 보존
- Alt text 누락, 4MB 초과, 미지원 MIME, 위조 signature 거부
- 대표 미디어·레이아웃·노출 순서·블록 추가/삭제 저장
- 존재하지 않는 미디어 관계 거부
- 저장 검증 실패 후 정상 데이터 재저장
- 참조 중 미디어 삭제 보호
- 존재하지 않는 Slug 404

## 브라우저 검증 범위

- Home, Projects, Project Detail, Engineering, Admin
- 데스크톱 1440×900 및 모바일 390×844
- 수평 overflow 없음
- 깨진 이미지 및 console/page error 없음
- 이름 없는 버튼과 label 없는 폼 컨트롤 없음
- 모바일 주 탐색 4개 링크 유지
- Project ID read-only
- 미디어 순서 위·아래 이동 컨트롤
- Graphite + Titanium, 배경, fit, desktop/mobile preset의 실제 DOM 반영
- `two-up` 모바일 프리셋에서 실제 기기 2개 노출, 데스크톱에서는 대표 기기 1개 노출
- 관리자 검증 오류가 성공 메시지와 다른 적색 상태 스타일로 표시
- 미디어 요청 실패 시 대체 상태 표시
- 키보드 첫 Tab에서 skip link와 focus outline

## 대용량 미디어 검증

- 실제 관리자 UI file input에서 24,230,673-byte MP4 선택
- 브라우저가 별도 origin의 object storage로 직접 PUT
- 완료 API가 원격 object 크기, MIME, MP4 `ftyp` signature 검증
- media metadata에 object URL/key와 정확한 file size 저장
- 임시 Published 프로젝트에서 영상 `readyState=4`, duration 4.833초, 960×600 확인
- 프로젝트 삭제 후 media metadata와 object 삭제, 이후 HEAD 404 확인
- 1,024 byte만 전송한 잘린 업로드가 422로 거부되고 cancel cleanup 성공

로컬 object-storage harness는 presigned upload 계약과 브라우저 동작을 검증합니다. Cloudflare R2 자체의 CORS, credential, public custom domain은 실제 Preview 환경에서 별도 검증해야 합니다.

## Git adapter 검증

로컬 GitHub Contents API mock을 사용해 `content/projects/git-adapter-qa.json`의 create, update, delete 요청과 commit message, SHA 기반 update, `portfolio-content` branch 지정을 검증했습니다. 이는 Git adapter의 HTTP 계약 검증이며 실제 GitHub OAuth, 권한 판정, GitHub 장애 조건을 PASS로 대체하지 않습니다.

## 외부 검증 경계

로컬 QA는 production에서 비활성화되는 `CMS_LOCAL_PREVIEW=true`를 사용했습니다. 별도 production-mode 서버에서는 이 우회가 작동하지 않고, 비인증 API와 Draft가 차단됨을 확인했습니다. 실제 OAuth code exchange, GitHub content branch commit, Netlify 재빌드는 자격증명과 배포 승인이 있어야만 검증할 수 있습니다.

## 알려진 운영 제약

- Netlify Functions의 바이너리 요청 상한 때문에 관리자 업로드를 4MB로 제한했습니다. 더 큰 고화질 영상은 사전 최적화하거나 향후 직접 업로드가 가능한 별도 오브젝트 스토리지 설계를 검토해야 합니다.
- 기존 DBS GIF는 아카이브 미디어로 유지하며 poster를 우선 표시합니다.
- 공개 Engineering Case는 확인된 내용이 없는 초안을 노출하지 않기 때문에 현재 빈 상태입니다.
- 미디어 원본 binary 삭제는 자동화하지 않고 metadata 참조 해제와 Git 이력 보존을 우선합니다.
