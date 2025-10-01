import { z } from "zod";

export const AppEnvironmentSchema = z.enum(["development", "test", "production"]);

export const AppConfigSchema = z.object({
  NODE_ENV: AppEnvironmentSchema.default("development"),
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgres://")),
  REDIS_URL: z.string().url().or(z.string().startsWith("redis://")),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional()
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const parsed = AppConfigSchema.safeParse(env);

  if (!parsed.success) {
    throw new Error(`Invalid configuration: ${parsed.error.message}`);
  }

  return parsed.data;
};

