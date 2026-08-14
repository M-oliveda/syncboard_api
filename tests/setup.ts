import { afterAll, afterEach, beforeAll } from "@jest/globals";
import mongoose from "mongoose";
import { env } from "@/config/env.js";

const HOOK_TIMEOUT_MS = 30_000;

beforeAll(async () => {
    await mongoose.connect(env.MONGO_URI);
}, HOOK_TIMEOUT_MS);

afterEach(async () => {
    await Promise.all(
        Object.values(mongoose.connection.collections).map((collection) =>
            collection.deleteMany({}),
        ),
    );
}, HOOK_TIMEOUT_MS);

afterAll(async () => {
    await mongoose.disconnect();
}, HOOK_TIMEOUT_MS);
