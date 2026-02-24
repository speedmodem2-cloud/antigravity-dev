# RNDPARK Homepage UI Design Request

## Project Overview

RNDPARK (알앤디파크) — Korean rice cake production equipment manufacturer.
Rebuilding their corporate homepage with a completely new visual identity.

## Design Direction

**Theme**: Dark cyberpunk / futuristic / AI-tech aesthetic
**Reference**: See UI1.JPG and ui2.png in this folder

**Key visual elements**:

- Deep dark backgrounds (#0a0a0f ~ #0d1117)
- Neon blue (#00d4ff) + purple (#b44aff) accent colors
- Glassmorphism cards (frosted glass with neon borders)
- Particle/node animations in backgrounds
- Holographic shine effects on cards
- Neon glow on hover states and active elements
- Korean typography (Noto Sans KR) + English tech font (Inter)

## Pages to Design (10 pages)

### 1. Landing Page (/)

- Full-viewport hero with particle animation background
- Company logo with neon glow effect
- Headline: "알앤디파크" + subtext about smart factory solutions
- Two CTA buttons: "스마트 팩토리 입장", "사업분야 더보기"
- Company stats section (glass cards): 특허, 제품수, 업력
- Brief company introduction section

### 2. Product Dashboard (/products)

- **Left sidebar**: Product category tree navigation
  - 떡 생산라인 > 침지공정/분쇄공정/증숙공정/성형공정/떡공정
  - 면라인, 사료라인, 자동화라인
- **Top**: 5 process step tabs (침지→분쇄→증숙→성형→떡)
- **Main area**: Machine selection bar + process overview grid
- **Right panel**: Quick inquiry contact card
- Industrial/manufacturing feel with cyberpunk styling

### 3. Product Detail (/products/[id])

- Same sidebar as dashboard
- Product hero: model number, title, description in glass card
- Image gallery with thumbnail strip
- Specification table with neon-bordered rows
- Features list with numbered items
- Review section (star ratings, user reviews)
- Inquiry form section

### 4. Business Page (/business)

- Hero section with gradient background
- 4 business division cards in 2x2 grid:
  - 떡 생산라인 (neon green accent)
  - 면라인 (neon orange accent)
  - 사료라인 (neon indigo accent)
  - 자동화라인 (neon purple accent)
- Each card: icon, title, description, feature tags
- Bottom CTA: consultation request

### 5. Customer Support (/support)

- Self-service banner with quick action buttons
- Service cards grid (8 cards):
  설치일정, 현장A/S, 부품주문, 장비영상, 장비등록, 기술자료, 보증확인, 서비스센터
- Contact section: 1:1 inquiry, phone, quote request
- FAQ preview section
- Operating hours info

### 6. Board — Notice & FAQ (/board)

- Dual tab interface: 공지사항 | FAQ
- Post list table with glass styling
- Search bar for filtering
- Pinned posts with special indicator
- "New" badge for recent posts
- Pagination

### 7. Board Detail (/board/[id])

- Post content in glass card
- Author info, date, view count
- Comment section below
- Navigation: previous/next post links

### 8. Search (/search)

- Central search bar with neon glow focus effect
- Results grouped by type (제품, 게시판, FAQ)
- Each result as glass card
- Empty state with search suggestions

### 9. Admin Dashboard (/admin)

- Stats cards row: 총 리뷰, 오늘 리뷰, 평균 평점, 총 제품, 총 문의
- Tab interface: 리뷰 관리 | 제품 관리 | 문의 관리
- Data tables with glass styling
- Action buttons (수정, 삭제, 답변)

### 10. Global Components

- **Navbar**: Fixed top, glassmorphism, logo + nav links + search icon
- **Footer**: Company info, contact, links
- **Mobile responsive**: Show mobile variants for key pages (landing, products, board)

## Design Constraints

- Mobile-first responsive (breakpoints: 640/768/1024/1280px)
- WCAG AA contrast ratio on text
- Korean as primary language
- Product images: industrial machinery (see 침지탱크.png, 시루형증숙기.png in this folder)

## Deliverable Format

Please generate UI mockup images for each page listed above.
Desktop (1440px wide) version is priority. Mobile (375px) for landing + products if possible.
