import { describe, test, expect } from "@jest/globals";
import type { Request } from "express";
import { Types } from "mongoose";
import { currentUserId } from "@/utils/currentUser.js";
import { UnauthenticatedError } from "@/utils/errors.js";

describe("currentUserId", () => {
    test("returns the authenticated user's id", () => {
        const userId = new Types.ObjectId();
        const req = { user: { _id: userId } } as unknown as Request;
        expect(currentUserId(req)).toBe(userId.toString());
    });

    test("throws UnauthenticatedError when req.user is missing", () => {
        const req = {} as Request;
        expect(() => currentUserId(req)).toThrow(UnauthenticatedError);
    });
});
