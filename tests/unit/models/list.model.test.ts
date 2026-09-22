import { describe, test, expect } from "@jest/globals";
import { Types } from "mongoose";
import { ListModel } from "@/models/list.model.js";

describe("ListModel", () => {
    test("requires boardId, title, and order", () => {
        const list = new ListModel({});
        const error = list.validateSync();
        expect(error?.errors.boardId).toBeDefined();
        expect(error?.errors.title).toBeDefined();
        expect(error?.errors.order).toBeDefined();
    });

    test("passes validation with required fields present", () => {
        const list = new ListModel({
            boardId: new Types.ObjectId(),
            title: "To Do",
            order: 1,
        });
        expect(list.validateSync()).toBeUndefined();
    });
});
