import TelegramBot from "node-telegram-bot-api";

export type TelegramSendInput = {
  ticker: string;
  recommendation: string;
  reasoning: string;
  current_price?: number;
  rsi?: number;
};

function formatMessage(input: TelegramSendInput): string {
  const parts: string[] = [];

  parts.push(`Ticker: ${input.ticker}`);
  parts.push(`Recommendation: ${input.recommendation}`);
  if (typeof input.current_price === "number") parts.push(`Price: ${input.current_price}`);
  if (typeof input.rsi === "number") parts.push(`RSI: ${input.rsi}`);
  parts.push(`Reasoning: ${input.reasoning}`);

  return parts.join("\n");
}

export async function sendTelegramNotification(
  botToken: string,
  chatId: string,
  input: TelegramSendInput
): Promise<void> {
  const bot = new TelegramBot(botToken, { polling: false });
  const message = formatMessage(input);

  // Fire and forget style, but still awaited so errors can be handled by caller.
  await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
}

