import { describe, test, expect } from "@jest/globals";
import request from "supertest";
import { app } from "@/app.js";
import { createAuthenticatedUser } from "../helpers/auth.js";
import { createWorkspaceWithMember } from "../helpers/workspace.js";

const createWorkspace = async (token: string, name = "Workspace") => {
    const response = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${token}`)
        .send({ name })
        .expect(201);
    return response.body.data._id as string;
};

describe("Boards", () => {
    test("returns 404 when the parent workspace does not exist", async () => {
        const { token } = await createAuthenticatedUser();

        await request(app)
            .post("/api/v1/workspaces/507f1f77bcf86cd799439011/boards")
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Board" })
            .expect(404);
    });

    test("creates and lists boards for a workspace", async () => {
        const { token } = await createAuthenticatedUser();
        const workspaceId = await createWorkspace(token);

        await request(app)
            .post(`/api/v1/workspaces/${workspaceId}/boards`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Board One" })
            .expect(201);

        const response = await request(app)
            .get(`/api/v1/workspaces/${workspaceId}/boards`)
            .set("Authorization", `Bearer ${token}`)
            .expect(200);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].title).toBe("Board One");
    });

    test("returns the full board state with lists and cards sorted by order", async () => {
        const { token } = await createAuthenticatedUser();
        const workspaceId = await createWorkspace(token);
        const board = await request(app)
            .post(`/api/v1/workspaces/${workspaceId}/boards`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Board" });
        const boardId = board.body.data._id as string;

        await request(app)
            .post(`/api/v1/boards/${boardId}/lists`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Second", order: 2 });
        const listA = await request(app)
            .post(`/api/v1/boards/${boardId}/lists`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "First", order: 1 });
        await request(app)
            .post(`/api/v1/lists/${listA.body.data._id}/cards`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Card A", order: 1 });

        const response = await request(app)
            .get(`/api/v1/boards/${boardId}`)
            .set("Authorization", `Bearer ${token}`)
            .expect(200);

        expect(response.body.data.board._id).toBe(boardId);
        expect(response.body.data.lists.map((l: { title: string }) => l.title)).toEqual(
            ["First", "Second"],
        );
        expect(response.body.data.cards).toHaveLength(1);
    });

    test("updates a board's title", async () => {
        const { token } = await createAuthenticatedUser();
        const workspaceId = await createWorkspace(token);
        const board = await request(app)
            .post(`/api/v1/workspaces/${workspaceId}/boards`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Old" });

        const response = await request(app)
            .patch(`/api/v1/boards/${board.body.data._id}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "New" })
            .expect(200);

        expect(response.body.data.title).toBe("New");
    });

    test("deletes a board and cascades to its lists/cards", async () => {
        const { token } = await createAuthenticatedUser();
        const workspaceId = await createWorkspace(token);
        const board = await request(app)
            .post(`/api/v1/workspaces/${workspaceId}/boards`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Board" });
        const list = await request(app)
            .post(`/api/v1/boards/${board.body.data._id}/lists`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "List" });

        await request(app)
            .delete(`/api/v1/boards/${board.body.data._id}`)
            .set("Authorization", `Bearer ${token}`)
            .expect(204);

        await request(app)
            .get(`/api/v1/lists/${list.body.data._id}`)
            .set("Authorization", `Bearer ${token}`)
            .expect(404);
        await request(app)
            .get(`/api/v1/boards/${board.body.data._id}`)
            .set("Authorization", `Bearer ${token}`)
            .expect(404);
    });

    describe("RBAC", () => {
        test("rejects a non-member creating, reading, or listing boards", async () => {
            const { ownerToken, workspaceId } = await createWorkspaceWithMember(app);
            const board = await request(app)
                .post(`/api/v1/workspaces/${workspaceId}/boards`)
                .set("Authorization", `Bearer ${ownerToken}`)
                .send({ title: "Board" });
            const { token: strangerToken } = await createAuthenticatedUser();

            await request(app)
                .post(`/api/v1/workspaces/${workspaceId}/boards`)
                .set("Authorization", `Bearer ${strangerToken}`)
                .send({ title: "Intruder board" })
                .expect(403);

            await request(app)
                .get(`/api/v1/workspaces/${workspaceId}/boards`)
                .set("Authorization", `Bearer ${strangerToken}`)
                .expect(403);

            await request(app)
                .get(`/api/v1/boards/${board.body.data._id}`)
                .set("Authorization", `Bearer ${strangerToken}`)
                .expect(403);

            await request(app)
                .patch(`/api/v1/boards/${board.body.data._id}`)
                .set("Authorization", `Bearer ${strangerToken}`)
                .send({ title: "Hijacked" })
                .expect(403);

            await request(app)
                .delete(`/api/v1/boards/${board.body.data._id}`)
                .set("Authorization", `Bearer ${strangerToken}`)
                .expect(403);
        });

        test("allows a Member (non-Admin) to create, update, and delete boards", async () => {
            const { memberToken, workspaceId } = await createWorkspaceWithMember(
                app,
                "Member",
            );

            const created = await request(app)
                .post(`/api/v1/workspaces/${workspaceId}/boards`)
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ title: "Member's board" })
                .expect(201);

            await request(app)
                .patch(`/api/v1/boards/${created.body.data._id}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ title: "Renamed by member" })
                .expect(200);

            await request(app)
                .delete(`/api/v1/boards/${created.body.data._id}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .expect(204);
        });
    });
});
