import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { Types } from "mongoose";
import { mockFn } from "../../../helpers/mockFn.js";

const updateCard = mockFn();
const getListById = mockFn();

jest.unstable_mockModule("@/services/card.service.js", () => ({ updateCard }));
jest.unstable_mockModule("@/services/list.service.js", () => ({ getListById }));

const { registerCardHandlers } = await import("@/sockets/handlers/card.handler.js");
const { ForbiddenError } = await import("@/utils/errors.js");

type Handler = (...args: unknown[]) => unknown;

const buildSocket = (userId = new Types.ObjectId()) => {
    const handlers = new Map<string, Handler>();
    const socket = {
        data: { user: { _id: userId, email: "user@test.dev" } },
        on: jest.fn((event: string, handler: Handler) => {
            handlers.set(event, handler);
        }),
        emit: jest.fn(),
    };
    return { socket, handlers };
};

const buildIo = () => {
    const toEmit = jest.fn();
    const io = { to: jest.fn(() => ({ emit: toEmit })) };
    return { io, toEmit };
};

beforeEach(() => {
    jest.clearAllMocks();
});

describe("card:moved", () => {
    test("persists the move and broadcasts card:updated to the resolved board room", async () => {
        const userId = new Types.ObjectId();
        const { socket, handlers } = buildSocket(userId);
        const { io, toEmit } = buildIo();
        const cardId = new Types.ObjectId().toString();
        const targetListId = new Types.ObjectId().toString();
        const boardId = new Types.ObjectId();
        const card = { _id: cardId, listId: targetListId, order: 1.5 };
        updateCard.mockResolvedValueOnce(card);
        getListById.mockResolvedValueOnce({ boardId });

        registerCardHandlers(io as never, socket as never);
        await handlers.get("card:moved")?.({ cardId, targetListId, newOrder: 1.5 });

        expect(updateCard).toHaveBeenCalledWith(cardId, userId.toString(), {
            listId: targetListId,
            order: 1.5,
        });
        expect(getListById).toHaveBeenCalledWith(targetListId);
        expect(io.to).toHaveBeenCalledWith(`board:${boardId.toString()}`);
        expect(toEmit).toHaveBeenCalledWith("card:updated", card);
    });

    test("emits an error and never persists for an invalid payload", async () => {
        const { socket, handlers } = buildSocket();
        const { io } = buildIo();

        registerCardHandlers(io as never, socket as never);
        await handlers.get("card:moved")?.({ cardId: "not-an-id" });

        expect(updateCard).not.toHaveBeenCalled();
        expect(socket.emit).toHaveBeenCalledWith(
            "error",
            expect.objectContaining({ status: 400 }),
        );
    });

    test("emits an error and never broadcasts when the caller lacks access", async () => {
        const { socket, handlers } = buildSocket();
        const { io } = buildIo();
        updateCard.mockRejectedValueOnce(new ForbiddenError("nope"));

        registerCardHandlers(io as never, socket as never);
        await handlers.get("card:moved")?.({
            cardId: new Types.ObjectId().toString(),
            targetListId: new Types.ObjectId().toString(),
            newOrder: 1,
        });

        expect(getListById).not.toHaveBeenCalled();
        expect(io.to).not.toHaveBeenCalled();
        expect(socket.emit).toHaveBeenCalledWith(
            "error",
            expect.objectContaining({ status: 403 }),
        );
    });
});
