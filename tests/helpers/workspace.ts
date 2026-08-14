import type { Express } from "express";
import request from "supertest";
import { createAuthenticatedUser } from "./auth.js";

/**
 * Creates two users, has the first (Admin) create a workspace and add the
 * second at the given role, via the real HTTP endpoints — a convenience
 * wrapper over already-RBAC'd routes, not a bypass.
 */
export const createWorkspaceWithMember = async (
    app: Express,
    memberRole: "Admin" | "Member" = "Member",
) => {
    const { token: ownerToken, user: ownerUser } = await createAuthenticatedUser();
    const { token: memberToken, user: memberUser } = await createAuthenticatedUser();

    const workspace = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "Test Workspace" })
        .expect(201);

    await request(app)
        .post(`/api/v1/workspaces/${workspace.body.data._id as string}/members`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ userId: memberUser._id.toString(), role: memberRole })
        .expect(201);

    return {
        ownerToken,
        ownerUser,
        memberToken,
        memberUser,
        workspaceId: workspace.body.data._id as string,
    };
};
