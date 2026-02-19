/**
 * 경과 시간을 간결하게 표시 (예: 5s, 27m, 1h59m, 2d)
 */
export function formatElapsed(ms: number): string {
  if (ms < 0) return '-';

  const seconds = Math.floor(ms / 1_000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 5) return 'now';
  if (seconds < 60) return `${seconds}s`;
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) {
    const remainMin = minutes % 60;
    return remainMin > 0 ? `${hours}h${remainMin}m` : `${hours}h`;
  }
  return `${days}d`;
}
