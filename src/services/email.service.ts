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
    await resend.emails.send({
        from: env.EMAIL_FROM,
        to,
        subject: "Reset your SyncBoard password",
        html,
    });
};

export const sendWelcomeEmail = async (to: string): Promise<void> => {
    const html = await render(WelcomeEmail({ email: to }));
    await resend.emails.send({
        from: env.EMAIL_FROM,
        to,
        subject: "Welcome to SyncBoard",
        html,
    });
};
