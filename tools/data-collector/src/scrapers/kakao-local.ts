import { upsertShop, logCollection, type RawShop } from '../db.js';

const KAKAO_API_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json';
const API_KEY = () => process.env.KAKAO_REST_API_KEY ?? '';

interface KakaoPlace {
  id: string;
  place_name: string;
  category_name: string;
  category_group_code: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string; // longitude
  y: string; // latitude
  place_url: string;
}

interface KakaoResponse {
  meta: { total_count: number; pageable_count: number; is_end: boolean };
  documents: KakaoPlace[];
}

async function searchKakao(query: string, page: number, region?: string): Promise<KakaoResponse> {
  const params = new URLSearchParams({
    query: region ? `${region} ${query}` : query,
    page: String(page),
    size: '15',
  });

  const res = await fetch(`${KAKAO_API_URL}?${params}`, {
    headers: { Authorization: `KakaoAK ${API_KEY()}` },
  });

  if (!res.ok) {
    throw new Error(`Kakao API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

function toRawShop(place: KakaoPlace): RawShop {
  const cats = place.category_name.split(' > ').filter(Boolean);
  return {
    source: 'kakao',
    source_id: place.id,
    name: place.place_name,
    address: place.address_name,
    road_address: place.road_address_name,
    phone: place.phone || undefined,
    lat: parseFloat(place.y),
    lng: parseFloat(place.x),
    categories: cats,
    raw_data: JSON.stringify(place),
  };
}

export interface ScrapeOptions {
  query: string;
  region?: string;
  maxPages?: number;
}

export async function scrapeKakao(
  options: ScrapeOptions,
): Promise<{ found: number; inserted: number }> {
  const { query, region, maxPages = 45 } = options; // Kakao max 45 pages
  let page = 1;
  let totalFound = 0;
  let totalNew = 0;

  console.log(`[Kakao] Scraping: "${region ? `${region} ` : ''}${query}" (max ${maxPages} pages)`);

  while (page <= maxPages) {
    try {
      const data = await searchKakao(query, page, region);
      const places = data.documents;

      if (places.length === 0) break;

      totalFound += places.length;

      for (const place of places) {
        const shop = toRawShop(place);
        const changes = upsertShop(shop);
        if (changes > 0) totalNew++;
      }

      console.log(`  page ${page}: ${places.length} results (total: ${totalFound})`);

      if (data.meta.is_end) break;
      page++;

      // Rate limit: 100ms between requests
      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  page ${page} error: ${msg}`);
      logCollection('kakao', `${region ?? ''} ${query}`, totalFound, totalNew, msg);
      break;
    }
  }

  logCollection('kakao', `${region ?? ''} ${query}`, totalFound, totalNew);
  console.log(`[Kakao] Done: ${totalFound} found, ${totalNew} new/updated`);

  return { found: totalFound, inserted: totalNew };
}

// Scrape across all major regions
const REGIONS = [
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
  '경기',
  '강원',
  '충북',
  '충남',
  '전북',
  '전남',
  '경북',
  '경남',
  '제주',
];

export async function scrapeKakaoAllRegions(
  query: string,
): Promise<{ found: number; inserted: number }> {
  let totalFound = 0;
  let totalNew = 0;

  for (const region of REGIONS) {
    const result = await scrapeKakao({ query, region });
    totalFound += result.found;
    totalNew += result.inserted;

    // 500ms between regions
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n[Kakao] All regions complete: ${totalFound} found, ${totalNew} new/updated`);
  return { found: totalFound, inserted: totalNew };
}
