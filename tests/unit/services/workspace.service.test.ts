import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { Types } from "mongoose";
import { mockFn } from "../../helpers/mockFn.js";
import { createFakeQuery } from "../../helpers/mockQuery.js";

const WorkspaceModel = {
    create: mockFn(),
    find: mockFn(),
    countDocuments: mockFn(),
    findById: mockFn(),
    deleteOne: mockFn(),
};
const BoardModel = { find: mockFn(), deleteMany: mockFn() };
const ListModel = { find: mockFn(), deleteMany: mockFn() };
const CardModel = { deleteMany: mockFn() };

jest.unstable_mockModule("@/models/workspace.model.js", () => ({
    WorkspaceModel,
    WORKSPACE_ROLES: ["Admin", "Member"],
}));
jest.unstable_mockModule("@/models/board.model.js", () => ({ BoardModel }));
jest.unstable_mockModule("@/models/list.model.js", () => ({ ListModel }));
jest.unstable_mockModule("@/models/card.model.js", () => ({ CardModel }));

const workspaceService = await import("@/services/workspace.service.js");
const { ConflictError, NotFoundError } = await import("@/utils/errors.js");

const buildWorkspaceDoc = (overrides: Record<string, unknown> = {}) => ({
    _id: new Types.ObjectId(),
    name: "Marketing",
    members: [] as { userId: Types.ObjectId; role: string }[],
    save: jest.fn(async function (this: unknown) {
        return this;
    }),
    ...overrides,
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe("createWorkspace", () => {
    test("creates a workspace with the creator as the first Admin member", async () => {
        const creatorId = new Types.ObjectId().toString();
        WorkspaceModel.create.mockResolvedValueOnce({ name: "Marketing" });

        await workspaceService.createWorkspace("Marketing", creatorId);

        expect(WorkspaceModel.create).toHaveBeenCalledWith({
            name: "Marketing",
            members: [{ userId: new Types.ObjectId(creatorId), role: "Admin" }],
        });
    });
});

describe("listWorkspacesForUser", () => {
    test("returns items, pagination, and total for the user's workspaces", async () => {
        const items = [buildWorkspaceDoc()];
        WorkspaceModel.find.mockReturnValueOnce(createFakeQuery(items));
        WorkspaceModel.countDocuments.mockResolvedValueOnce(1);

        const result = await workspaceService.listWorkspacesForUser(
            new Types.ObjectId().toString(),
            {},
        );

        expect(result).toEqual({ items, page: 1, limit: 20, total: 1 });
    });
});

describe("getWorkspaceById", () => {
    test("returns the workspace when found", async () => {
        const doc = buildWorkspaceDoc();
        WorkspaceModel.findById.mockResolvedValueOnce(doc);

        await expect(
            workspaceService.getWorkspaceById(doc._id.toString()),
        ).resolves.toBe(doc);
    });

    test("throws NotFoundError when missing", async () => {
        WorkspaceModel.findById.mockResolvedValueOnce(null);

        await expect(workspaceService.getWorkspaceById("missing")).rejects.toThrow(
            NotFoundError,
        );
    });
});

describe("updateWorkspaceName", () => {
    test("updates the name and saves", async () => {
        const doc = buildWorkspaceDoc();
        WorkspaceModel.findById.mockResolvedValueOnce(doc);

        const result = await workspaceService.updateWorkspaceName(
            doc._id.toString(),
            "New Name",
        );

        expect(result.name).toBe("New Name");
        expect(doc.save).toHaveBeenCalledTimes(1);
    });
});

describe("deleteWorkspace", () => {
    test("cascades deletes across boards, lists, and cards", async () => {
        const doc = buildWorkspaceDoc();
        const workspaceId = doc._id.toString();
        const boardId = new Types.ObjectId();
        const listId = new Types.ObjectId();

        WorkspaceModel.findById.mockResolvedValueOnce(doc);
        BoardModel.find.mockReturnValueOnce(createFakeQuery([{ _id: boardId }]));
        ListModel.find.mockReturnValueOnce(createFakeQuery([{ _id: listId }]));
        CardModel.deleteMany.mockResolvedValueOnce({});
        ListModel.deleteMany.mockResolvedValueOnce({});
        BoardModel.deleteMany.mockResolvedValueOnce({});
        WorkspaceModel.deleteOne.mockResolvedValueOnce({});

        await workspaceService.deleteWorkspace(workspaceId);

        expect(CardModel.deleteMany).toHaveBeenCalledWith({
            listId: { $in: [listId] },
        });
        expect(ListModel.deleteMany).toHaveBeenCalledWith({
            boardId: { $in: [boardId] },
        });
        expect(BoardModel.deleteMany).toHaveBeenCalledWith({ workspaceId });
        expect(WorkspaceModel.deleteOne).toHaveBeenCalledWith({ _id: workspaceId });
    });

    test("throws NotFoundError when the workspace does not exist", async () => {
        WorkspaceModel.findById.mockResolvedValueOnce(null);

        await expect(workspaceService.deleteWorkspace("missing")).rejects.toThrow(
            NotFoundError,
        );
    });
});

describe("addMember", () => {
    test("adds a new member defaulting to Member role", async () => {
        const doc = buildWorkspaceDoc();
        WorkspaceModel.findById.mockResolvedValueOnce(doc);
        const userId = new Types.ObjectId().toString();

        const result = await workspaceService.addMember(doc._id.toString(), userId);

        expect(result.members).toHaveLength(1);
        expect(result.members[0]?.role).toBe("Member");
    });

    test("adds a new member with an explicit role", async () => {
        const doc = buildWorkspaceDoc();
        WorkspaceModel.findById.mockResolvedValueOnce(doc);
        const userId = new Types.ObjectId().toString();

        const result = await workspaceService.addMember(
            doc._id.toString(),
            userId,
            "Admin",
        );

        expect(result.members[0]?.role).toBe("Admin");
    });

    test("throws ConflictError when the user is already a member", async () => {
        const userId = new Types.ObjectId();
        const doc = buildWorkspaceDoc({ members: [{ userId, role: "Member" }] });
        WorkspaceModel.findById.mockResolvedValueOnce(doc);

        await expect(
            workspaceService.addMember(doc._id.toString(), userId.toString()),
        ).rejects.toThrow(ConflictError);
    });
});

describe("updateMemberRole", () => {
    test("updates an existing member's role", async () => {
        const userId = new Types.ObjectId();
        const doc = buildWorkspaceDoc({ members: [{ userId, role: "Member" }] });
        WorkspaceModel.findById.mockResolvedValueOnce(doc);

        const result = await workspaceService.updateMemberRole(
            doc._id.toString(),
            userId.toString(),
            "Admin",
        );

        expect(result.members[0]?.role).toBe("Admin");
    });

    test("throws NotFoundError when the user is not a member", async () => {
        const doc = buildWorkspaceDoc();
        WorkspaceModel.findById.mockResolvedValueOnce(doc);

        await expect(
            workspaceService.updateMemberRole(
                doc._id.toString(),
                new Types.ObjectId().toString(),
                "Admin",
            ),
        ).rejects.toThrow(NotFoundError);
    });
});

describe("removeMember", () => {
    test("removes an existing member", async () => {
        const userId = new Types.ObjectId();
        const doc = buildWorkspaceDoc({ members: [{ userId, role: "Member" }] });
        WorkspaceModel.findById.mockResolvedValueOnce(doc);

        const result = await workspaceService.removeMember(
            doc._id.toString(),
            userId.toString(),
        );

        expect(result.members).toHaveLength(0);
    });

    test("throws NotFoundError when the user is not a member", async () => {
        const doc = buildWorkspaceDoc();
        WorkspaceModel.findById.mockResolvedValueOnce(doc);

        await expect(
            workspaceService.removeMember(
                doc._id.toString(),
                new Types.ObjectId().toString(),
            ),
        ).rejects.toThrow(NotFoundError);
    });
});
