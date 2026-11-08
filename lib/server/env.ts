import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  USDA_API_KEY: z.string().min(1, "USDA_API_KEY is required"),
});

export function getServerEnv() {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    return {
      USDA_API_KEY: process.env.USDA_API_KEY || "",
    };
  }
  return parsed.data;
}
