import { describe, test, expect } from "@jest/globals";
import { Types } from "mongoose";
import { WorkspaceModel } from "@/models/workspace.model.js";

describe("WorkspaceModel", () => {
    test("requires a name", () => {
        const workspace = new WorkspaceModel({});
        expect(workspace.validateSync()?.errors.name).toBeDefined();
    });

    test("defaults members to an empty array", () => {
        const workspace = new WorkspaceModel({ name: "Marketing" });
        expect(workspace.members).toHaveLength(0);
    });

    test("defaults a member's role to Member", () => {
        const workspace = new WorkspaceModel({
            name: "Marketing",
            members: [{ userId: new Types.ObjectId() }],
        });
        expect(workspace.members[0]?.role).toBe("Member");
    });

    test("accepts an explicit Admin role", () => {
        const workspace = new WorkspaceModel({
            name: "Marketing",
            members: [{ userId: new Types.ObjectId(), role: "Admin" }],
        });
        expect(workspace.members[0]?.role).toBe("Admin");
    });
});
