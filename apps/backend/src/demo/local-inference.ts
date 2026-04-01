import { inferAnalyst } from "../llm/inferencer";

async function main(): Promise<void> {
  const result = await inferAnalyst({
    ticker: "AAPL",
    price_current: 190.12,
    rsi: 55.3,
    headlines: [
      "The company reports mixed results and the market reacts cautiously.",
      "Rumors about upcoming product announcements increase volatility.",
    ],
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

