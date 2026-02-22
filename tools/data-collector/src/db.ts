import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'collector.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS raw_shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      road_address TEXT,
      phone TEXT,
      lat REAL,
      lng REAL,
      rating REAL,
      review_count INTEGER DEFAULT 0,
      categories TEXT DEFAULT '[]',
      hours TEXT,
      image_urls TEXT DEFAULT '[]',
      raw_data TEXT,
      collected_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced_at TEXT,
      UNIQUE(source, source_id)
    );

    CREATE TABLE IF NOT EXISTS raw_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      source_url TEXT UNIQUE,
      title TEXT,
      content TEXT,
      author TEXT,
      published_at TEXT,
      tags TEXT DEFAULT '[]',
      image_urls TEXT DEFAULT '[]',
      collected_at TEXT NOT NULL DEFAULT (datetime('now')),
      relevance_score REAL
    );

    CREATE TABLE IF NOT EXISTS collection_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      query TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      records_found INTEGER DEFAULT 0,
      records_new INTEGER DEFAULT 0,
      errors TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_raw_shops_source ON raw_shops(source);
    CREATE INDEX IF NOT EXISTS idx_raw_shops_name ON raw_shops(name);
    CREATE INDEX IF NOT EXISTS idx_raw_shops_synced ON raw_shops(synced_at);
  `);
}

export interface RawShop {
  id?: number;
  source: string;
  source_id: string;
  name: string;
  address?: string;
  road_address?: string;
  phone?: string;
  lat?: number;
  lng?: number;
  rating?: number;
  review_count?: number;
  categories?: string[];
  hours?: string;
  image_urls?: string[];
  raw_data?: string;
  collected_at?: string;
  synced_at?: string;
}

export function upsertShop(shop: RawShop): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO raw_shops (source, source_id, name, address, road_address, phone, lat, lng, rating, review_count, categories, hours, image_urls, raw_data)
    VALUES (@source, @source_id, @name, @address, @road_address, @phone, @lat, @lng, @rating, @review_count, @categories, @hours, @image_urls, @raw_data)
    ON CONFLICT(source, source_id) DO UPDATE SET
      name = excluded.name,
      address = COALESCE(excluded.address, raw_shops.address),
      road_address = COALESCE(excluded.road_address, raw_shops.road_address),
      phone = COALESCE(excluded.phone, raw_shops.phone),
      lat = COALESCE(excluded.lat, raw_shops.lat),
      lng = COALESCE(excluded.lng, raw_shops.lng),
      rating = COALESCE(excluded.rating, raw_shops.rating),
      review_count = COALESCE(excluded.review_count, raw_shops.review_count),
      categories = COALESCE(excluded.categories, raw_shops.categories),
      hours = COALESCE(excluded.hours, raw_shops.hours),
      image_urls = COALESCE(excluded.image_urls, raw_shops.image_urls),
      raw_data = COALESCE(excluded.raw_data, raw_shops.raw_data),
      collected_at = datetime('now')
  `);

  const result = stmt.run({
    source: shop.source,
    source_id: shop.source_id,
    name: shop.name,
    address: shop.address ?? null,
    road_address: shop.road_address ?? null,
    phone: shop.phone ?? null,
    lat: shop.lat ?? null,
    lng: shop.lng ?? null,
    rating: shop.rating ?? null,
    review_count: shop.review_count ?? 0,
    categories: JSON.stringify(shop.categories ?? []),
    hours: shop.hours ?? null,
    image_urls: JSON.stringify(shop.image_urls ?? []),
    raw_data: shop.raw_data ?? null,
  });

  return result.changes;
}

export function getStats() {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as count FROM raw_shops').get() as { count: number };
  const bySrc = db
    .prepare('SELECT source, COUNT(*) as count FROM raw_shops GROUP BY source')
    .all() as { source: string; count: number }[];
  const synced = db
    .prepare('SELECT COUNT(*) as count FROM raw_shops WHERE synced_at IS NOT NULL')
    .get() as { count: number };
  const unsynced = db
    .prepare('SELECT COUNT(*) as count FROM raw_shops WHERE synced_at IS NULL')
    .get() as { count: number };
  const articles = db.prepare('SELECT COUNT(*) as count FROM raw_articles').get() as {
    count: number;
  };
  const logs = db.prepare('SELECT * FROM collection_logs ORDER BY started_at DESC LIMIT 5').all();

  return {
    total: total.count,
    bySrc,
    synced: synced.count,
    unsynced: unsynced.count,
    articles: articles.count,
    recentLogs: logs,
  };
}

export function getUnsyncedShops(limit = 100): RawShop[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM raw_shops WHERE synced_at IS NULL LIMIT ?')
    .all(limit) as RawShop[];
}

export function markSynced(ids: number[]) {
  const db = getDb();
  const stmt = db.prepare("UPDATE raw_shops SET synced_at = datetime('now') WHERE id = ?");
  const tx = db.transaction(() => {
    for (const id of ids) stmt.run(id);
  });
  tx();
}

export function logCollection(
  source: string,
  query: string,
  found: number,
  newCount: number,
  errors?: string,
) {
  const db = getDb();
  db.prepare(
    `
    INSERT INTO collection_logs (source, query, completed_at, records_found, records_new, errors)
    VALUES (?, ?, datetime('now'), ?, ?, ?)
  `,
  ).run(source, query, found, newCount, errors ?? null);
}
