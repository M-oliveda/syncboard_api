import "dotenv/config";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "@/config/env.js";
import { connectDb, disconnectDb } from "@/config/db.js";
import { UserModel } from "@/models/user.model.js";

/**
 * Dev-only helper: Phase 1 has no register/login endpoint yet (that's
 * Phase 2), so this is the only way to get a bearer token for exercising
 * protected routes via Swagger UI/Postman.
 *
 * Usage: npx tsx scripts/mint-test-token.ts <email>
 */
const main = async (): Promise<void> => {
    const email = process.argv[2];

    if (!email) {
        console.error("Usage: npx tsx scripts/mint-test-token.ts <email>");
        process.exit(1);
    }

    await connectDb();

    const passwordHash = await bcrypt.hash("dev-only-password", 12);
    const user = await UserModel.findOneAndUpdate(
        { email: email.toLowerCase() },
        { $setOnInsert: { email: email.toLowerCase(), passwordHash } },
        { upsert: true, new: true },
    );

    const token = jwt.sign({ sub: user._id.toString() }, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
    } as jwt.SignOptions);

    console.log(`\nUser:  ${user.email} (${user._id.toString()})`);
    console.log(`Token: ${token}\n`);
    console.log(
        `curl -H "Authorization: Bearer ${token}" http://localhost:4000/api/v1/workspaces`,
    );

    await disconnectDb();
};

main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
});
