import { z } from "zod";

const PasswordPolicySchema = z
    .string()
    .min(8)
    .max(72) // bcrypt only hashes the first 72 bytes — reject longer input outright
    .regex(/(?=.*[A-Za-z])(?=.*\d)/, "Password must contain a letter and a number");

export const RegisterSchema = z.object({
    email: z.string().trim().toLowerCase().email(),
    password: PasswordPolicySchema,
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const ForgotPasswordSchema = z.object({
    email: z.string().trim().toLowerCase().email(),
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
    token: z.string().min(1),
    newPassword: PasswordPolicySchema,
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
