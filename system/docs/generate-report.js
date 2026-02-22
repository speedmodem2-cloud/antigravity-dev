/* eslint-disable */
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  HeadingLevel,
  AlignmentType,
  ShadingType,
} = require('docx');
const fs = require('fs');

// ─── Style helpers ───
const title = (text) =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 36, font: '맑은 고딕' })],
    heading: HeadingLevel.TITLE,
    spacing: { after: 200 },
  });

const subtitle = (text) =>
  new Paragraph({
    children: [new TextRun({ text, size: 20, color: '666666', font: '맑은 고딕' })],
    spacing: { after: 400 },
  });

const h1 = (text) =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 28, font: '맑은 고딕', color: '1a1a2e' })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '3a86ff' } },
  });

const h2 = (text) =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, font: '맑은 고딕', color: '2d3436' })],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
  });

const h3 = (text) =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, font: '맑은 고딕', color: '636e72' })],
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
  });

const para = (text) =>
  new Paragraph({
    children: [new TextRun({ text, size: 20, font: '맑은 고딕' })],
    spacing: { after: 120 },
  });

const bullet = (text, boldPrefix = '') =>
  new Paragraph({
    children: [
      ...(boldPrefix
        ? [new TextRun({ text: boldPrefix, bold: true, size: 20, font: '맑은 고딕' })]
        : []),
      new TextRun({ text, size: 20, font: '맑은 고딕' }),
    ],
    bullet: { level: 0 },
    spacing: { after: 60 },
  });

const quote = (text) =>
  new Paragraph({
    children: [new TextRun({ text, size: 18, italics: true, color: '888888', font: '맑은 고딕' })],
    indent: { left: 720 },
    spacing: { after: 120 },
  });

const spacer = () => new Paragraph({ spacing: { after: 200 } });

// ─── Table helpers ───
const headerCell = (text) =>
  new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 18, font: '맑은 고딕', color: 'ffffff' })],
        alignment: AlignmentType.CENTER,
      }),
    ],
    shading: { type: ShadingType.SOLID, color: '3a86ff' },
    verticalAlign: 'center',
  });

const cell = (text, bold = false) =>
  new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 18, font: '맑은 고딕', bold })],
      }),
    ],
    verticalAlign: 'center',
  });

const makeTable = (headers, rows) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headers.map((h) => headerCell(h)), tableHeader: true }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: row.map((c, i) => cell(c, i === 0)),
          }),
      ),
    ],
  });

