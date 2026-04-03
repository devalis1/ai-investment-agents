const REC_CLASS: Record<string, string> = {
  BUY: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100',
  SELL: 'border-rose-500/35 bg-rose-500/10 text-rose-900 dark:text-rose-100',
  HOLD: 'border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100',
};

function bucketFor(value: string): string {
  const u = value.trim().toUpperCase();
  if (u.includes('BUY')) return 'BUY';
  if (u.includes('SELL')) return 'SELL';
  if (u.includes('HOLD')) return 'HOLD';
  return 'OTHER';
}

export function RecommendationBadge({ value }: { value: string }) {
  const bucket = bucketFor(value);
  const cls =
    REC_CLASS[bucket] ??
    'border-border bg-muted text-foreground dark:text-foreground';

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {value}
    </span>
  );
}
