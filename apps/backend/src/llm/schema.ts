import { z } from "zod";

export const AnalystResponseSchema = z.object({
  recommendation: z.enum(["Hold", "Buy", "Sell"]),
  reasoning: z.string().min(1),
});

export type AnalystResponse = z.infer<typeof AnalystResponseSchema>;

