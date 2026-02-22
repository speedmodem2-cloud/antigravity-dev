# P6: 떡집 통합 플랫폼 (tteok-platform)

## Context
2026-02-20 회의 결과: 전국 떡집 데이터를 확보하여 통합 플랫폼 구축.
핵심 가치: 2-3번 클릭으로 지역별 떡집을 찾을 수 있는 심플한 UI.
실서비스 배포용 → 프로덕션 품질 필수.
첫 Next.js 프로젝트 + 첫 실서비스 배포.
**홍보 전략**: 블로그 시스템(/blog) + AI 콘텐츠 생성 파이프라인 통합.
SEO 콘텐츠 자동생성 → 본 사이트 발행 + 네이버/인스타 수동 업로드.

## Tech Stack
- **Framework**: Next.js 15 (App Router) + TypeScript
- **DB**: Supabase (PostgreSQL) + Prisma ORM
  - Connection pooling: `DATABASE_URL` → pgbouncer (port 6543, `?pgbouncer=true`)
  - Direct: `DIRECT_URL` → direct connection (port 5432, 마이그레이션용)
- **Styling**: Tailwind CSS (심플한 UI, 빠른 개발)
- **Auth**: Auth.js v5 (`next-auth@5`) — Next.js 15 App Router 네이티브 지원
- **Search**: PostgreSQL pg_trgm (ILIKE + GIN 인덱스) — MVP 단계
- **Map**: Kakao Map API + react-kakao-maps-sdk (지도 표시, Geocoding, 주소검색 통합)
- **Image**: S3 compatible storage (shop photos, menus, blog thumbnails)
- **Deploy**: Vercel (프론트) + Supabase (DB + Storage)
- **SEO**: Next.js SSR + 구조화된 데이터 (JSON-LD)
- **AI 콘텐츠**: Claude API (Sonnet) — 블로그/SNS 글 생성
- **AI 이미지**: GPT image API — 썸네일, 대체 이미지 (사진 없는 떡집)

## 환경변수 목록
```
# Supabase
DATABASE_URL=postgresql://...@db.xxx.supabase.co:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://...@db.xxx.supabase.co:5432/postgres

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<random-secret>

# Kakao
KAKAO_REST_API_KEY=<kakao-rest-key>
KAKAO_JS_APP_KEY=<kakao-js-key>

# S3 / Supabase Storage
S3_ENDPOINT=<supabase-storage-url>
S3_ACCESS_KEY=<key>
S3_SECRET_KEY=<secret>
S3_BUCKET=tteok-images

# AI
CLAUDE_API_KEY=<anthropic-key>
OPENAI_API_KEY=<openai-key-for-image>

# 공공데이터
PUBLIC_DATA_API_KEY=<data.go.kr-key>
```

## 데이터 모델 (MVP)
```
Region (시/도)
 └── District (구/군/시)

Shop
 ├── name, slug (unique, SEO-friendly URL)
 ├── description, phone, address
 ├── publicDataId (소상공인 상가업소번호, Upsert 기준키)
 ├── regionId, districtId
 ├── lat, lng (Kakao Geocoding)
 ├── images[] (대표사진)
 ├── businessHours, holidays
 ├── isVerified (관리자 확인 여부)
 ├── viewCount (조회수, 인기 정렬용)
 └── status (active/pending/inactive)

Category (떡 종류)
 └── name (송편, 인절미, 백설기, 절편, 약식...)

ShopCategory (N:M)
 └── shopId, categoryId

Menu
 ├── shopId, name, price, description
 ├── image
 └── isAvailable

BlogPost
 ├── title, slug (unique)
 ├── content (HTML), excerpt
 ├── thumbnail (S3 URL)
 ├── category (지역가이드/떡종류/계절트렌드/문화)
 ├── status (draft/published/archived)
 ├── seoTitle, seoDescription
 ├── authorId (관리자 FK)
 ├── aiGenerated (boolean — AI 생성 여부 표시)
 └── createdAt, updatedAt

BlogPostShop (N:M — 글에서 언급하는 떡집)
 └── blogPostId, shopId

Admin (관리자)
 ├── email, name, hashedPassword
 └── role (superadmin/admin)
```

