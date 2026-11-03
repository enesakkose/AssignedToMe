import { z } from "zod";

const envSchema = z.object({
  apiUrl: z.string().url().default("https://example.com"),
});

const parsed = envSchema.safeParse({
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
});

if (!parsed.success) {
  const errors = Object.entries(parsed.error.flatten().fieldErrors)
    .map(([key, messages]) => `${key}: ${messages?.join(", ")}`)
    .join("\n");
  console.error("Invalid environment variables:\n", errors);
  throw new Error(`Invalid environment variables:\n${errors}`);
}

export const env = parsed.data;
