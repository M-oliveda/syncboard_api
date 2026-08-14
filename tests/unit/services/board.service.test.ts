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
const getWorkspaceById = mockFn();

jest.unstable_mockModule("@/models/board.model.js", () => ({ BoardModel }));
jest.unstable_mockModule("@/models/list.model.js", () => ({ ListModel }));
jest.unstable_mockModule("@/models/card.model.js", () => ({ CardModel }));
jest.unstable_mockModule("@/services/workspace.service.js", () => ({
    getWorkspaceById,
}));

const boardService = await import("@/services/board.service.js");
const { NotFoundError } = await import("@/utils/errors.js");

const buildBoardDoc = (overrides: Record<string, unknown> = {}) => ({
    _id: new Types.ObjectId(),
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
    test("verifies the workspace exists before creating", async () => {
        const workspaceId = new Types.ObjectId().toString();
        getWorkspaceById.mockResolvedValueOnce({});
        BoardModel.create.mockResolvedValueOnce({});

        await boardService.createBoard(workspaceId, "Q1 Plan");

        expect(getWorkspaceById).toHaveBeenCalledWith(workspaceId);
        expect(BoardModel.create).toHaveBeenCalledWith({
            workspaceId,
            title: "Q1 Plan",
        });
    });
});

describe("listBoardsForWorkspace", () => {
    test("returns paginated boards for the workspace", async () => {
        getWorkspaceById.mockResolvedValueOnce({});
        const items = [buildBoardDoc()];
        BoardModel.find.mockReturnValueOnce(createFakeQuery(items));
        BoardModel.countDocuments.mockResolvedValueOnce(1);

        const result = await boardService.listBoardsForWorkspace(
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

describe("getBoardWithListsAndCards", () => {
    test("returns the board with sorted lists and cards", async () => {
        const doc = buildBoardDoc();
        const listId = new Types.ObjectId();
        BoardModel.findById.mockResolvedValueOnce(doc);
        ListModel.find.mockReturnValueOnce(createFakeQuery([{ _id: listId }]));
        CardModel.find.mockReturnValueOnce(
            createFakeQuery([{ _id: new Types.ObjectId() }]),
        );

        const result = await boardService.getBoardWithListsAndCards(doc._id.toString());

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

        const result = await boardService.updateBoardTitle(
            doc._id.toString(),
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
        ListModel.find.mockReturnValueOnce(createFakeQuery([{ _id: listId }]));
        CardModel.deleteMany.mockResolvedValueOnce({});
        ListModel.deleteMany.mockResolvedValueOnce({});
        BoardModel.deleteOne.mockResolvedValueOnce({});

        await boardService.deleteBoard(boardId);

        expect(CardModel.deleteMany).toHaveBeenCalledWith({
            listId: { $in: [listId] },
        });
        expect(ListModel.deleteMany).toHaveBeenCalledWith({ boardId });
        expect(BoardModel.deleteOne).toHaveBeenCalledWith({ _id: boardId });
    });

    test("throws NotFoundError when the board does not exist", async () => {
        BoardModel.findById.mockResolvedValueOnce(null);
        await expect(boardService.deleteBoard("missing")).rejects.toThrow(
            NotFoundError,
        );
    });
});
