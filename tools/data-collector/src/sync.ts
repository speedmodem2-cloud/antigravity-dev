import pg from 'pg';
import { getUnsyncedShops, markSynced, type RawShop } from './db.js';

const { Pool } = pg;

function getPool() {
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

// Map raw_shop categories to existing category IDs
async function findOrCreateCategories(pool: pg.Pool, categories: string[]): Promise<number[]> {
  const ids: number[] = [];

  for (const catName of categories) {
    // Try common tteok-related categories
    const existing = await pool.query(
      'SELECT id FROM "Category" WHERE name = $1 OR slug = $1 LIMIT 1',
      [catName],
    );

    if (existing.rows.length > 0) {
      ids.push(existing.rows[0].id);
    }
  }

  return ids;
}

// Find matching region/district IDs from address
async function findRegionDistrict(
  pool: pg.Pool,
  address: string,
): Promise<{ regionId: number; districtId: number } | null> {
  // Try to match region first
  const regionResult = await pool.query(
    `SELECT id, name FROM "Region" WHERE $1 LIKE '%' || name || '%' LIMIT 1`,
    [address],
  );

  if (regionResult.rows.length === 0) return null;

  const regionId = regionResult.rows[0].id;
  const regionName = regionResult.rows[0].name;

  // Try to match district
  const districtResult = await pool.query(
    `SELECT id FROM "District" WHERE "regionId" = $1 AND $2 LIKE '%' || name || '%' LIMIT 1`,
    [regionId, address.replace(regionName, '')],
  );

  if (districtResult.rows.length === 0) {
    // Use first district of region as fallback
    const fallback = await pool.query('SELECT id FROM "District" WHERE "regionId" = $1 LIMIT 1', [
      regionId,
    ]);
    if (fallback.rows.length === 0) return null;
    return { regionId, districtId: fallback.rows[0].id };
  }

  return { regionId, districtId: districtResult.rows[0].id };
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣-]/g, '')
    .slice(0, 80);
}

async function syncShop(pool: pg.Pool, raw: RawShop): Promise<boolean> {
  const address = raw.road_address || raw.address || '';

  // Check if shop already exists by name + address
  const existing = await pool.query(
    'SELECT id FROM "Shop" WHERE name = $1 AND address = $2 LIMIT 1',
    [raw.name, address],
  );

  if (existing.rows.length > 0) {
    // Update existing shop with new data
    await pool.query(
      `UPDATE "Shop" SET
        phone = COALESCE($2, phone),
        lat = COALESCE($3, lat),
        lng = COALESCE($4, lng),
        description = COALESCE($5, description)
      WHERE id = $1`,
      [existing.rows[0].id, raw.phone ?? null, raw.lat ?? null, raw.lng ?? null, null],
    );
    return true;
  }

  // Find region/district
  const location = await findRegionDistrict(pool, address);
  if (!location) {
    console.warn(`  Skip "${raw.name}": region not found for "${address}"`);
    return false;
  }

  // Generate unique slug
  let slug = generateSlug(raw.name);
  const slugCheck = await pool.query('SELECT id FROM "Shop" WHERE slug = $1', [slug]);
  if (slugCheck.rows.length > 0) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  // Insert new shop
  const result = await pool.query(
    `INSERT INTO "Shop" (name, slug, address, phone, lat, lng, status, "isVerified", "regionId", "districtId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', false, $7, $8, NOW(), NOW())
     RETURNING id`,
    [
      raw.name,
      slug,
      address,
      raw.phone ?? null,
      raw.lat ?? null,
      raw.lng ?? null,
      location.regionId,
      location.districtId,
    ],
  );

  const shopId = result.rows[0].id;

  // Link categories
  const categories =
    typeof raw.categories === 'string' ? JSON.parse(raw.categories) : (raw.categories ?? []);
  const categoryIds = await findOrCreateCategories(pool, categories);
  for (const catId of categoryIds) {
    await pool.query(
      'INSERT INTO "ShopCategory" ("shopId", "categoryId") VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [shopId, catId],
    );
  }

  return true;
}

export interface SyncOptions {
  source?: string;
  limit?: number;
  dryRun?: boolean;
}

export async function syncToSupabase(
  options: SyncOptions = {},
): Promise<{ synced: number; skipped: number; errors: number }> {
  const { limit = 100, dryRun = false } = options;
  const shops = getUnsyncedShops(limit);

  if (shops.length === 0) {
    console.log('[Sync] No unsynced shops found.');
    return { synced: 0, skipped: 0, errors: 0 };
  }

  console.log(`[Sync] ${shops.length} shops to sync${dryRun ? ' (DRY RUN)' : ''}...`);

  if (dryRun) {
    for (const shop of shops) {
      console.log(`  Would sync: "${shop.name}" (${shop.address})`);
    }
    return { synced: 0, skipped: shops.length, errors: 0 };
  }

  const pool = getPool();
  let synced = 0;
  let skipped = 0;
  let errors = 0;
  const syncedIds: number[] = [];

  try {
    for (const shop of shops) {
      try {
        const ok = await syncShop(pool, shop);
        if (ok) {
          synced++;
          if (shop.id) syncedIds.push(shop.id);
        } else {
          skipped++;
        }
      } catch (err) {
        errors++;
        console.error(
          `  Error syncing "${shop.name}": ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (syncedIds.length > 0) {
      markSynced(syncedIds);
    }
  } finally {
    await pool.end();
  }

  console.log(`[Sync] Done: ${synced} synced, ${skipped} skipped, ${errors} errors`);
  return { synced, skipped, errors };
}
