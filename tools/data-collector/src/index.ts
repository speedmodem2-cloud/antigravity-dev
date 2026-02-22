import 'dotenv/config';
import { Command } from 'commander';
import { scrapeKakao, scrapeKakaoAllRegions } from './scrapers/kakao-local.js';
import { syncToSupabase } from './sync.js';
import { getStats } from './db.js';

const program = new Command();

program.name('data-collector').description('Tteok shop data collection tool').version('1.0.0');

// --- Scrape commands ---
const scrape = program.command('scrape').description('Scrape data from sources');

scrape
  .command('kakao')
  .description('Scrape shops from Kakao Local API')
  .requiredOption('-q, --query <query>', 'Search query', '떡집')
  .option('-r, --region <region>', 'Region to search (e.g. 서울)')
  .option('--all-regions', 'Scrape across all 17 regions')
  .option('--max-pages <n>', 'Max pages per query', '45')
  .action(async (opts) => {
    if (!process.env.KAKAO_REST_API_KEY) {
      console.error('Error: KAKAO_REST_API_KEY not set');
      process.exit(1);
    }

    if (opts.allRegions) {
      await scrapeKakaoAllRegions(opts.query);
    } else {
      await scrapeKakao({
        query: opts.query,
        region: opts.region,
        maxPages: parseInt(opts.maxPages, 10),
      });
    }
  });

// --- Sync command ---
program
  .command('sync')
  .description('Sync collected data to Supabase')
  .option('-l, --limit <n>', 'Max records to sync', '100')
  .option('--dry-run', 'Preview without syncing')
  .option('-s, --source <source>', 'Only sync from specific source')
  .action(async (opts) => {
    if (!process.env.DATABASE_URL) {
      console.error('Error: DATABASE_URL not set');
      process.exit(1);
    }

    await syncToSupabase({
      limit: parseInt(opts.limit, 10),
      dryRun: opts.dryRun,
      source: opts.source,
    });
  });

// --- Stats command ---
program
  .command('stats')
  .description('Show collection statistics')
  .action(() => {
    const stats = getStats();
    console.log('\n=== Data Collector Stats ===');
    console.log(`Total shops: ${stats.total}`);
    console.log(`Synced: ${stats.synced} | Unsynced: ${stats.unsynced}`);
    console.log(`Articles: ${stats.articles}`);
    console.log('\nBy source:');
    for (const s of stats.bySrc) {
      console.log(`  ${s.source}: ${s.count}`);
    }
    if (stats.recentLogs.length > 0) {
      console.log('\nRecent collection logs:');
      for (const log of stats.recentLogs as Record<string, unknown>[]) {
        console.log(
          `  [${log.completed_at}] ${log.source}: ${log.query} — ${log.records_found} found, ${log.records_new} new`,
        );
      }
    }
    console.log('');
  });

program.parse();
