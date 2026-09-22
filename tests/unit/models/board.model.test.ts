import { describe, test, expect } from "@jest/globals";
import { Types } from "mongoose";
import { BoardModel } from "@/models/board.model.js";

describe("BoardModel", () => {
    test("requires workspaceId and title", () => {
        const board = new BoardModel({});
        const error = board.validateSync();
        expect(error?.errors.workspaceId).toBeDefined();
        expect(error?.errors.title).toBeDefined();
    });

    test("passes validation with required fields present", () => {
        const board = new BoardModel({
            workspaceId: new Types.ObjectId(),
            title: "Q1 Plan",
        });
        expect(board.validateSync()).toBeUndefined();
    });
});
