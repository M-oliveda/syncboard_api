import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { Types } from "mongoose";
import { mockFn } from "../../helpers/mockFn.js";
import { createFakeQuery } from "../../helpers/mockQuery.js";

const BoardModel = {
    create: mockFn(),
    find: mockFn(),
    countDocuments: mockFn(),
    findById: mockFn(),
    deleteOne: mockFn(),
};
const ListModel = { find: mockFn(), deleteMany: mockFn() };
const CardModel = { find: mockFn(), deleteMany: mockFn() };
const assertWorkspaceAccess = mockFn();

jest.unstable_mockModule("@/models/board.model.js", () => ({ BoardModel }));
jest.unstable_mockModule("@/models/list.model.js", () => ({ ListModel }));
jest.unstable_mockModule("@/models/card.model.js", () => ({ CardModel }));
jest.unstable_mockModule("@/services/workspace.service.js", () => ({
    assertWorkspaceAccess,
}));

const boardService = await import("@/services/board.service.js");
const { ForbiddenError, NotFoundError } = await import("@/utils/errors.js");

const workspaceId = new Types.ObjectId();

const buildBoardDoc = (overrides: Record<string, unknown> = {}) => ({
    _id: new Types.ObjectId(),
    workspaceId,
    title: "Marketing Q1",
    save: jest.fn(async function (this: unknown) {
        return this;
    }),
    ...overrides,
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe("createBoard", () => {
    test("verifies workspace access before creating", async () => {
        const wsId = workspaceId.toString();
        const userId = new Types.ObjectId().toString();
        assertWorkspaceAccess.mockResolvedValueOnce({ workspace: {}, member: {} });
        BoardModel.create.mockResolvedValueOnce({});

        await boardService.createBoard(wsId, userId, "Q1 Plan");

        expect(assertWorkspaceAccess).toHaveBeenCalledWith(wsId, userId);
        expect(BoardModel.create).toHaveBeenCalledWith({
            workspaceId: wsId,
            title: "Q1 Plan",
        });
    });

    test("propagates ForbiddenError for a non-member", async () => {
        assertWorkspaceAccess.mockRejectedValueOnce(new ForbiddenError("nope"));

        await expect(
            boardService.createBoard(
                workspaceId.toString(),
                new Types.ObjectId().toString(),
                "Q1 Plan",
            ),
        ).rejects.toThrow(ForbiddenError);
    });
});

describe("listBoardsForWorkspace", () => {
    test("returns paginated boards for the workspace", async () => {
        assertWorkspaceAccess.mockResolvedValueOnce({ workspace: {}, member: {} });
        const items = [buildBoardDoc()];
        BoardModel.find.mockReturnValueOnce(createFakeQuery(items));
        BoardModel.countDocuments.mockResolvedValueOnce(1);

        const result = await boardService.listBoardsForWorkspace(
            workspaceId.toString(),
            new Types.ObjectId().toString(),
            {},
        );

        expect(result).toEqual({ items, page: 1, limit: 20, total: 1 });
    });
});

describe("getBoardById", () => {
    test("returns the board when found", async () => {
        const doc = buildBoardDoc();
        BoardModel.findById.mockResolvedValueOnce(doc);
        await expect(boardService.getBoardById(doc._id.toString())).resolves.toBe(doc);
    });

    test("throws NotFoundError when missing", async () => {
        BoardModel.findById.mockResolvedValueOnce(null);
        await expect(boardService.getBoardById("missing")).rejects.toThrow(
            NotFoundError,
        );
    });
});

describe("assertBoardAccess", () => {
    test("resolves board + workspace access when the caller has access", async () => {
        const doc = buildBoardDoc();
        const userId = new Types.ObjectId().toString();
        BoardModel.findById.mockResolvedValueOnce(doc);
        assertWorkspaceAccess.mockResolvedValueOnce({
            workspace: { _id: workspaceId },
            member: { role: "Member" },
        });

        const result = await boardService.assertBoardAccess(doc._id.toString(), userId);

        expect(assertWorkspaceAccess).toHaveBeenCalledWith(
            workspaceId.toString(),
            userId,
        );
        expect(result.board).toBe(doc);
    });

    test("propagates ForbiddenError for a non-member", async () => {
        const doc = buildBoardDoc();
        BoardModel.findById.mockResolvedValueOnce(doc);
        assertWorkspaceAccess.mockRejectedValueOnce(new ForbiddenError("nope"));

        await expect(
            boardService.assertBoardAccess(
                doc._id.toString(),
                new Types.ObjectId().toString(),
            ),
        ).rejects.toThrow(ForbiddenError);
    });
});

describe("getBoardWithListsAndCards", () => {
    test("returns the board with sorted lists and cards", async () => {
        const doc = buildBoardDoc();
        const listId = new Types.ObjectId();
        BoardModel.findById.mockResolvedValueOnce(doc);
        assertWorkspaceAccess.mockResolvedValueOnce({ workspace: {}, member: {} });
        ListModel.find.mockReturnValueOnce(createFakeQuery([{ _id: listId }]));
        CardModel.find.mockReturnValueOnce(
            createFakeQuery([{ _id: new Types.ObjectId() }]),
        );

        const result = await boardService.getBoardWithListsAndCards(
            doc._id.toString(),
            new Types.ObjectId().toString(),
        );

        expect(result.board).toBe(doc);
        expect(result.lists).toHaveLength(1);
        expect(result.cards).toHaveLength(1);
        expect(CardModel.find).toHaveBeenCalledWith({ listId: { $in: [listId] } });
    });
});

describe("updateBoardTitle", () => {
    test("updates the title and saves", async () => {
        const doc = buildBoardDoc();
        BoardModel.findById.mockResolvedValueOnce(doc);
        assertWorkspaceAccess.mockResolvedValueOnce({ workspace: {}, member: {} });

        const result = await boardService.updateBoardTitle(
            doc._id.toString(),
            new Types.ObjectId().toString(),
            "New Title",
        );

        expect(result.title).toBe("New Title");
        expect(doc.save).toHaveBeenCalledTimes(1);
    });
});

describe("deleteBoard", () => {
    test("cascades deletes across lists and cards", async () => {
        const doc = buildBoardDoc();
        const boardId = doc._id.toString();
        const listId = new Types.ObjectId();

        BoardModel.findById.mockResolvedValueOnce(doc);
        assertWorkspaceAccess.mockResolvedValueOnce({ workspace: {}, member: {} });
        ListModel.find.mockReturnValueOnce(createFakeQuery([{ _id: listId }]));
        CardModel.deleteMany.mockResolvedValueOnce({});
        ListModel.deleteMany.mockResolvedValueOnce({});
        BoardModel.deleteOne.mockResolvedValueOnce({});

        await boardService.deleteBoard(boardId, new Types.ObjectId().toString());

        expect(CardModel.deleteMany).toHaveBeenCalledWith({
            listId: { $in: [listId] },
        });
        expect(ListModel.deleteMany).toHaveBeenCalledWith({ boardId: doc._id });
        expect(BoardModel.deleteOne).toHaveBeenCalledWith({ _id: doc._id });
    });

    test("throws NotFoundError when the board does not exist", async () => {
        BoardModel.findById.mockResolvedValueOnce(null);
        await expect(
            boardService.deleteBoard("missing", new Types.ObjectId().toString()),
        ).rejects.toThrow(NotFoundError);
    });
});
