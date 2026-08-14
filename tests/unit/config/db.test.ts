import { describe, test, expect, jest } from "@jest/globals";

const mongooseMock = {
    set: jest.fn(),
    connect: jest.fn(async () => mongooseMock),
    disconnect: jest.fn(async () => undefined),
};

jest.unstable_mockModule("mongoose", () => ({ default: mongooseMock }));
jest.unstable_mockModule("@/utils/logger.js", () => ({
    logger: { info: jest.fn(), error: jest.fn() },
}));

const { connectDb, disconnectDb } = await import("@/config/db.js");

describe("connectDb", () => {
    test("sets strictQuery and connects using the configured MONGO_URI", async () => {
        await connectDb();
        expect(mongooseMock.set).toHaveBeenCalledWith("strictQuery", true);
        expect(mongooseMock.connect).toHaveBeenCalledTimes(1);
    });
});

describe("disconnectDb", () => {
    test("disconnects mongoose", async () => {
        await disconnectDb();
        expect(mongooseMock.disconnect).toHaveBeenCalledTimes(1);
    });
});
