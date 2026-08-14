import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { Types } from "mongoose";
import { mockFn } from "../../helpers/mockFn.js";
import { createFakeQuery } from "../../helpers/mockQuery.js";

const CardModel = {
    create: mockFn(),
    find: mockFn(),
    findOne: mockFn(),
    countDocuments: mockFn(),
    findById: mockFn(),
    deleteOne: mockFn(),
};
const assertListAccess = mockFn();

jest.unstable_mockModule("@/models/card.model.js", () => ({ CardModel }));
jest.unstable_mockModule("@/services/list.service.js", () => ({ assertListAccess }));

const cardService = await import("@/services/card.service.js");
const { ForbiddenError, NotFoundError } = await import("@/utils/errors.js");

const buildCardDoc = (overrides: Record<string, unknown> = {}) => ({
    _id: new Types.ObjectId(),
    listId: new Types.ObjectId(),
    title: "Design landing page",
    description: "",
    order: 1,
    assignees: [] as Types.ObjectId[],
    labels: [] as string[],
    checklist: [] as { text: string; done: boolean }[],
    save: jest.fn(async function (this: unknown) {
        return this;
    }),
    ...overrides,
});

const resolveAccess = () =>
    assertListAccess.mockResolvedValueOnce({
        list: {},
        board: {},
        workspace: {},
        member: {},
    });

beforeEach(() => {
    jest.clearAllMocks();
});

describe("createCard", () => {
    test("verifies list access and defaults content fields", async () => {
        const listId = new Types.ObjectId().toString();
        const userId = new Types.ObjectId().toString();
        resolveAccess();
        CardModel.create.mockResolvedValueOnce({});

        await cardService.createCard(listId, userId, { title: "New card", order: 3 });

        expect(assertListAccess).toHaveBeenCalledWith(listId, userId);
        expect(CardModel.create).toHaveBeenCalledWith({
            listId,
            title: "New card",
            description: "",
            order: 3,
            assignees: [],
            labels: [],
            checklist: [],
        });
    });

    test("appends to the end when no order is given", async () => {
        const listId = new Types.ObjectId().toString();
        resolveAccess();
        CardModel.findOne.mockReturnValueOnce(createFakeQuery({ order: 2 }));
        CardModel.create.mockResolvedValueOnce({});

        await cardService.createCard(listId, new Types.ObjectId().toString(), {
            title: "New card",
        });

        expect(CardModel.create).toHaveBeenCalledWith(
            expect.objectContaining({ order: 3 }),
        );
    });

    test("appends as the first card when the list is empty", async () => {
        const listId = new Types.ObjectId().toString();
        resolveAccess();
        CardModel.findOne.mockReturnValueOnce(createFakeQuery(null));
        CardModel.create.mockResolvedValueOnce({});

        await cardService.createCard(listId, new Types.ObjectId().toString(), {
            title: "First card",
        });

        expect(CardModel.create).toHaveBeenCalledWith(
            expect.objectContaining({ order: 1 }),
        );
    });

    test("preserves explicit content fields when provided", async () => {
        const listId = new Types.ObjectId().toString();
        resolveAccess();
        CardModel.create.mockResolvedValueOnce({});
        const assigneeId = new Types.ObjectId().toString();

        await cardService.createCard(listId, new Types.ObjectId().toString(), {
            title: "New card",
            description: "Details",
            order: 1,
            assignees: [assigneeId],
            labels: ["urgent"],
            checklist: [{ text: "Step 1", done: true }],
        });

        expect(CardModel.create).toHaveBeenCalledWith({
            listId,
            title: "New card",
            description: "Details",
            order: 1,
            assignees: [assigneeId],
            labels: ["urgent"],
            checklist: [{ text: "Step 1", done: true }],
        });
    });

    test("propagates ForbiddenError for a non-member", async () => {
        assertListAccess.mockRejectedValueOnce(new ForbiddenError("nope"));

        await expect(
            cardService.createCard(
                new Types.ObjectId().toString(),
                new Types.ObjectId().toString(),
                { title: "New card" },
            ),
        ).rejects.toThrow(ForbiddenError);
    });
});

describe("listCardsForList", () => {
    test("returns paginated cards sorted by order by default", async () => {
        resolveAccess();
        const items = [buildCardDoc()];
        CardModel.find.mockReturnValueOnce(createFakeQuery(items));
        CardModel.countDocuments.mockResolvedValueOnce(1);

        const result = await cardService.listCardsForList(
            new Types.ObjectId().toString(),
            new Types.ObjectId().toString(),
            {},
        );

        expect(result).toEqual({ items, page: 1, limit: 20, total: 1 });
    });
});

describe("getCardById", () => {
    test("returns the card when found", async () => {
        const doc = buildCardDoc();
        CardModel.findById.mockResolvedValueOnce(doc);
        await expect(cardService.getCardById(doc._id.toString())).resolves.toBe(doc);
    });

    test("throws NotFoundError when missing", async () => {
        CardModel.findById.mockResolvedValueOnce(null);
        await expect(cardService.getCardById("missing")).rejects.toThrow(NotFoundError);
    });
});

