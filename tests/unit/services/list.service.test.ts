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
const getBoardById = mockFn();

jest.unstable_mockModule("@/models/list.model.js", () => ({ ListModel }));
jest.unstable_mockModule("@/models/card.model.js", () => ({ CardModel }));
jest.unstable_mockModule("@/services/board.service.js", () => ({ getBoardById }));

const listService = await import("@/services/list.service.js");
const { NotFoundError } = await import("@/utils/errors.js");

const buildListDoc = (overrides: Record<string, unknown> = {}) => ({
    _id: new Types.ObjectId(),
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
    test("verifies the board exists and uses an explicit order", async () => {
        const boardId = new Types.ObjectId().toString();
        getBoardById.mockResolvedValueOnce({});
        ListModel.create.mockResolvedValueOnce({});

        await listService.createList(boardId, "To Do", 2.5);

        expect(getBoardById).toHaveBeenCalledWith(boardId);
        expect(ListModel.create).toHaveBeenCalledWith({
            boardId,
            title: "To Do",
            order: 2.5,
        });
    });

    test("appends to the end when no order is given, on an empty board", async () => {
        const boardId = new Types.ObjectId().toString();
        getBoardById.mockResolvedValueOnce({});
        ListModel.findOne.mockReturnValueOnce(createFakeQuery(null));
        ListModel.create.mockResolvedValueOnce({});

        await listService.createList(boardId, "To Do");

        expect(ListModel.create).toHaveBeenCalledWith({
            boardId,
            title: "To Do",
            order: 1,
        });
    });

    test("appends after the current max order", async () => {
        const boardId = new Types.ObjectId().toString();
        getBoardById.mockResolvedValueOnce({});
        ListModel.findOne.mockReturnValueOnce(createFakeQuery({ order: 3 }));
        ListModel.create.mockResolvedValueOnce({});

        await listService.createList(boardId, "Done");

        expect(ListModel.create).toHaveBeenCalledWith({
            boardId,
            title: "Done",
            order: 4,
        });
    });
});

describe("listListsForBoard", () => {
    test("returns paginated lists sorted by order by default", async () => {
        getBoardById.mockResolvedValueOnce({});
        const items = [buildListDoc()];
        ListModel.find.mockReturnValueOnce(createFakeQuery(items));
        ListModel.countDocuments.mockResolvedValueOnce(1);

        const result = await listService.listListsForBoard(
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

describe("updateList", () => {
    test("updates only the title when order is omitted", async () => {
        const doc = buildListDoc();
        ListModel.findById.mockResolvedValueOnce(doc);

        const result = await listService.updateList(doc._id.toString(), {
            title: "Doing",
        });

        expect(result.title).toBe("Doing");
        expect(result.order).toBe(1);
    });

    test("updates only the order when title is omitted", async () => {
        const doc = buildListDoc();
        ListModel.findById.mockResolvedValueOnce(doc);

        const result = await listService.updateList(doc._id.toString(), { order: 5 });

        expect(result.order).toBe(5);
        expect(result.title).toBe("To Do");
    });
});

describe("deleteList", () => {
    test("cascades delete to cards", async () => {
        const doc = buildListDoc();
        const listId = doc._id.toString();
        ListModel.findById.mockResolvedValueOnce(doc);
        CardModel.deleteMany.mockResolvedValueOnce({});
        ListModel.deleteOne.mockResolvedValueOnce({});

        await listService.deleteList(listId);

        expect(CardModel.deleteMany).toHaveBeenCalledWith({ listId });
        expect(ListModel.deleteOne).toHaveBeenCalledWith({ _id: listId });
    });

    test("throws NotFoundError when the list does not exist", async () => {
        ListModel.findById.mockResolvedValueOnce(null);
        await expect(listService.deleteList("missing")).rejects.toThrow(NotFoundError);
    });
});
