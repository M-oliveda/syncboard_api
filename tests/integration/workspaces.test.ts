import { describe, test, expect } from "@jest/globals";
import request from "supertest";
import { app } from "@/app.js";
import { createAuthenticatedUser } from "../helpers/auth.js";
import { createWorkspaceWithMember } from "../helpers/workspace.js";

describe("Workspaces", () => {
    test("rejects requests without a bearer token", async () => {
        await request(app).get("/api/v1/workspaces").expect(401);
    });

    test("returns RFC 7807 404 for an unmatched route", async () => {
        const response = await request(app).get("/api/v1/does-not-exist").expect(404);
        expect(response.body.type).toBe("https://syncboard.dev/errors/not-found");
    });

    test("rejects a request body that fails validation", async () => {
        const { token } = await createAuthenticatedUser();

        const response = await request(app)
            .post("/api/v1/workspaces")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "" })
            .expect(400);

        expect(response.body.type).toBe(
            "https://syncboard.dev/errors/validation-error",
        );
    });

    test("creates a workspace with the creator as the first Admin member", async () => {
        const { token, user } = await createAuthenticatedUser();

        const response = await request(app)
            .post("/api/v1/workspaces")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Marketing" })
            .expect(201);

        expect(response.body.data.name).toBe("Marketing");
        expect(response.body.data.members).toEqual([
            { userId: user._id.toString(), role: "Admin" },
        ]);
    });

    test("lists only the current user's workspaces", async () => {
        const { token } = await createAuthenticatedUser();
        const { token: otherToken } = await createAuthenticatedUser();

        await request(app)
            .post("/api/v1/workspaces")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Mine" })
            .expect(201);
        await request(app)
            .post("/api/v1/workspaces")
            .set("Authorization", `Bearer ${otherToken}`)
            .send({ name: "Not mine" })
            .expect(201);

        const response = await request(app)
            .get("/api/v1/workspaces")
            .set("Authorization", `Bearer ${token}`)
            .expect(200);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].name).toBe("Mine");
        expect(response.body.pagination).toEqual({
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
        });
    });

    test("gets a single workspace by id", async () => {
        const { token } = await createAuthenticatedUser();
        const created = await request(app)
            .post("/api/v1/workspaces")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Marketing" });

        const response = await request(app)
            .get(`/api/v1/workspaces/${created.body.data._id}`)
            .set("Authorization", `Bearer ${token}`)
            .expect(200);

        expect(response.body.data.name).toBe("Marketing");
    });

    test("returns 404 for a workspace that does not exist", async () => {
        const { token } = await createAuthenticatedUser();
        const missingId = "507f1f77bcf86cd799439011";

        const response = await request(app)
            .get(`/api/v1/workspaces/${missingId}`)
            .set("Authorization", `Bearer ${token}`)
            .expect(404);

        expect(response.body.type).toBe("https://syncboard.dev/errors/not-found");
    });

    test("returns 400 for a malformed workspace id", async () => {
        const { token } = await createAuthenticatedUser();

        await request(app)
            .get("/api/v1/workspaces/not-an-id")
            .set("Authorization", `Bearer ${token}`)
            .expect(400);
    });

    test("updates a workspace's name", async () => {
        const { token } = await createAuthenticatedUser();
        const created = await request(app)
            .post("/api/v1/workspaces")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "Old Name" });

        const response = await request(app)
            .patch(`/api/v1/workspaces/${created.body.data._id}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "New Name" })
            .expect(200);

        expect(response.body.data.name).toBe("New Name");
    });

    describe("members", () => {
        test("adds, updates, and removes a member", async () => {
            const { token } = await createAuthenticatedUser();
            const { user: otherUser } = await createAuthenticatedUser();
            const created = await request(app)
                .post("/api/v1/workspaces")
                .set("Authorization", `Bearer ${token}`)
                .send({ name: "Team" });
            const workspaceId = created.body.data._id as string;

            const added = await request(app)
                .post(`/api/v1/workspaces/${workspaceId}/members`)
                .set("Authorization", `Bearer ${token}`)
                .send({ userId: otherUser._id.toString() })
                .expect(201);
            expect(added.body.data.members).toHaveLength(2);

            await request(app)
                .post(`/api/v1/workspaces/${workspaceId}/members`)
                .set("Authorization", `Bearer ${token}`)
                .send({ userId: otherUser._id.toString() })
                .expect(409);

            const updated = await request(app)
                .patch(
                    `/api/v1/workspaces/${workspaceId}/members/${otherUser._id.toString()}`,
                )
                .set("Authorization", `Bearer ${token}`)
                .send({ role: "Admin" })
                .expect(200);
            const member = updated.body.data.members.find(
                (m: { userId: { _id: string; email: string } }) =>
                    m.userId._id === otherUser._id.toString(),
            );
            expect(member.role).toBe("Admin");
            expect(member.userId.email).toBe(otherUser.email);

            const removed = await request(app)
                .delete(
                    `/api/v1/workspaces/${workspaceId}/members/${otherUser._id.toString()}`,
                )
                .set("Authorization", `Bearer ${token}`)
                .expect(200);
            expect(removed.body.data.members).toHaveLength(1);

            await request(app)
                .delete(
                    `/api/v1/workspaces/${workspaceId}/members/${otherUser._id.toString()}`,
                )
                .set("Authorization", `Bearer ${token}`)
                .expect(404);
        });
    });

    test("deletes a workspace and cascades to its boards/lists/cards", async () => {
        const { token } = await createAuthenticatedUser();
        const created = await request(app)
            .post("/api/v1/workspaces")
            .set("Authorization", `Bearer ${token}`)
            .send({ name: "To Delete" });
        const workspaceId = created.body.data._id as string;

        const board = await request(app)
            .post(`/api/v1/workspaces/${workspaceId}/boards`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Board" });
        const list = await request(app)
            .post(`/api/v1/boards/${board.body.data._id}/lists`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "List" });
        const card = await request(app)
            .post(`/api/v1/lists/${list.body.data._id}/cards`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Card" });

        await request(app)
            .delete(`/api/v1/workspaces/${workspaceId}`)
            .set("Authorization", `Bearer ${token}`)
            .expect(204);

        await request(app)
            .get(`/api/v1/boards/${board.body.data._id}`)
            .set("Authorization", `Bearer ${token}`)
            .expect(404);
        await request(app)
            .get(`/api/v1/lists/${list.body.data._id}`)
            .set("Authorization", `Bearer ${token}`)
            .expect(404);
        await request(app)
            .get(`/api/v1/cards/${card.body.data._id}`)
            .set("Authorization", `Bearer ${token}`)
            .expect(404);
    });

    describe("RBAC", () => {
        test("rejects a non-member reading a workspace", async () => {
            const { ownerToken } = await createWorkspaceWithMember(app);
            const created = await request(app)
                .post("/api/v1/workspaces")
                .set("Authorization", `Bearer ${ownerToken}`)
                .send({ name: "Private" });
            const { token: strangerToken } = await createAuthenticatedUser();

            const response = await request(app)
                .get(`/api/v1/workspaces/${created.body.data._id}`)
                .set("Authorization", `Bearer ${strangerToken}`)
                .expect(403);

            expect(response.body.type).toBe("https://syncboard.dev/errors/forbidden");
        });

        test("rejects a Member (non-Admin) renaming or deleting the workspace", async () => {
            const { memberToken, workspaceId } = await createWorkspaceWithMember(
                app,
                "Member",
            );

            await request(app)
                .patch(`/api/v1/workspaces/${workspaceId}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ name: "Renamed" })
                .expect(403);

            await request(app)
                .delete(`/api/v1/workspaces/${workspaceId}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .expect(403);
        });

        test("rejects a Member (non-Admin) managing members", async () => {
            const { memberToken, workspaceId } = await createWorkspaceWithMember(
                app,
                "Member",
            );
            const { user: someoneElse } = await createAuthenticatedUser();

            await request(app)
                .post(`/api/v1/workspaces/${workspaceId}/members`)
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ userId: someoneElse._id.toString() })
                .expect(403);

            await request(app)
                .patch(
                    `/api/v1/workspaces/${workspaceId}/members/${someoneElse._id.toString()}`,
                )
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ role: "Admin" })
                .expect(403);

            await request(app)
                .delete(
                    `/api/v1/workspaces/${workspaceId}/members/${someoneElse._id.toString()}`,
                )
                .set("Authorization", `Bearer ${memberToken}`)
                .expect(403);
        });

        test("allows a Member (non-Admin) to read the workspace", async () => {
            const { memberToken, workspaceId } = await createWorkspaceWithMember(
                app,
                "Member",
            );

            await request(app)
                .get(`/api/v1/workspaces/${workspaceId}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .expect(200);
        });
    });
});
