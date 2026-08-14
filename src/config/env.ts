import { z } from "zod";

const EnvSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    MONGO_URI: z.string().min(1, "MONGO_URI is required"),
    JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
    JWT_EXPIRES_IN: z.string().default("15m"),
    CORS_ORIGIN: z.string().default("http://localhost:5173"),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
    LOG_LEVEL: z.string().default("info"),
});

export type Env = z.infer<typeof EnvSchema>;

const parseEnv = (): Env => {
    const result = EnvSchema.safeParse(process.env);

    if (!result.success) {
        const details = result.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join(", ");
        throw new Error(`Invalid environment configuration: ${details}`);
    }

    return result.data;
};

export const env = parseEnv();