> **Review/Rating**: MVP 제외. Phase 7+ 에서 추가 예정 (Shop 스키마 변경 최소화를 위해 별도 테이블로 설계).

## 페이지 구조 (MVP)
```
/ (홈)
 ├── 검색바 (지역 + 키워드)
 ├── 인기 지역 바로가기
 └── 최근 등록 떡집

/shops (떡집 목록)
 ├── 지역 필터 (시/도 → 구/군)
 ├── 카테고리 필터 (떡 종류)
 ├── 정렬 (최신순, 이름순, 인기순)
 └── 페이지네이션

/shops/[slug] (떡집 상세 — SEO friendly URL)
 ├── 기본 정보 (이름, 주소, 전화, 영업시간)
 ├── 사진 갤러리
 ├── 메뉴 목록 (가격 포함)
 └── 지도 (Kakao Map)

/blog (블로그 목록)
 ├── 카테고리 필터 (지역가이드/떡종류/계절트렌드)
 └── 카드 그리드 (thumbnail + excerpt)

/blog/[slug] (블로그 상세)
 ├── 본문 (HTML)
 ├── 관련 떡집 목록
 └── 관련 글 추천

/admin (관리자)
 ├── 떡집 등록/수정/삭제
 ├── 카테고리 관리
 ├── 블로그 글 작성/수정/발행
 ├── AI 콘텐츠 생성 패널
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
   - **예상 규모**: 전국 3,000~8,000건 (떡류제조+떡집 기준)
2. **Kakao Local API** (좌표 보정, DB 저장 O)
   - 주소 → 좌표 변환 (Geocoding), 좌표 정확도 보정
   - 일 100,000건 무료 → 전국 1회 수집 충분 (8,000건 기준 한도 내)
   - ⚠️ 안전 마진: 시/도 단위 분할 실행 + 딜레이 500ms/건

> ⚠️ Naver Place API 제외: TOS상 데이터 복제·DB 구축 금지.
> 영업시간/사진 등 추가 정보는 떡집 사장님 직접 입력(Claim) 또는 관리자 수동 등록.

### 수집 흐름
```
공공데이터 API → raw JSON 저장
 → 정제 (중복 제거, 주소 정규화, 상가업소번호 기준)
 → slug 자동 생성 (상호명 → slugify, 중복 시 -2, -3 suffix)
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
- Supabase 프로젝트 생성 + Prisma 설정 (`DATABASE_URL` pgbouncer + `DIRECT_URL` direct)
- tools/data-collector/ 도구 생성
- projects.json 등록, phase-state.json 초기화
- next.config.ts: `images.remotePatterns`에 Supabase Storage 도메인 등록
- .env.example (전체 환경변수 목록), Docker Compose (로컬 개발용 PostgreSQL)

### Phase 1: 데이터 모델 + 시드 + 데이터 수집
- Prisma 스키마 (Region, District, Shop, Category, ShopCategory, Menu, BlogPost, BlogPostShop, Admin)
- `prisma/schema.prisma`에 Supabase 설정:
  ```prisma
  datasource db {
    provider  = "postgresql"
    url       = env("DATABASE_URL")
    directUrl = env("DIRECT_URL")
  }
  ```
- PostgreSQL pg_trgm 익스텐션: 마이그레이션 SQL에 `CREATE EXTENSION IF NOT EXISTS pg_trgm;` 수동 추가
- **GIN 인덱스 필수**: `name`, `description` 컬럼에 GIN 인덱스 추가 (pg_trgm ILIKE 성능 보장)
  ```sql
  CREATE INDEX shops_name_trgm ON shops USING GIN (name gin_trgm_ops);
  CREATE INDEX shops_desc_trgm ON shops USING GIN (description gin_trgm_ops);
  ```
