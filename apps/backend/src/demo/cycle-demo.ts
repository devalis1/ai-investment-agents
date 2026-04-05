import { analyzeCycle } from "../jobs/cycle";
import { createServiceClient } from "../supabase/serviceClient";
import { resolveCycleTickers } from "../tickers/resolveCycleTickers";

async function main(): Promise<void> {
  const supabase = createServiceClient();
  const { tickers, source } = await resolveCycleTickers(
    supabase,
    process.env.TICKERS ?? "AAPL"
  );
  // eslint-disable-next-line no-console
  console.log("dev:cycle tickers:", { source, tickers });

  await analyzeCycle({ tickers });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

