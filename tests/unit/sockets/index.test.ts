import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { mockFn } from "../../helpers/mockFn.js";

const use = jest.fn();
const on = jest.fn();
const adapter = jest.fn();
const ServerCtor = jest.fn(() => ({ use, on, adapter }));

const duplicate = jest.fn(() => ({ id: "sub-client" }));
const RedisCtor = jest.fn(() => ({ duplicate }));

const createAdapter = jest.fn(() => "adapter-instance");

const findById = mockFn();

const registerBoardHandlers = jest.fn();
const registerCardHandlers = jest.fn();

jest.unstable_mockModule("socket.io", () => ({ Server: ServerCtor }));
jest.unstable_mockModule("ioredis", () => ({ Redis: RedisCtor }));
jest.unstable_mockModule("@socket.io/redis-adapter", () => ({ createAdapter }));
jest.unstable_mockModule("@/models/user.model.js", () => ({ UserModel: { findById } }));
jest.unstable_mockModule("@/sockets/handlers/board.handler.js", () => ({
    registerBoardHandlers,
}));
jest.unstable_mockModule("@/sockets/handlers/card.handler.js", () => ({
    registerCardHandlers,
}));

const { createSocketServer } = await import("@/sockets/index.js");
const { env } = await import("@/config/env.js");

type HandshakeMiddleware = (
    socket: { handshake: { auth: { token?: string } }; data: Record<string, unknown> },
    next: (err?: Error) => void,
) => Promise<void>;

const getMiddleware = (): HandshakeMiddleware => {
    createSocketServer({} as never);
    return use.mock.calls[0]?.[0] as HandshakeMiddleware;
};

beforeEach(() => {
    jest.clearAllMocks();
});

describe("createSocketServer", () => {
    test("wires the Redis adapter and registers the connection handler", () => {
        createSocketServer({} as never);

        expect(RedisCtor).toHaveBeenCalledWith(env.REDIS_URL);
        expect(duplicate).toHaveBeenCalled();
        expect(createAdapter).toHaveBeenCalled();
        expect(adapter).toHaveBeenCalledWith("adapter-instance");
        expect(use).toHaveBeenCalledWith(expect.any(Function));
        expect(on).toHaveBeenCalledWith("connection", expect.any(Function));
    });

    test("the connection handler registers the board and card handlers", () => {
        createSocketServer({} as never);
        const connectionHandler = on.mock.calls[0]?.[1] as (socket: unknown) => void;
        const fakeSocket = {};

        connectionHandler(fakeSocket);

        expect(registerBoardHandlers).toHaveBeenCalledWith(
            expect.anything(),
            fakeSocket,
        );
        expect(registerCardHandlers).toHaveBeenCalledWith(
            expect.anything(),
            fakeSocket,
        );
    });
});

describe("handshake auth middleware", () => {
    test("authenticates a valid token and attaches the user to socket.data", async () => {
        const middleware = getMiddleware();
        const userId = new Types.ObjectId();
        const user = { _id: userId, email: "user@test.dev" };
        const token = jwt.sign({ sub: userId.toString() }, env.JWT_SECRET);
        findById.mockResolvedValueOnce(user);
        const socket = {
            handshake: { auth: { token } },
            data: {} as Record<string, unknown>,
        };
        const next = jest.fn();

        await middleware(socket, next);

        expect(findById).toHaveBeenCalledWith(userId.toString());
        expect(socket.data.user).toBe(user);
        expect(next).toHaveBeenCalledWith();
    });

    test("rejects a handshake with no token", async () => {
        const middleware = getMiddleware();
        const socket = { handshake: { auth: {} }, data: {} };
        const next = jest.fn();

        await middleware(socket, next);

        expect(findById).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    test("rejects an invalid/expired token", async () => {
        const middleware = getMiddleware();
        const badToken = jwt.sign(
            { sub: new Types.ObjectId().toString() },
            "wrong-secret",
        );
        const socket = { handshake: { auth: { token: badToken } }, data: {} };
        const next = jest.fn();

        await middleware(socket, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    test("rejects a valid token for a user that no longer exists", async () => {
        const middleware = getMiddleware();
        const token = jwt.sign(
            { sub: new Types.ObjectId().toString() },
            env.JWT_SECRET,
        );
        findById.mockResolvedValueOnce(null);
        const socket = { handshake: { auth: { token } }, data: {} };
        const next = jest.fn();

        await middleware(socket, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
});
