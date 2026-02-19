# P6: 떡집 통합 플랫폼 (tteok-platform)

## Context
2026-02-19 회의 결과: 전국 떡집 데이터를 확보하여 통합 플랫폼 구축.
핵심 가치: 2-3번 클릭으로 지역별 떡집을 찾을 수 있는 심플한 UI.
실서비스 배포용 → 프로덕션 품질 필수.
첫 Next.js 프로젝트 + 첫 실서비스 배포.

## Tech Stack
- **Framework**: Next.js 15 (App Router) + TypeScript
- **DB**: PostgreSQL + Prisma ORM
- **Styling**: Tailwind CSS (심플한 UI, 빠른 개발)
- **Auth**: NextAuth.js (관리자/업체 로그인)
- **Search**: PostgreSQL full-text search (MVP) → 추후 Elasticsearch
- **Map**: Kakao Map API + react-kakao-maps-sdk (지도 표시, Geocoding, 주소검색 통합)
- **Image**: S3 compatible storage (shop photos, menus)
- **Deploy**: Vercel (프론트) + Railway/Supabase (DB)
- **SEO**: Next.js SSR + 구조화된 데이터 (JSON-LD)

## 데이터 모델 (MVP)
```
Region (시/도)
 └── District (구/군/시)

Shop
 ├── name, description, phone, address
 ├── publicDataId (소상공인 상가업소번호, Upsert 기준키)
 ├── regionId, districtId
 ├── lat, lng (Kakao Geocoding)
 ├── images[] (대표사진)
 ├── businessHours, holidays
 ├── isVerified (관리자 확인 여부)
 └── status (active/pending/inactive)

Category (떡 종류)
 └── name (송편, 인절미, 백설기, 절편, 약식...)

ShopCategory (N:M)
 └── shopId, categoryId

Menu
 ├── shopId, name, price, description
 ├── image
 └── isAvailable
```

## 페이지 구조 (MVP)
```
/ (홈)
 ├── 검색바 (지역 + 키워드)
 ├── 인기 지역 바로가기
 └── 최근 등록 떡집

/shops (떡집 목록)
 ├── 지역 필터 (시/도 → 구/군)
 ├── 카테고리 필터 (떡 종류)
 ├── 정렬 (최신순, 이름순)
 └── 페이지네이션

/shops/[id] (떡집 상세)
 ├── 기본 정보 (이름, 주소, 전화, 영업시간)
 ├── 사진 갤러리
 ├── 메뉴 목록 (가격 포함)
 └── 지도 (Kakao Map)

/admin (관리자)
 ├── 떡집 등록/수정/삭제
 ├── 카테고리 관리
 └── 대시보드 (통계)
```

## 데이터 수집 파이프라인

### 도구: `tools/data-collector/`
독립 CLI 도구. 프로젝트와 별개로 실행 가능 (주기적 갱신용).

### 소스 (2단계)
1. **공공데이터 포털** (기본 목록, DB 저장 O)
   - 소상공인시장진흥공단 상가(상권)정보 API (무료, 합법)
   - 업종코드 "떡류제조" + "떡집" 필터 → 전국 떡집 기본 목록
   - 제공 & 저장: 상호명, 주소, 좌표, 업종, 전화번호
2. **Kakao Local API** (좌표 보정, DB 저장 O)
   - 주소 → 좌표 변환 (Geocoding), 좌표 정확도 보정
   - 일 100,000건 무료

> ⚠️ Naver Place API 제외: TOS상 데이터 복제·DB 구축 금지.
> 영업시간/사진 등 추가 정보는 떡집 사장님 직접 입력(Claim) 또는 관리자 수동 등록.

### 수집 흐름
```
공공데이터 API → raw JSON 저장
 → 정제 (중복 제거, 주소 정규화, 상가업소번호 기준)
 → Kakao API로 좌표 보정
 → Upsert (상가업소번호 기준: 신규→Insert, 기존→빈 필드만 Update)
 → DB import
```

### 멱등성 규칙
- 상가업소번호(공공데이터 고유키) 기준 Upsert
- 관리자가 수정한 필드(isVerified, status, description 등)는 덮어쓰기 금지
- 수집 로그: 신규/갱신/스킵 건수 기록

### 출력
- `tools/data-collector/output/shops.json` (정제된 데이터)
- `tools/data-collector/output/stats.json` (수집 통계: 신규/갱신/스킵)
- Prisma seed 스크립트 자동 생성

## Phase 구조

