import { describe, test, expect } from "@jest/globals";
import request from "supertest";
import { app } from "@/app.js";
import { createAuthenticatedUser } from "../helpers/auth.js";
import { createWorkspaceWithMember } from "../helpers/workspace.js";

const createBoard = async (token: string) => {
    const workspace = await request(app)
        .post("/api/v1/workspaces")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Workspace" })
        .expect(201);
    const board = await request(app)
        .post(`/api/v1/workspaces/${workspace.body.data._id}/boards`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Board" })
        .expect(201);
    return board.body.data._id as string;
};

describe("Lists", () => {
    test("returns 404 when the parent board does not exist", async () => {
        const { token } = await createAuthenticatedUser();

        await request(app)
            .post("/api/v1/boards/507f1f77bcf86cd799439011/lists")
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "To Do" })
            .expect(404);
    });

    test("appends lists in creation order when no order is given", async () => {
        const { token } = await createAuthenticatedUser();
        const boardId = await createBoard(token);

        const first = await request(app)
            .post(`/api/v1/boards/${boardId}/lists`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "To Do" })
            .expect(201);
        const second = await request(app)
            .post(`/api/v1/boards/${boardId}/lists`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Done" })
            .expect(201);

        expect(second.body.data.order).toBeGreaterThan(first.body.data.order);
    });

    test("gets a single list by id", async () => {
        const { token } = await createAuthenticatedUser();
        const boardId = await createBoard(token);
        const list = await request(app)
            .post(`/api/v1/boards/${boardId}/lists`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "To Do" });

        const response = await request(app)
            .get(`/api/v1/lists/${list.body.data._id}`)
            .set("Authorization", `Bearer ${token}`)
            .expect(200);

        expect(response.body.data.title).toBe("To Do");
    });

    test("rejects an empty PATCH body", async () => {
        const { token } = await createAuthenticatedUser();
        const boardId = await createBoard(token);
        const list = await request(app)
            .post(`/api/v1/boards/${boardId}/lists`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "To Do" });

        await request(app)
            .patch(`/api/v1/lists/${list.body.data._id}`)
            .set("Authorization", `Bearer ${token}`)
            .send({})
            .expect(400);
    });

    test("reorders a list via PATCH order", async () => {
        const { token } = await createAuthenticatedUser();
        const boardId = await createBoard(token);
        const list = await request(app)
            .post(`/api/v1/boards/${boardId}/lists`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "To Do", order: 1 });

        const response = await request(app)
            .patch(`/api/v1/lists/${list.body.data._id}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ order: 1.5 })
            .expect(200);

        expect(response.body.data.order).toBe(1.5);
    });

    test("deletes a list and cascades to its cards", async () => {
        const { token } = await createAuthenticatedUser();
        const boardId = await createBoard(token);
        const list = await request(app)
            .post(`/api/v1/boards/${boardId}/lists`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "To Do" });
        const card = await request(app)
            .post(`/api/v1/lists/${list.body.data._id}/cards`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Card" });

        await request(app)
            .delete(`/api/v1/lists/${list.body.data._id}`)
            .set("Authorization", `Bearer ${token}`)
            .expect(204);

        await request(app)
            .get(`/api/v1/cards/${card.body.data._id}`)
            .set("Authorization", `Bearer ${token}`)
            .expect(404);
    });

    test("lists lists for a board with pagination", async () => {
        const { token } = await createAuthenticatedUser();
        const boardId = await createBoard(token);
        await request(app)
            .post(`/api/v1/boards/${boardId}/lists`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "To Do" });

        const response = await request(app)
            .get(`/api/v1/boards/${boardId}/lists`)
            .set("Authorization", `Bearer ${token}`)
            .expect(200);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.pagination.total).toBe(1);
    });

    describe("RBAC", () => {
        const createBoardInWorkspace = async (token: string, workspaceId: string) => {
            const board = await request(app)
                .post(`/api/v1/workspaces/${workspaceId}/boards`)
                .set("Authorization", `Bearer ${token}`)
                .send({ title: "Board" })
                .expect(201);
            return board.body.data._id as string;
        };

        test("rejects a non-member creating, reading, or listing lists", async () => {
            const { ownerToken, workspaceId } = await createWorkspaceWithMember(app);
            const boardId = await createBoardInWorkspace(ownerToken, workspaceId);
            const list = await request(app)
                .post(`/api/v1/boards/${boardId}/lists`)
                .set("Authorization", `Bearer ${ownerToken}`)
                .send({ title: "To Do" });
            const { token: strangerToken } = await createAuthenticatedUser();

            await request(app)
                .post(`/api/v1/boards/${boardId}/lists`)
                .set("Authorization", `Bearer ${strangerToken}`)
                .send({ title: "Intruder list" })
                .expect(403);

            await request(app)
                .get(`/api/v1/boards/${boardId}/lists`)
                .set("Authorization", `Bearer ${strangerToken}`)
                .expect(403);

            await request(app)
                .get(`/api/v1/lists/${list.body.data._id}`)
                .set("Authorization", `Bearer ${strangerToken}`)
                .expect(403);

            await request(app)
                .patch(`/api/v1/lists/${list.body.data._id}`)
                .set("Authorization", `Bearer ${strangerToken}`)
                .send({ title: "Hijacked" })
                .expect(403);

            await request(app)
                .delete(`/api/v1/lists/${list.body.data._id}`)
                .set("Authorization", `Bearer ${strangerToken}`)
                .expect(403);
        });

        test("allows a Member (non-Admin) to create, update, and delete lists", async () => {
            const { ownerToken, memberToken, workspaceId } =
                await createWorkspaceWithMember(app, "Member");
            const boardId = await createBoardInWorkspace(ownerToken, workspaceId);

            const created = await request(app)
                .post(`/api/v1/boards/${boardId}/lists`)
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ title: "Member's list" })
                .expect(201);

            await request(app)
                .patch(`/api/v1/lists/${created.body.data._id}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ title: "Renamed by member" })
                .expect(200);

            await request(app)
                .delete(`/api/v1/lists/${created.body.data._id}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .expect(204);
        });
    });
});
