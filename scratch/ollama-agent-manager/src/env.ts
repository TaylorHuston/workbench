import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_PATH: z.string().default("./data/dev.db"),
    OLLAMA_HOST: z.string().url().default("http://localhost:11434"),
    OPENROUTER_API_KEY: z.string().optional(),
  },
  runtimeEnv: {
    DATABASE_PATH: process.env.DATABASE_PATH,
    OLLAMA_HOST: process.env.OLLAMA_HOST,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  },
});