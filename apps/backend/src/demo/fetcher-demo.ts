import { runFetcher } from "../fetcher/run";

async function main(): Promise<void> {
  const results = await runFetcher([
    { ticker: "AAPL" },
    { ticker: "MSFT" },
    // Example Argentina ticker:
    // { ticker: "ALUA.BA" },
  ]);

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