- **시드 데이터** (W1에서 처리 — W2 API 의존성 해소):
  - 전국 시/도 + 구/군 시드
  - 떡 카테고리 시드
- data-collector 실행: 샘플 먼저 (서울 100~200건) → 개발 병렬 진행
- 전국 데이터 수집은 시/도 단위 분할 (Kakao API 일 10만 한도 고려, 딜레이 500ms/건)

### Phase 2: 코어 API (Route Handlers)
> ⚠️ Next.js 15: GET Route Handlers 기본 캐싱 없음 → 캐싱 필요 시 명시 필수

- GET /api/shops (목록 + 필터 + 페이지네이션) → `export const dynamic = 'force-dynamic'`
- GET /api/shops/[slug] (상세) → `export const revalidate = 3600`
- GET /api/regions (시/도 목록) → `export const revalidate = false` (정적)
- GET /api/regions/[id]/districts (구/군 목록) → 동일
- GET /api/categories (카테고리 목록) → 동일
- GET /api/search?q=keyword (검색) → `export const dynamic = 'force-dynamic'`, pg_trgm GIN 인덱스 활용
- GET /api/blog (목록 + 카테고리 필터) → `export const revalidate = 3600`
- GET /api/blog/[slug] (상세) → `export const revalidate = 3600`

