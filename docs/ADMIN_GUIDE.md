# Portfolio Studio 관리자 가이드

## 로그인

`/admin`에서 GitHub OAuth로 로그인한다. GitHub OAuth 성공만으로 권한이 생기지 않는다. 서버가 `CMS_ADMIN_GITHUB_ID`, login allowlist, `CMS_GITHUB_REPO`의 write 이상 권한을 모두 검증한다.

세션은 8시간 동안 암호화된 HttpOnly/Secure/SameSite=Lax cookie에 저장된다. 로그아웃 후에는 관리자 API가 401을 반환한다.

## 콘텐츠 편집

- Projects, Engineering Cases: Draft / Published / Archived 상태 지원
- Experience, Site Settings: 기존 필드와 relation 유지
- Save changes: Zod와 relation 검증 후 PostgreSQL에 즉시 저장
- Delete content: 참조 관계 확인 후 PostgreSQL에서 삭제
- 동시에 수정된 레코드는 `409 Conflict`로 중단하고 브라우저의 미저장 draft를 유지
- Published만 공개 목록에 표시
- Draft 프로젝트 상세는 관리자 세션에서만 확인 가능

## 미디어

- PNG, JPEG, WebP, GIF, MP4, WebM 지원
- 모든 binary는 R2 Presigned URL로 브라우저가 직접 업로드
- 기본 최대 크기 250MB
- 완료 API가 크기, Content-Type, file signature를 검증한 뒤 PostgreSQL에 metadata 저장
- 참조 중인 media 삭제는 차단
- R2 object 삭제가 실패하면 metadata를 복원
- 중단된 `pending/` object는 R2 lifecycle rule로 정리

기존 `public/media` 파일은 초기 JSON migration과 R2 이관 검증이 끝나도 자동 삭제하지 않는다.

## 실패 복구

- 저장 충돌: 최신 레코드를 다시 불러온 뒤 브라우저 draft와 수동 병합
- DB 오류: 현재 편집 draft는 탭에 유지되며 저장 완료 메시지를 표시하지 않음
- 직접 업로드 실패: 같은 파일을 다시 시도; 완료 전 pending object는 lifecycle rule로 정리
- object finalize 후 DB metadata 저장 실패: 새 final object를 삭제
- media object 삭제 실패: metadata를 복원하고 502 표시

외부 설정과 Preview E2E 절차는 `PHASE4.2_NEON_CMS.md`, `DEPLOYMENT_VERIFICATION.md`를 따른다.