### Phase 0: 사전점검 + 프로젝트 셋업
- workspace/tteok-platform/ 생성
- Next.js 15 + TypeScript + Tailwind CSS 초기화
- PostgreSQL + Prisma 설정
- tools/data-collector/ 도구 생성
- projects.json 등록, phase-state.json 초기화
- next.config.ts: `images.remotePatterns`에 S3 스토리지 도메인 등록
- .env.example, Docker Compose (PostgreSQL)

### Phase 1: 데이터 모델 + 데이터 수집
- Prisma 스키마 (Region, District, Shop, Category, ShopCategory, Menu)
- PostgreSQL pg_trgm 익스텐션: 마이그레이션 SQL에 `CREATE EXTENSION IF NOT EXISTS pg_trgm;` 수동 추가
- 전국 시/도 + 구/군 시드 데이터
- 떡 카테고리 시드 데이터
- data-collector 실행: 샘플 먼저 (서울 100~200건) → 개발 병렬 진행
- 전국 데이터 수집은 백그라운드로 (API rate limit 고려)

### Phase 2: 코어 API (Route Handlers)
- GET /api/shops (목록 + 필터 + 페이지네이션) → `dynamic = 'force-dynamic'`
- GET /api/shops/[id] (상세) → `revalidate = 3600`
- GET /api/regions (시/도 목록) → 정적 캐싱 OK
- GET /api/regions/[id]/districts (구/군 목록) → 정적 캐싱 OK
- GET /api/categories (카테고리 목록) → 정적 캐싱 OK
- GET /api/search?q=keyword (검색) → `dynamic = 'force-dynamic'`, pg_trgm ILIKE

### Phase 3: 프론트엔드 UI
- 홈페이지 (검색바 + 인기지역 + 최근등록)
- 떡집 목록 페이지 (필터 + 정렬 + 페이지네이션)
- 떡집 상세 페이지 (정보 + 메뉴 + 지도)
- 모바일 반응형 (mobile-first)
- 심플한 디자인 (회의: 기능 우선, 양산형 OK)

### Phase 4: 관리자 패널
- NextAuth.js 인증 (admin role)
- 떡집 CRUD (등록/수정/삭제)
- 이미지 업로드 (S3 Presigned URL → 클라이언트 직접 업로드, Vercel 4.5MB 제한 우회)
- 카테고리 관리

### Phase 5: SEO + 배포
- 메타태그, Open Graph, JSON-LD 구조화 데이터
- sitemap.xml 자동 생성
- Kakao 디벨로퍼스: localhost:3000, *.vercel.app, 커스텀 도메인 등록
- Vercel 배포 + DB 연결
- 도메인 연결

## 에이전트 배치 (Wave 기반)
| Wave | 에이전트 | 모델 | 태스크 |
|------|---------|------|-------|
| W1 | Sonnet-Setup, Sonnet-Collector | sonnet ×2 | 프로젝트 초기화+Prisma ∥ data-collector 도구 |
| W2 | Sonnet-API, Sonnet-UI-Home | sonnet ×2 | API 라우트 ∥ 홈+레이아웃 |
| W3 | Sonnet-ShopList, Sonnet-ShopDetail | sonnet ×2 | 목록 페이지 ∥ 상세 페이지 |
| W4 | Sonnet-Admin, Sonnet-Auth | sonnet ×2 | 관리자 CRUD ∥ NextAuth |
| W5 | Sonnet-SEO, Haiku-Docs | sonnet + haiku | SEO + 배포 ∥ 문서 |

## 핵심 설계 원칙 (회의 기반)
1. **심플한 UI**: 2-3 클릭으로 원하는 지역 떡집 도달
2. **기능 우선**: 화려함 X, 빠짐없는 기능
3. **양산형 디자인**: 많이 쓰는 패턴 벤치마킹 (네이버 플레이스 참고)
4. **등록 용이성**: 컴퓨터 못하는 떡집 사장님도 쉽게
5. **모바일 퍼스트**: 떡집 검색은 주로 모바일

## Verification
1. `pnpm dev` → 로컬에서 홈/목록/상세 페이지 정상 렌더링
2. 지역 필터: 서울 → 강남구 선택 → 해당 떡집만 표시
3. 검색: "송편" 입력 → 관련 떡집 목록 반환
4. 관리자: 로그인 → 떡집 등록 → 목록에 표시
5. 모바일: 크롬 DevTools 모바일 뷰 확인
6. SEO: `curl` 응답에 메타태그 + JSON-LD 포함
7. Lighthouse 성능 80+ / SEO 90+
