import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "@/config/env.js";
import { UserModel } from "@/models/user.model.js";

export const createAuthenticatedUser = async (email?: string) => {
    const passwordHash = await bcrypt.hash("test-password", 4);
    const user = await UserModel.create({
        email: email ?? `user-${new Date().getTime()}-${Math.random()}@test.dev`,
        passwordHash,
    });

    const token = jwt.sign({ sub: user._id.toString() }, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
    } as jwt.SignOptions);

    return { user, token };
};