### Phase 3: 프론트엔드 UI
- 홈페이지 (검색바 + 인기지역 + 최근등록 + **인기 떡집 by viewCount**)
- 떡집 목록 페이지 (필터 + 정렬: 최신순/이름순/**인기순** + 페이지네이션)
- 떡집 상세 페이지 (정보 + 메뉴 + 지도) → 상세 진입 시 viewCount +1
- **블로그 목록 페이지** (카테고리 필터 + 카드 그리드)
- **블로그 상세 페이지** (본문 + 관련 떡집 + 관련 글)
- Kakao Map: layout 레벨에서 SDK 스크립트 로드 (`KakaoMapProvider`)
- 모바일 반응형 (mobile-first)
- 심플한 디자인 (회의: 기능 우선, 양산형 OK)

### Phase 4: 관리자 패널
- Auth.js v5 인증 (admin role, Credentials provider)
- 떡집 CRUD (등록/수정/삭제)
- 이미지 업로드 (Supabase Storage Presigned URL → 클라이언트 직접 업로드, Vercel 4.5MB 제한 우회)
- 카테고리 관리
- **블로그 글 작성/수정/발행** (Tiptap rich text editor)
- **AI 콘텐츠 생성 패널**: 떡집 선택 → 글 유형 선택 → 생성 → 검수 → 발행

### Phase 5: SEO + 배포 + AI 콘텐츠
- 메타태그, Open Graph, JSON-LD 구조화 데이터
- sitemap.xml 자동 생성 (**블로그 글 포함**)
- Kakao 디벨로퍼스: localhost:3000, *.vercel.app, 커스텀 도메인 등록
- Vercel 배포 + Supabase 연결 (환경변수 설정)
- 도메인 연결
- `tools/content-generator/` CLI 도구: Claude API (Sonnet) 연동
- 관리자 AI 패널 (생성 UI + 결과 미리보기 + 발행)

### Phase 6 (post-MVP): 확장
- Review/Rating 시스템
- 떡집 Claim (사장님 직접 등록)
- 네이버/인스타 자동발행
- Elasticsearch 전환 (트래픽 증가 시)
- 블로그 댓글 시스템

### Phase 7: 비즈니스 모델 + UI/UX 혁신

#### 7-1. 비즈니스 모델 구축
- **직거래/위탁 판매 플랫폼 전환**: 쿠팡 등 대형 플랫폼 수수료(~30%) 대비 저수수료로 소규모 떡집 입점 유도
- **수익 파이프라인 (단계별)**:
  1. 초기: 포털로 떡집-소비자 연결 (홍보 대행), 트래픽(PV) 확보 집중
  2. 성장기: 트래픽 증가 → 업체들이 저렴한 공급가로 입점 제안
  3. 확장기: 떡 → 디저트, 특산품 등 위탁 판매 아이템 확장 → 수익 다각화

#### 7-2. 데이터 선점 전략 강화
- **압도적 데이터량으로 진입장벽 구축**: 전국 떡집 + 떡 종류 데이터 방대하게 수집·정리
- 공공 API 자동 수집 주기화 (소상공인 API 정기 갱신) + 발품 직접 등록 병행
- **지역 기반 정밀 소팅**: 사용자 위치 기반 근처 영업 중인 떡집 우선 표시
- 다나와 스타일 즉각 필터링 — 지역 + 떡 종류 + 가격대 조합 소팅

#### 7-3. UI/UX 혁신 (모바일 중심)
- **맥도날드 키오스크 스타일 블록형 버튼 UI**:
  - 텍스트 나열 리스트 → 이미지 포함 큼직한 입체 블록형 버튼으로 전환
  - 예: '서울시' 버튼 → 드롭다운 아닌 하위 지역/업체가 블록 버튼으로 즉각 표시
  - 모바일 쇼핑 익숙한 젊은 세대 타겟
- **리볼버(Revolver) 타입 메뉴**:
  - 단순 스크롤 넘어 핵심 옵션 3개가 입체적으로 회전하며 나타나는 차세대 UI
  - 홈/카테고리 선택 등 핵심 진입점에 적용

## 에이전트 배치 (Wave 기반, 병렬 최우선)

> 규칙: 파일 충돌 없는 태스크는 반드시 동시 실행. 최대 4개/Wave.

| Wave | 에이전트 | 모델 | 태스크 | 파일 범위 |
|------|---------|------|-------|---------|
| W1 | Sonnet-Setup | sonnet | Next.js 초기화, next.config.ts, .env.example, Docker Compose, projects.json | `package.json`, `next.config.ts`, `.env*`, `docker-compose.yml` |
| W1 | Sonnet-Schema | sonnet | Prisma 스키마 전체 (Shop/Blog/Region/Menu/Admin) + 마이그레이션 + **시드 데이터 (Region/District/Category)** | `prisma/**` |
| W1 | Sonnet-Collector | sonnet | tools/data-collector CLI 도구 전체 | `tools/data-collector/**` |
| W2 | Sonnet-API-Shops | sonnet | GET /api/shops, GET /api/shops/[slug] | `app/api/shops/**` |
| W2 | Sonnet-API-Regions | sonnet | GET /api/regions, GET /api/regions/[id]/districts, GET /api/categories | `app/api/regions/**`, `app/api/categories/**` |
| W2 | Sonnet-API-Search | sonnet | GET /api/search (pg_trgm ILIKE) | `app/api/search/**` |
| W2 | Sonnet-API-Blog | sonnet | GET /api/blog, GET /api/blog/[slug] | `app/api/blog/**` |
| W2→ | **오케스트레이터** | — | 공통 layout.tsx, Header, Footer, Prisma client (`lib/prisma.ts`) | `app/layout.tsx`, `components/layout/**`, `lib/prisma.ts` |
| W3 | Sonnet-Home | sonnet | 홈페이지 (검색바 + 인기지역 + 최근등록) | `app/page.tsx`, `components/home/**` |
| W3 | Sonnet-ShopList | sonnet | 떡집 목록 (필터+정렬+페이지네이션) | `app/shops/page.tsx`, `components/shops/list/**` |
| W3 | Sonnet-ShopDetail | sonnet | 떡집 상세 (정보+메뉴+지도+KakaoMapProvider) | `app/shops/[slug]/page.tsx`, `components/shops/detail/**`, `components/map/**` |
| W3 | Sonnet-Blog | sonnet | 블로그 목록 + 상세 페이지 | `app/blog/**`, `components/blog/**` |
| W4 | Sonnet-Auth | sonnet | Auth.js v5 (admin role, Credentials, 세션 미들웨어) | `app/api/auth/**`, `middleware.ts`, `lib/auth.ts` |
| W4 | Sonnet-Admin-CRUD | sonnet | 관리자 떡집 CRUD + 카테고리 관리 | `app/admin/**` (auth/blog 제외) |
| W4 | Sonnet-Image | sonnet | Supabase Storage Presigned URL 업로드 API + 이미지 컴포넌트 | `app/api/upload/**`, `components/ui/ImageUpload.tsx` |
| W4 | Sonnet-Admin-Blog | sonnet | 관리자 블로그 글 작성/수정/발행 UI (Tiptap) | `app/admin/blog/**` |
| W5 | Sonnet-SEO | sonnet | 메타태그, OG, JSON-LD, sitemap.xml (블로그 포함) | `app/sitemap.ts`, `lib/seo.ts` |
| W5 | Sonnet-ContentGen | sonnet | tools/content-generator CLI + Claude API 연동 | `tools/content-generator/**` |
| W5 | Sonnet-Admin-AI | sonnet | 관리자 AI 패널 (생성 UI + 결과 미리보기 + 발행) | `app/admin/ai-content/**` |
| W5 | Haiku-Docs | haiku | README, API 문서, 운영 가이드, 블로그/SNS 운영 가이드 | `docs/**`, `README.md` |

## 핵심 설계 원칙 (회의 기반)
1. **심플한 UI**: 2-3 클릭으로 원하는 지역 떡집 도달
2. **기능 우선**: 화려함 X, 빠짐없는 기능
3. **양산형 디자인**: 많이 쓰는 패턴 벤치마킹 (네이버 플레이스 참고)
4. **등록 용이성**: 컴퓨터 못하는 떡집 사장님도 쉽게
5. **모바일 퍼스트**: 떡집 검색은 주로 모바일
6. **콘텐츠 우선 SEO**: 블로그로 유기 트래픽 확보 → 떡집 등록 유도

## Verification
1. `pnpm dev` → 로컬에서 홈/목록/상세/블로그 페이지 정상 렌더링
2. 지역 필터: 서울 → 강남구 선택 → 해당 떡집만 표시
3. 검색: "송편" 입력 → 관련 떡집 목록 반환
4. 관리자: 로그인 → 떡집 등록 → 목록에 표시
5. 블로그: 관리자 → 글 작성 → /blog에 노출
6. AI 콘텐츠: 관리자 → 떡집 선택 → 생성 → 초안 확인
7. 모바일: 크롬 DevTools 모바일 뷰 확인
8. SEO: `curl` 응답에 메타태그 + JSON-LD 포함, sitemap에 블로그 글 포함
9. Lighthouse 성능 80+ / SEO 90+

## 비용 추정
- **Supabase Free Tier**: 500MB DB, 1GB Storage, 50K MAU auth — MVP 충분
- **Kakao API**: 일 10만건 무료 — 초기 수집 1회 + 주기적 보정용 충분
- **Claude API**: 블로그 1건당 ~$0.05 (3종 동시생성) → 월 100건 = ~$5
- **GPT Image API**: 썸네일 1장 ~$0.04 → 필요 시만 생성
- **Vercel Hobby**: 무료 (커스텀 도메인 포함)

## 미결정 사항
- AI 콘텐츠 생성 빈도 (주 1회? 떡집 등록 시 자동?)
- 이미지 생성 도구 최종 선정 (GPT image vs DALL-E 3 vs 기타)
- 네이버/인스타 자동발행 전환 시점 (트래픽 발생 후 고려)
- 콘텐츠 생성 비용 관리 (Claude API 호출 비용)
