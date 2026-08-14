import mongoose from "mongoose";
import { env } from "@/config/env.js";
import { logger } from "@/utils/logger.js";

export const connectDb = async (): Promise<typeof mongoose> => {
    mongoose.set("strictQuery", true);
    const connection = await mongoose.connect(env.MONGO_URI);
    logger.info("Connected to MongoDB");
    return connection;
};

export const disconnectDb = async (): Promise<void> => {
    await mongoose.disconnect();
};
