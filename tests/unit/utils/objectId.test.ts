import { describe, test, expect } from "@jest/globals";
import { Types } from "mongoose";
import { objectIdString } from "@/utils/objectId.js";

describe("objectIdString", () => {
    test("accepts a valid ObjectId string", () => {
        const id = new Types.ObjectId().toString();
        expect(objectIdString.safeParse(id).success).toBe(true);
    });

    test("rejects an invalid id", () => {
        expect(objectIdString.safeParse("not-an-id").success).toBe(false);
    });
});
