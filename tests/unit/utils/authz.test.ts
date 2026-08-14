import { describe, test, expect } from "@jest/globals";
import { Types } from "mongoose";
import { requireWorkspaceAdmin, requireWorkspaceMembership } from "@/utils/authz.js";
import { ForbiddenError } from "@/utils/errors.js";

const buildWorkspace = (
    members: { userId: Types.ObjectId; role: "Admin" | "Member" }[],
) => ({ _id: new Types.ObjectId(), members });

describe("requireWorkspaceMembership", () => {
    test("returns the member when the user is a member", () => {
        const userId = new Types.ObjectId();
        const workspace = buildWorkspace([{ userId, role: "Member" }]);

        expect(requireWorkspaceMembership(workspace, userId.toString())).toEqual({
            userId,
            role: "Member",
        });
    });

    test("throws ForbiddenError when the user is not a member", () => {
        const workspace = buildWorkspace([]);

        expect(() =>
            requireWorkspaceMembership(workspace, new Types.ObjectId().toString()),
        ).toThrow(ForbiddenError);
    });
});

describe("requireWorkspaceAdmin", () => {
    test("returns the member when the user is an Admin", () => {
        const userId = new Types.ObjectId();
        const workspace = buildWorkspace([{ userId, role: "Admin" }]);

        expect(requireWorkspaceAdmin(workspace, userId.toString())).toEqual({
            userId,
            role: "Admin",
        });
    });

    test("throws ForbiddenError when the user is a Member, not an Admin", () => {
        const userId = new Types.ObjectId();
        const workspace = buildWorkspace([{ userId, role: "Member" }]);

        expect(() => requireWorkspaceAdmin(workspace, userId.toString())).toThrow(
            ForbiddenError,
        );
    });

    test("throws ForbiddenError when the user is not a member at all", () => {
        const workspace = buildWorkspace([]);

        expect(() =>
            requireWorkspaceAdmin(workspace, new Types.ObjectId().toString()),
        ).toThrow(ForbiddenError);
    });
});
