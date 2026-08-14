import { env } from "@/config/env.js";
import { logger } from "@/utils/logger.js";

/**
 * Phase 4 (Resend + React Email) replaces this stub's internals with a real
 * send — auth.service.ts's call site and this signature stay stable.
 */
export const sendPasswordResetEmail = async (
    email: string,
    resetUrl: string,
    nodeEnv: string = env.NODE_ENV,
): Promise<void> => {
    if (nodeEnv === "production") {
        return;
    }

    logger.info("Password reset requested (dev/test stub — no email sent)", {
        email,
        resetUrl,
    });
};