// ─── Document ───
const doc = new Document({
  sections: [
    {
      properties: {
        page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      children: [
        // ── Cover ──
        title('P6: 떡집 통합 플랫폼'),
        subtitle('프로젝트 계획 보고서  |  2026-02-19  |  tteok-platform'),
        spacer(),

        // ── 1. 개요 ──
        h1('1. 프로젝트 개요'),
        h2('목표'),
        para(
          '전국의 떡집 정보를 한곳에 모아, 2~3번 클릭만으로 원하는 지역의 떡집을 찾을 수 있는 웹 플랫폼을 만듭니다.',
        ),
        spacer(),

        h2('왜 이 서비스가 필요한가?'),
        bullet('현재 떡집 정보는 네이버 지도, 카카오맵 등에 흩어져 있음'),
        bullet('"우리 동네 떡집"을 찾으려면 여러 사이트를 돌아다녀야 함'),
        bullet('떡 종류(송편, 인절미 등)로 필터링하는 전문 서비스가 없음'),
        bullet('떡집 사장님들이 자기 가게 정보를 쉽게 등록/관리할 수 있는 곳이 없음'),
        spacer(),

        h2('핵심 가치'),
        bullet('2~3클릭이면 원하는 떡집 도달', '심플한 UI — '),
        bullet('화려함보다 빠짐없는 기능', '기능 우선 — '),
        bullet('떡집 검색은 대부분 모바일에서 발생', '모바일 퍼스트 — '),
        bullet('컴퓨터에 익숙하지 않은 떡집 사장님도 쉽게 사용', '등록 용이성 — '),
        spacer(),

        // ── 2. 기술 스택 ──
        h1('2. 기술 스택 선택 이유'),

        h2('왜 Next.js인가?'),
        makeTable(
          ['비교 항목', 'Next.js (선택)', 'React (SPA)', '일반 HTML'],
          [
            [
              'SEO (검색 노출)',
              '서버에서 HTML 생성 → 네이버/구글 검색 잘 됨',
              '검색엔진이 내용을 못 읽음',
              '가능하지만 개발 비효율',
            ],
            ['개발 속도', '라우팅, API, SSR 내장', 'API 서버 따로 필요', '모든 걸 직접 구현'],
            ['배포', 'Vercel에 한 번에 배포', '프론트/백엔드 각각 배포', '단순하지만 기능 제한'],
          ],
        ),
        spacer(),
        para(
          '결론: 떡집 플랫폼은 네이버/구글에서 "강남 떡집" 검색 시 노출되어야 합니다. Next.js의 서버사이드 렌더링(SSR)이 SEO에 가장 유리하고, API까지 한 프로젝트에서 관리 가능합니다.',
        ),
        spacer(),

        h2('왜 PostgreSQL + Prisma인가?'),
        makeTable(
          ['비교 항목', 'PostgreSQL (선택)', 'MySQL', 'MongoDB'],
          [
            [
              '한국어 검색',
              'pg_trgm으로 유사 검색 내장',
              '별도 설정 필요',
              '별도 Atlas Search 필요',
            ],
            ['관계형 데이터', '강력 (지역→구→떡집→메뉴→카테고리)', '가능', '비효율적 (NoSQL)'],
            ['무료 호스팅', 'Supabase 500MB 무료', 'PlanetScale 무료 폐지', 'Atlas 512MB 무료'],
            ['ORM', 'Prisma (타입 안전, 자동 완성)', 'Prisma', 'Prisma (제한적)'],
          ],
        ),
        spacer(),
        para(
          '결론: 떡집 데이터는 전형적인 관계형 구조입니다. 지역 → 구/군 → 떡집 → 메뉴, 떡집 ↔ 카테고리(N:M) 관계가 있어 PostgreSQL이 최적입니다. pg_trgm 확장으로 유사 검색도 가능합니다.',
        ),
        spacer(),

        h2('왜 Kakao Map인가?'),
        makeTable(
          ['비교 항목', 'Kakao Map (선택)', 'Naver Map', 'Google Maps'],
          [
            ['한국 주소 정확도', '매우 높음', '매우 높음', '보통 (한국 주소 부정확)'],
            ['무료 한도', '일 30만 콜', '일 10만 콜', '월 $200 크레딧 후 과금'],
            [
              'React 라이브러리',
              'react-kakao-maps-sdk (안정적)',
              '공식 없음',
              '@vis.gl/react-google-maps',
            ],
            ['Geocoding 무료', '10만/일', '1만/일', '과금 ($5/1000건)'],
            ['데이터 저장 TOS', '허용', 'DB 구축 금지', '조건부 허용'],
          ],
        ),
        spacer(),
        para(
          '결론: Naver Map은 데이터를 DB에 저장하는 것을 약관상 금지합니다. 우리 프로젝트는 공공데이터 + 좌표 보정 결과를 DB에 저장해야 하므로 Naver는 사용 불가. Kakao Map은 무료 한도가 넉넉하고, 한국 주소 정확도가 높으며, React 라이브러리도 안정적입니다.',
        ),
        spacer(),

        h2('왜 Tailwind CSS인가?'),
        makeTable(
          ['비교 항목', 'Tailwind CSS (선택)', 'styled-components', '일반 CSS'],
          [
            ['개발 속도', '매우 빠름 (클래스만 조합)', '보통', '느림'],
            ['반응형', 'md:, lg: 접두어로 간단', '미디어 쿼리 직접 작성', '미디어 쿼리 직접 작성'],
            ['디자인 일관성', '디자인 토큰 내장', '직접 관리', '직접 관리'],
            ['번들 크기', '미사용 스타일 자동 제거', '런타임 오버헤드', '수동 관리'],
          ],
        ),
        spacer(),
        para(
          '결론: "양산형 디자인, 기능 우선"이라는 프로젝트 방향에 가장 적합합니다. 빠르게 깔끔한 UI를 만들 수 있고, 모바일 반응형도 간단합니다.',
        ),
        spacer(),

        h2('왜 Supabase인가? (Firebase 비교)'),
        makeTable(
          ['비교 항목', 'Supabase (선택)', 'Firebase'],
          [
            ['DB 종류', 'PostgreSQL (관계형)', 'Firestore (NoSQL)'],
            ['복합 필터', '지역 + 카테고리 + 정렬 + 페이지네이션 자유자재', '복합 쿼리 제한 많음'],
            ['한국어 검색', 'pg_trgm 내장', 'Algolia 별도 연동 필요 (추가 비용)'],
            ['스토리지', '1GB 무료', '5GB 무료'],
            ['무료 한도', '500MB DB + 1GB 스토리지', '1GB Firestore + 5GB 스토리지'],
          ],
        ),
        spacer(),
        para(
          '결론: 떡집 데이터는 관계형 구조입니다. Firebase의 Firestore는 복합 필터링 + 정렬 + 페이지네이션 조합에 제한이 많고, 한국어 검색에 별도 서비스가 필요합니다. Supabase는 PostgreSQL 기반이라 모두 무료로 가능합니다.',
        ),
        spacer(),

        // ── 3. 데이터 수집 ──
        h1('3. 데이터 수집 전략'),
        h2('데이터는 어디서 오는가?'),
        para('떡집 데이터를 확보하기 위해 합법적인 공공데이터를 활용합니다.'),
        spacer(),

        h3('1단계: 공공데이터 포털 (기본 목록)'),
        bullet('소상공인시장진흥공단 상가(상권)정보 API (무료, 합법)'),
        bullet('업종코드 "떡류제조" + "떡집" 필터 → 전국 떡집 기본 목록'),
        bullet('제공 정보: 상호명, 주소, 좌표, 업종, 전화번호'),
        bullet('상가업소번호: 각 가게의 고유 ID (중복 방지 기준)'),
        spacer(),

        h3('2단계: Kakao Local API (좌표 보정)'),
        bullet('공공데이터의 주소를 카카오 Geocoding으로 정확한 좌표로 변환'),
        bullet('일 100,000건 무료 (전국 떡집 수천 건 → 여유)'),
        spacer(),

        h3('사용하지 않는 소스'),
        bullet('약관상 데이터를 복제하거나 DB에 저장하는 것이 금지됨', 'Naver Place API: '),
        bullet('영업시간, 사진 등은 떡집 사장님 직접 입력(Claim) 또는 관리자 수동 등록'),
        spacer(),

        h2('데이터 수집 도구'),
        para('독립된 CLI 도구 (tools/data-collector/)로 만들어서:'),
        bullet('최초 1회 전체 수집 후, 주기적으로 재실행하여 갱신'),
        bullet('이미 관리자가 수정한 정보(설명, 사진 등)는 덮어쓰지 않음 (멱등성)'),
        bullet('수집 통계 기록: 신규 몇 건, 갱신 몇 건, 스킵 몇 건'),
        spacer(),

        // ── 4. 주요 기능 ──
        h1('4. 주요 기능'),
        h2('사용자 기능'),
        makeTable(
          ['기능', '설명'],
          [
            ['지역별 검색', '시/도 → 구/군 선택으로 해당 지역 떡집 목록 표시'],
            ['키워드 검색', '"송편", "인절미" 등 떡 종류나 가게 이름으로 검색'],
            ['떡집 상세', '기본 정보, 메뉴(가격 포함), 영업시간, 지도 표시'],
            ['카테고리 필터', '떡 종류별 필터링 (송편, 인절미, 백설기 등)'],
            ['모바일 최적화', '스마트폰에서 편리하게 사용'],
          ],
        ),
        spacer(),

        h2('관리자 기능'),
        makeTable(
          ['기능', '설명'],
          [
            ['떡집 관리', '등록, 수정, 삭제 (CRUD)'],
            ['이미지 업로드', '가게 사진, 메뉴 사진 업로드'],
            ['카테고리 관리', '떡 종류 추가/수정'],
            ['대시보드', '등록 현황, 지역별 통계'],
          ],
        ),
        spacer(),

        // ── 5. 비용 ──
        h1('5. 운영 비용'),
        h2('MVP 단계 (출시 직후)'),
        makeTable(
          ['항목', '서비스', '비용', '비고'],
          [
            ['프론트엔드 호스팅', 'Vercel (Hobby)', '무료', '개인 프로젝트 무료'],
            ['데이터베이스', 'Supabase (Free)', '무료', '500MB DB + 1GB 스토리지'],
            ['이미지 저장', 'Cloudflare R2', '무료', '10GB 저장 + 무제한 다운로드'],
            ['지도 API', 'Kakao Map', '무료', '일 30만 콜 무료'],
            ['공공데이터 API', 'data.go.kr', '무료', '정부 공공데이터'],
            ['도메인', '.kr 또는 .com', '연 ~1.5만원', '유일한 필수 비용'],
            ['월 합계', '', '~0원 + 도메인', ''],
          ],
        ),
        spacer(),

        h2('성장 단계 (월 수만 방문)'),
        makeTable(
          ['항목', '서비스', '비용', '전환 이유'],
          [
            ['프론트엔드 호스팅', 'Vercel (Pro)', '$20/월', '상용 서비스 + 팀 기능'],
            ['데이터베이스', 'Supabase (Pro)', '$25/월', '8GB DB + 100GB 스토리지'],
            ['이미지 저장', 'Cloudflare R2', '~$1~3/월', '10GB 초과분만 과금'],
            ['지도/데이터 API', '동일', '무료', '한도 내'],
            ['월 합계', '', '~$46~48/월 (약 6만원)', ''],
          ],
        ),
        spacer(),
        quote(
          '참고: 떡집 수천 개 + 일 수백 방문 수준이면 무료 티어로 충분히 커버됩니다. 유료 전환은 트래픽이 무료 한도를 넘길 때 고려하면 됩니다.',
        ),
        spacer(),

        // ── 6. 일정 ──
        h1('6. 구현 일정 (Phase 구조)'),
        makeTable(
          ['Phase', '이름', '주요 작업'],
          [
            ['0', '사전점검 + 셋업', '프로젝트 생성, DB 설정, Docker, 환경변수'],
            ['1', '데이터 모델 + 수집', 'Prisma 스키마, 시드 데이터, 공공데이터 수집'],
            ['2', '코어 API', '떡집 목록/상세/검색/필터 API'],
            ['3', '프론트엔드 UI', '홈, 목록, 상세 페이지 (모바일 반응형)'],
            ['4', '관리자 패널', '로그인, 떡집 CRUD, 이미지 업로드'],
            ['5', 'SEO + 배포', '메타태그, sitemap, Vercel 배포, 도메인 연결'],
          ],
        ),
        spacer(),

        // ── 7. 검증 ──
        h1('7. 검증 기준'),
        para('구현 완료 후 아래 항목을 확인합니다:'),
        bullet('pnpm dev → 로컬에서 홈/목록/상세 페이지가 정상 렌더링되는가'),
        bullet('지역 필터: 서울 → 강남구 선택 시 해당 지역 떡집만 표시되는가'),
        bullet('검색: "송편" 입력 시 관련 떡집 목록이 반환되는가'),
        bullet('관리자: 로그인 → 떡집 등록 → 목록에 정상 표시되는가'),
        bullet('모바일: 크롬 DevTools 모바일 뷰에서 사용 가능한가'),
        bullet('SEO: 페이지 소스에 메타태그 + JSON-LD 구조화 데이터가 포함되는가'),
        bullet('Lighthouse 성능 80+ / SEO 90+'),
        spacer(),

        // ── 8. 리스크 ──
        h1('8. 리스크 및 대응'),
        makeTable(
          ['리스크', '영향', '대응'],
          [
            ['공공데이터 API 장애', '데이터 수집 불가', 'raw JSON 로컬 백업, 오프라인 시드로 전환'],
            ['Kakao API 한도 초과', '좌표 보정 중단', '일 10만 건이라 전국 데이터도 1회에 충분'],
            ['Supabase 500MB 초과', 'DB 용량 부족', '떡집 수천 건 + 메뉴 → 100MB 이하 예상'],
            [
              'Vercel 4.5MB 요청 제한',
              '이미지 업로드 불가',
              'S3 Presigned URL로 클라이언트 직접 업로드',
            ],
            ['네이버 검색 노출 부족', '사용자 유입 감소', 'JSON-LD + sitemap + SSR로 SEO 최적화'],
          ],
        ),
        spacer(),

        // ── Footer ──
        quote(
          '이 보고서는 P6 프로젝트의 기술 결정과 비용 구조를 정리한 문서입니다. 구현 진행 시 변경 사항이 발생하면 업데이트합니다.',
        ),
      ],
    },
  ],
});

// ─── Generate ───
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync('P6-tteok-platform-계획보고서.docx', buffer);
  console.log('OK: P6-tteok-platform-계획보고서.docx generated');
});
