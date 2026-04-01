import { analyzeCycle } from "../jobs/cycle";

async function main(): Promise<void> {
  const rawTickers = process.env.TICKERS ?? "AAPL";
  const tickers = rawTickers
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  await analyzeCycle({ tickers });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