describe("assertCardAccess", () => {
    test("resolves card + list access when the caller has access", async () => {
        const doc = buildCardDoc();
        const userId = new Types.ObjectId().toString();
        CardModel.findById.mockResolvedValueOnce(doc);
        resolveAccess();

        const result = await cardService.assertCardAccess(doc._id.toString(), userId);

        expect(assertListAccess).toHaveBeenCalledWith(doc.listId.toString(), userId);
        expect(result.card).toBe(doc);
    });

    test("propagates ForbiddenError for a non-member", async () => {
        const doc = buildCardDoc();
        CardModel.findById.mockResolvedValueOnce(doc);
        assertListAccess.mockRejectedValueOnce(new ForbiddenError("nope"));

        await expect(
            cardService.assertCardAccess(
                doc._id.toString(),
                new Types.ObjectId().toString(),
            ),
        ).rejects.toThrow(ForbiddenError);
    });
});

describe("updateCard", () => {
    test("updates content fields in place", async () => {
        const doc = buildCardDoc();
        CardModel.findById.mockResolvedValueOnce(doc);
        resolveAccess();
        const assigneeId = new Types.ObjectId().toString();

        const result = await cardService.updateCard(
            doc._id.toString(),
            new Types.ObjectId().toString(),
            {
                title: "Updated title",
                description: "Updated description",
                assignees: [assigneeId],
                labels: ["bug"],
                checklist: [{ text: "Step 1", done: false }],
            },
        );

        expect(result.title).toBe("Updated title");
        expect(result.description).toBe("Updated description");
        expect(result.assignees).toEqual([new Types.ObjectId(assigneeId)]);
        expect(result.labels).toEqual(["bug"]);
        expect(result.checklist).toEqual([{ text: "Step 1", done: false }]);
        expect(doc.save).toHaveBeenCalledTimes(1);
    });

    test("updates the order in place without moving lists", async () => {
        const doc = buildCardDoc({ order: 1 });
        CardModel.findById.mockResolvedValueOnce(doc);
        resolveAccess();

        const result = await cardService.updateCard(
            doc._id.toString(),
            new Types.ObjectId().toString(),
            { order: 4 },
        );

        expect(result.order).toBe(4);
    });

    test("moves the card to a new list with an explicit order", async () => {
        const doc = buildCardDoc();
        const userId = new Types.ObjectId().toString();
        CardModel.findById.mockResolvedValueOnce(doc);
        resolveAccess();
        const newListId = new Types.ObjectId().toString();
        resolveAccess();

        const result = await cardService.updateCard(doc._id.toString(), userId, {
            listId: newListId,
            order: 2.5,
        });

        expect(assertListAccess).toHaveBeenCalledWith(newListId, userId);
        expect(result.listId).toEqual(new Types.ObjectId(newListId));
        expect(result.order).toBe(2.5);
    });

    test("moves the card to a new list appending to the end when order is omitted", async () => {
        const doc = buildCardDoc();
        CardModel.findById.mockResolvedValueOnce(doc);
        resolveAccess();
        const newListId = new Types.ObjectId().toString();
        resolveAccess();
        CardModel.findOne.mockReturnValueOnce(createFakeQuery({ order: 5 }));

        const result = await cardService.updateCard(
            doc._id.toString(),
            new Types.ObjectId().toString(),
            { listId: newListId },
        );

        expect(result.order).toBe(6);
    });

    test("treats an unchanged listId as a plain order update, not a move", async () => {
        const doc = buildCardDoc();
        CardModel.findById.mockResolvedValueOnce(doc);
        resolveAccess();

        await cardService.updateCard(
            doc._id.toString(),
            new Types.ObjectId().toString(),
            {
                listId: doc.listId.toString(),
                order: 9,
            },
        );

        expect(assertListAccess).toHaveBeenCalledTimes(1);
    });

    test("rejects moving the card into a list the caller cannot access", async () => {
        const doc = buildCardDoc();
        CardModel.findById.mockResolvedValueOnce(doc);
        resolveAccess();
        assertListAccess.mockRejectedValueOnce(new ForbiddenError("nope"));

        await expect(
            cardService.updateCard(
                doc._id.toString(),
                new Types.ObjectId().toString(),
                {
                    listId: new Types.ObjectId().toString(),
                },
            ),
        ).rejects.toThrow(ForbiddenError);
    });
});

describe("deleteCard", () => {
    test("deletes the card", async () => {
        const doc = buildCardDoc();
        const cardId = doc._id.toString();
        CardModel.findById.mockResolvedValueOnce(doc);
        resolveAccess();
        CardModel.deleteOne.mockResolvedValueOnce({});

        await cardService.deleteCard(cardId, new Types.ObjectId().toString());

        expect(CardModel.deleteOne).toHaveBeenCalledWith({ _id: doc._id });
    });

    test("throws NotFoundError when the card does not exist", async () => {
        CardModel.findById.mockResolvedValueOnce(null);
        await expect(
            cardService.deleteCard("missing", new Types.ObjectId().toString()),
        ).rejects.toThrow(NotFoundError);
    });
});
