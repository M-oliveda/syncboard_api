import { describe, test, expect } from "@jest/globals";
import request from "supertest";
import { app } from "@/app.js";
import { createAuthenticatedUser } from "../helpers/auth.js";
import { createWorkspaceWithMember } from "../helpers/workspace.js";

const createBoardWithLists = async (token: string) => {
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
    const listA = await request(app)
        .post(`/api/v1/boards/${board.body.data._id}/lists`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "To Do" })
        .expect(201);
    const listB = await request(app)
        .post(`/api/v1/boards/${board.body.data._id}/lists`)
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Done" })
        .expect(201);
    return {
        listAId: listA.body.data._id as string,
        listBId: listB.body.data._id as string,
    };
};

describe("Cards", () => {
    test("returns 404 when the parent list does not exist", async () => {
        const { token } = await createAuthenticatedUser();

        await request(app)
            .post("/api/v1/lists/507f1f77bcf86cd799439011/cards")
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Card" })
            .expect(404);
    });

    test("creates a card with default content fields", async () => {
        const { token } = await createAuthenticatedUser();
        const { listAId } = await createBoardWithLists(token);

        const response = await request(app)
            .post(`/api/v1/lists/${listAId}/cards`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Design landing page" })
            .expect(201);

        expect(response.body.data).toMatchObject({
            title: "Design landing page",
            description: "",
            listId: listAId,
            assignees: [],
            labels: [],
            checklist: [],
        });
    });

    test("updates a card's content without moving it", async () => {
        const { token } = await createAuthenticatedUser();
        const { listAId } = await createBoardWithLists(token);
        const card = await request(app)
            .post(`/api/v1/lists/${listAId}/cards`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Draft" });

        const response = await request(app)
            .patch(`/api/v1/cards/${card.body.data._id}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Draft press release", description: "..." })
            .expect(200);

        expect(response.body.data.title).toBe("Draft press release");
        expect(response.body.data.description).toBe("...");
        expect(response.body.data.listId).toBe(listAId);
    });

    test("moves a card to another list/position without touching siblings", async () => {
        const { token } = await createAuthenticatedUser();
        const { listAId, listBId } = await createBoardWithLists(token);
        const sibling = await request(app)
            .post(`/api/v1/lists/${listBId}/cards`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Existing card", order: 5 });
        const card = await request(app)
            .post(`/api/v1/lists/${listAId}/cards`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Moving card" });

        const response = await request(app)
            .patch(`/api/v1/cards/${card.body.data._id}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ listId: listBId, order: 2.5 })
            .expect(200);

        expect(response.body.data.listId).toBe(listBId);
        expect(response.body.data.order).toBe(2.5);

        const siblingAfter = await request(app)
            .get(`/api/v1/cards/${sibling.body.data._id}`)
            .set("Authorization", `Bearer ${token}`)
            .expect(200);
        expect(siblingAfter.body.data.order).toBe(5);
    });

    test("rejects an empty PATCH body", async () => {
        const { token } = await createAuthenticatedUser();
        const { listAId } = await createBoardWithLists(token);
        const card = await request(app)
            .post(`/api/v1/lists/${listAId}/cards`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Card" });

        await request(app)
            .patch(`/api/v1/cards/${card.body.data._id}`)
            .set("Authorization", `Bearer ${token}`)
            .send({})
            .expect(400);
    });

    test("lists cards for a list with pagination", async () => {
        const { token } = await createAuthenticatedUser();
        const { listAId } = await createBoardWithLists(token);
        await request(app)
            .post(`/api/v1/lists/${listAId}/cards`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Card" });

        const response = await request(app)
            .get(`/api/v1/lists/${listAId}/cards`)
            .set("Authorization", `Bearer ${token}`)
            .expect(200);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.pagination.total).toBe(1);
    });

    test("deletes a card", async () => {
        const { token } = await createAuthenticatedUser();
        const { listAId } = await createBoardWithLists(token);
        const card = await request(app)
            .post(`/api/v1/lists/${listAId}/cards`)
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Card" });

        await request(app)
            .delete(`/api/v1/cards/${card.body.data._id}`)
            .set("Authorization", `Bearer ${token}`)
            .expect(204);

        await request(app)
            .get(`/api/v1/cards/${card.body.data._id}`)
            .set("Authorization", `Bearer ${token}`)
            .expect(404);
    });

    describe("RBAC", () => {
        const createListInWorkspace = async (token: string, workspaceId: string) => {
            const board = await request(app)
                .post(`/api/v1/workspaces/${workspaceId}/boards`)
                .set("Authorization", `Bearer ${token}`)
                .send({ title: "Board" })
                .expect(201);
            const list = await request(app)
                .post(`/api/v1/boards/${board.body.data._id}/lists`)
                .set("Authorization", `Bearer ${token}`)
                .send({ title: "To Do" })
                .expect(201);
            return list.body.data._id as string;
        };

        test("rejects a non-member creating, reading, or listing cards", async () => {
            const { ownerToken, workspaceId } = await createWorkspaceWithMember(app);
            const listId = await createListInWorkspace(ownerToken, workspaceId);
            const card = await request(app)
                .post(`/api/v1/lists/${listId}/cards`)
                .set("Authorization", `Bearer ${ownerToken}`)
                .send({ title: "Card" });
            const { token: strangerToken } = await createAuthenticatedUser();

            await request(app)
                .post(`/api/v1/lists/${listId}/cards`)
                .set("Authorization", `Bearer ${strangerToken}`)
                .send({ title: "Intruder card" })
                .expect(403);

            await request(app)
                .get(`/api/v1/lists/${listId}/cards`)
                .set("Authorization", `Bearer ${strangerToken}`)
                .expect(403);

            await request(app)
                .get(`/api/v1/cards/${card.body.data._id}`)
                .set("Authorization", `Bearer ${strangerToken}`)
                .expect(403);

            await request(app)
                .patch(`/api/v1/cards/${card.body.data._id}`)
                .set("Authorization", `Bearer ${strangerToken}`)
                .send({ title: "Hijacked" })
                .expect(403);

            await request(app)
                .delete(`/api/v1/cards/${card.body.data._id}`)
                .set("Authorization", `Bearer ${strangerToken}`)
                .expect(403);
        });

        test("rejects moving a card into a list the caller cannot access", async () => {
            const { ownerToken, memberToken, workspaceId } =
                await createWorkspaceWithMember(app, "Member");
            const listId = await createListInWorkspace(ownerToken, workspaceId);
            const card = await request(app)
                .post(`/api/v1/lists/${listId}/cards`)
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ title: "Card" })
                .expect(201);

            const { token: strangerToken } = await createAuthenticatedUser();
            const strangerWorkspace = await request(app)
                .post("/api/v1/workspaces")
                .set("Authorization", `Bearer ${strangerToken}`)
                .send({ name: "Stranger workspace" });
            const foreignListId = await createListInWorkspace(
                strangerToken,
                strangerWorkspace.body.data._id as string,
            );

            await request(app)
                .patch(`/api/v1/cards/${card.body.data._id}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ listId: foreignListId })
                .expect(403);
        });

        test("allows a Member (non-Admin) to create, update, and delete cards", async () => {
            const { ownerToken, memberToken, workspaceId } =
                await createWorkspaceWithMember(app, "Member");
            const listId = await createListInWorkspace(ownerToken, workspaceId);

            const created = await request(app)
                .post(`/api/v1/lists/${listId}/cards`)
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ title: "Member's card" })
                .expect(201);

            await request(app)
                .patch(`/api/v1/cards/${created.body.data._id}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ title: "Renamed by member" })
                .expect(200);

            await request(app)
                .delete(`/api/v1/cards/${created.body.data._id}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .expect(204);
        });
    });
});
