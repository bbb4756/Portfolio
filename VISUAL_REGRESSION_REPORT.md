# Phase 4 — Approved Visual Restoration Report

작성일: 2026-10-22  
검증 대상: Phase 4 CMS 공개 사이트  
비교 기준: Phase 3.5 H2/W1/M2, Phase 3.6 Graphite + Titanium adaptive media system

## 복원 범위

- Hero: H2 Magnetic Letterfield
- Selected Work: W1 Editorial Transformation
- Media: M2 Digital Exhibition Stage
- Device: Graphite + Titanium
- 콘텐츠: Phase 4 CMS settings, projects, media 데이터를 그대로 사용

관리자 UI, OAuth, Git 저장 adapter, 콘텐츠 JSON 구조와 실제 프로젝트 데이터는 변경하지 않았다.

## 원본 대비 변경 사항

### Hero

- Phase 4의 정적 `<h1>`을 CMS 값을 props로 받는 `MagneticHero` 클라이언트 컴포넌트로 교체했다.
- H2 원본의 300px 영향 반경, 92px 이내 반발·중거리 인력, 글자별 위치·weight·간격 변화와 복귀 동작을 이식했다.
- 원본 데스크톱 정적 타이포그래피의 222px 크기, 166.5px 행간, -15.54px 자간을 같은 1440×900 환경에서 확인했다.
- Phase 3.5의 후보명·Replay·비교 내비게이션은 검증용 UI이므로 공개 사이트에 이관하지 않았다.
- Phase 4 SiteHeader와 CMS 소개·스택·역할 데이터는 유지했다.

### Selected Work

- 정적인 비대칭 그리드에 W1의 scroll progress 계산을 복원했다.
- 각 프로젝트 미디어와 카피가 일반 문서 스크롤에 따라 서로 다른 방향으로 이동하며 clip이 열린다.
- 스크롤을 가로채거나 sticky pinning을 사용하지 않는다.
- 모바일과 reduced-motion에서는 변형을 제거하고 자연스러운 세로 흐름으로 대체한다.

### Media

- 프로젝트 목록은 Phase 3.6 원칙에 따라 대표 미디어 한 개만 표시하는 restrained mode를 사용한다.
- 상세 페이지의 multiple-phone, gallery, 영상 재생 구성은 그대로 유지한다.
- DBS의 source-led 198px 데스크톱 크기는 해당 프로젝트에만 적용한다.
- Graphite + Titanium 프레임의 145도 저채도 금속 그라디언트, 5px body, 25px 외곽 radius, 19px screen radius, 좌우 버튼을 복원했다.
- 웹 프로젝트는 스마트폰 프레임 대신 browser exhibit를 유지한다.

## 회귀 검증

| 항목 | 판정 | 근거 |
| --- | --- | --- |
| Hero 정적 디자인 | PASS | Phase 3.5 H2와 복원본 1440×900 비교, 글꼴 크기·행간·자간 일치 |
| Hero 포인터 인터랙션 | PASS | 글자별 transform/weight/gap 변화 및 이탈 후 기준값 복귀 확인 |
| Work 스크롤 인터랙션 | PASS | progress 0.4808에서 media clip·translate와 copy translate 변화 확인 |
| 프로젝트 미디어 레이아웃 | PASS | 깨진 이미지 0, 목록 단일 대표 미디어, 상세 구성 유지 |
| 스마트폰 프레임 | PASS | Graphite + Titanium gradient, 198px DBS source-led width, 7:15 screen 확인 |
| 모바일 레이아웃 | PASS | 390×844 가로 overflow 없음, 터치 반응과 620ms 이후 복귀 확인 |
| CMS 데이터 연동 | PASS | 임시 Preview 저장 후 Hero 이름·역할·소개·스택과 프로젝트명이 즉시 반영되고 원본 복구 |
| 접근성 및 reduced-motion | PASS | 키보드 Enter·방향키·Escape, 설명 연결, 포인터 장식 및 W1 변형 제거 확인 |
| 런타임·성능·콘솔 오류 | PASS | console/page error 0, 60-frame rAF mean 16.67ms·p95 16.70ms |

## 기술 검증

- `npm ci`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS
- Next.js page generation: 15/15
- 데스크톱: 1440×900
- 모바일: 390×844, touch emulation
- reduced-motion: Chromium emulation
- CMS 데이터 저장 검증: 격리된 local Preview adapter에서 수행하고 원본 데이터 복구 PASS

## 독립 시각 평가

- 최종 판정: PASS
- 11개 차원 모두 4점 이상
- 브랜드 고유성·구현 충실도: 5/5
- 나머지 9개 차원: 4/5
- Critical defect: 0
- Blocking change: 0
- 비차단 관찰: 모바일 내비게이션과 보조 메타의 실제 기기 터치 영역은 Production 전 실측 권장

## 확인된 차이

- Phase 3.5의 prototype lab label, candidate navigation, Replay control은 공개 사이트 요소가 아니므로 제외했다.
- Phase 4의 실제 CMS 헤더와 콘텐츠를 사용하므로 원본 prototype과 텍스트 배치는 일부 다르다.
- W1 프로젝트 미디어는 Phase 3.5의 고정 배열 대신 CMS의 featured project 순서와 M2/Phase 3.6 presentation 설정을 사용한다.
- 모바일 W1은 원본과 동일하게 스크롤 변형 없이 정적인 세로 편집형 구성으로 전환한다.

## NOT VERIFIED

- 실제 iOS/Android 기기에서의 터치 체감
- Safari 및 120Hz 디스플레이의 spring 감도
- 수치형 색 대비·200% 확대·스크린리더 전체 감사
- Production 배포 환경 성능

운영 배포, `main` 병합, GitHub OAuth 및 Netlify 설정 변경은 수행하지 않았다.
