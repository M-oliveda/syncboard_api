import { render } from "@react-email/render";
import { Resend } from "resend";
import { env } from "@/config/env.js";
import { PasswordResetEmail } from "@/emails/PasswordResetEmail.js";
import { WelcomeEmail } from "@/emails/WelcomeEmail.js";

const resend = new Resend(env.RESEND_API_KEY);

export const sendPasswordResetEmail = async (
    to: string,
    resetUrl: string,
): Promise<void> => {
    const html = await render(PasswordResetEmail({ resetUrl }));
    const { error } = await resend.emails.send({
        from: env.EMAIL_FROM,
        to,
        subject: "Reset your SyncBoard password",
        html,
    });

    if (error) {
        throw new Error(`Failed to send password reset email: ${error.message}`);
    }
};

export const sendWelcomeEmail = async (to: string): Promise<void> => {
    const html = await render(WelcomeEmail({ email: to }));
    const { error } = await resend.emails.send({
        from: env.EMAIL_FROM,
        to,
        subject: "Welcome to SyncBoard",
        html,
    });

    if (error) {
        throw new Error(`Failed to send welcome email: ${error.message}`);
    }
};
