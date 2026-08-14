import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { Types } from "mongoose";
import { mockFn } from "../../helpers/mockFn.js";
import { createFakeQuery } from "../../helpers/mockQuery.js";

const ListModel = {
    create: mockFn(),
    find: mockFn(),
    findOne: mockFn(),
    countDocuments: mockFn(),
    findById: mockFn(),
    deleteOne: mockFn(),
};
const CardModel = { deleteMany: mockFn() };
const assertBoardAccess = mockFn();

jest.unstable_mockModule("@/models/list.model.js", () => ({ ListModel }));
jest.unstable_mockModule("@/models/card.model.js", () => ({ CardModel }));
jest.unstable_mockModule("@/services/board.service.js", () => ({ assertBoardAccess }));

const listService = await import("@/services/list.service.js");
const { ForbiddenError, NotFoundError } = await import("@/utils/errors.js");

const boardId = new Types.ObjectId();

const buildListDoc = (overrides: Record<string, unknown> = {}) => ({
    _id: new Types.ObjectId(),
    boardId,
    title: "To Do",
    order: 1,
    save: jest.fn(async function (this: unknown) {
        return this;
    }),
    ...overrides,
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe("createList", () => {
    test("verifies board access and uses an explicit order", async () => {
        const userId = new Types.ObjectId().toString();
        assertBoardAccess.mockResolvedValueOnce({
            board: {},
            workspace: {},
            member: {},
        });
        ListModel.create.mockResolvedValueOnce({});

        await listService.createList(boardId.toString(), userId, "To Do", 2.5);

        expect(assertBoardAccess).toHaveBeenCalledWith(boardId.toString(), userId);
        expect(ListModel.create).toHaveBeenCalledWith({
            boardId: boardId.toString(),
            title: "To Do",
            order: 2.5,
        });
    });

    test("appends to the end when no order is given, on an empty board", async () => {
        assertBoardAccess.mockResolvedValueOnce({
            board: {},
            workspace: {},
            member: {},
        });
        ListModel.findOne.mockReturnValueOnce(createFakeQuery(null));
        ListModel.create.mockResolvedValueOnce({});

        await listService.createList(
            boardId.toString(),
            new Types.ObjectId().toString(),
            "To Do",
        );

        expect(ListModel.create).toHaveBeenCalledWith({
            boardId: boardId.toString(),
            title: "To Do",
            order: 1,
        });
    });

    test("appends after the current max order", async () => {
        assertBoardAccess.mockResolvedValueOnce({
            board: {},
            workspace: {},
            member: {},
        });
        ListModel.findOne.mockReturnValueOnce(createFakeQuery({ order: 3 }));
        ListModel.create.mockResolvedValueOnce({});

        await listService.createList(
            boardId.toString(),
            new Types.ObjectId().toString(),
            "Done",
        );

        expect(ListModel.create).toHaveBeenCalledWith({
            boardId: boardId.toString(),
            title: "Done",
            order: 4,
        });
    });

    test("propagates ForbiddenError for a non-member", async () => {
        assertBoardAccess.mockRejectedValueOnce(new ForbiddenError("nope"));

        await expect(
            listService.createList(
                boardId.toString(),
                new Types.ObjectId().toString(),
                "To Do",
            ),
        ).rejects.toThrow(ForbiddenError);
    });
});

describe("listListsForBoard", () => {
    test("returns paginated lists sorted by order by default", async () => {
        assertBoardAccess.mockResolvedValueOnce({
            board: {},
            workspace: {},
            member: {},
        });
        const items = [buildListDoc()];
        ListModel.find.mockReturnValueOnce(createFakeQuery(items));
        ListModel.countDocuments.mockResolvedValueOnce(1);

        const result = await listService.listListsForBoard(
            boardId.toString(),
            new Types.ObjectId().toString(),
            {},
        );

        expect(result).toEqual({ items, page: 1, limit: 20, total: 1 });
    });
});

describe("getListById", () => {
    test("returns the list when found", async () => {
        const doc = buildListDoc();
        ListModel.findById.mockResolvedValueOnce(doc);
        await expect(listService.getListById(doc._id.toString())).resolves.toBe(doc);
    });

    test("throws NotFoundError when missing", async () => {
        ListModel.findById.mockResolvedValueOnce(null);
        await expect(listService.getListById("missing")).rejects.toThrow(NotFoundError);
    });
});

describe("assertListAccess", () => {
    test("resolves list + board access when the caller has access", async () => {
        const doc = buildListDoc();
        const userId = new Types.ObjectId().toString();
        ListModel.findById.mockResolvedValueOnce(doc);
        assertBoardAccess.mockResolvedValueOnce({
            board: { _id: boardId },
            workspace: {},
            member: { role: "Member" },
        });

        const result = await listService.assertListAccess(doc._id.toString(), userId);

        expect(assertBoardAccess).toHaveBeenCalledWith(boardId.toString(), userId);
        expect(result.list).toBe(doc);
    });

    test("propagates ForbiddenError for a non-member", async () => {
        const doc = buildListDoc();
        ListModel.findById.mockResolvedValueOnce(doc);
        assertBoardAccess.mockRejectedValueOnce(new ForbiddenError("nope"));

        await expect(
            listService.assertListAccess(
                doc._id.toString(),
                new Types.ObjectId().toString(),
            ),
        ).rejects.toThrow(ForbiddenError);
    });
});

describe("updateList", () => {
    test("updates only the title when order is omitted", async () => {
        const doc = buildListDoc();
        ListModel.findById.mockResolvedValueOnce(doc);
        assertBoardAccess.mockResolvedValueOnce({
            board: {},
            workspace: {},
            member: {},
        });

        const result = await listService.updateList(
            doc._id.toString(),
            new Types.ObjectId().toString(),
            { title: "Doing" },
        );

        expect(result.title).toBe("Doing");
        expect(result.order).toBe(1);
    });

    test("updates only the order when title is omitted", async () => {
        const doc = buildListDoc();
        ListModel.findById.mockResolvedValueOnce(doc);
        assertBoardAccess.mockResolvedValueOnce({
            board: {},
            workspace: {},
            member: {},
        });

        const result = await listService.updateList(
            doc._id.toString(),
            new Types.ObjectId().toString(),
            { order: 5 },
        );

        expect(result.order).toBe(5);
        expect(result.title).toBe("To Do");
    });
});

describe("deleteList", () => {
    test("cascades delete to cards", async () => {
        const doc = buildListDoc();
        const listId = doc._id.toString();
        ListModel.findById.mockResolvedValueOnce(doc);
        assertBoardAccess.mockResolvedValueOnce({
            board: {},
            workspace: {},
            member: {},
        });
        CardModel.deleteMany.mockResolvedValueOnce({});
        ListModel.deleteOne.mockResolvedValueOnce({});

        await listService.deleteList(listId, new Types.ObjectId().toString());

        expect(CardModel.deleteMany).toHaveBeenCalledWith({ listId: doc._id });
        expect(ListModel.deleteOne).toHaveBeenCalledWith({ _id: doc._id });
    });

    test("throws NotFoundError when the list does not exist", async () => {
        ListModel.findById.mockResolvedValueOnce(null);
        await expect(
            listService.deleteList("missing", new Types.ObjectId().toString()),
        ).rejects.toThrow(NotFoundError);
    });
});
