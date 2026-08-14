import { describe, test, expect } from "@jest/globals";
import { Types } from "mongoose";
import { CardModel } from "@/models/card.model.js";

describe("CardModel", () => {
    test("requires listId, title, and order", () => {
        const card = new CardModel({});
        const error = card.validateSync();
        expect(error?.errors.listId).toBeDefined();
        expect(error?.errors.title).toBeDefined();
        expect(error?.errors.order).toBeDefined();
    });

    test("defaults description, assignees, labels, and checklist", () => {
        const card = new CardModel({
            listId: new Types.ObjectId(),
            title: "Design landing page",
            order: 1,
        });
        expect(card.description).toBe("");
        expect(card.assignees).toHaveLength(0);
        expect(card.labels).toHaveLength(0);
        expect(card.checklist).toHaveLength(0);
    });

    test("defaults a checklist item's done flag to false", () => {
        const card = new CardModel({
            listId: new Types.ObjectId(),
            title: "Design landing page",
            order: 1,
            checklist: [{ text: "Draft wireframe" }],
        });
        expect(card.checklist[0]?.done).toBe(false);
    });
});
