import { Types } from "mongoose";
import { WorkspaceModel, type WorkspaceRole } from "@/models/workspace.model.js";
import { BoardModel } from "@/models/board.model.js";
import { ListModel } from "@/models/list.model.js";
import { CardModel } from "@/models/card.model.js";
import { ConflictError, NotFoundError } from "@/utils/errors.js";
import { parsePagination } from "@/utils/pagination.js";

export const createWorkspace = async (name: string, creatorId: string) => {
    return WorkspaceModel.create({
        name,
        members: [{ userId: new Types.ObjectId(creatorId), role: "Admin" }],
    });
};

export const listWorkspacesForUser = async (
    userId: string,
    query: Record<string, unknown>,
) => {
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = { "members.userId": new Types.ObjectId(userId) };

    const [items, total] = await Promise.all([
        WorkspaceModel.find(filter).sort(sort).skip(skip).limit(limit),
        WorkspaceModel.countDocuments(filter),
    ]);

    return { items, page, limit, total };
};

export const getWorkspaceById = async (workspaceId: string) => {
    const workspace = await WorkspaceModel.findById(workspaceId);

    if (!workspace) {
        throw new NotFoundError(`Workspace ${workspaceId} not found`);
    }

    return workspace;
};

export const updateWorkspaceName = async (workspaceId: string, name: string) => {
    const workspace = await getWorkspaceById(workspaceId);
    workspace.name = name;
    await workspace.save();
    return workspace;
};

export const deleteWorkspace = async (workspaceId: string): Promise<void> => {
    await getWorkspaceById(workspaceId);

    const boards = await BoardModel.find({ workspaceId }).select("_id");
    const boardIds = boards.map((board) => board._id);
    const lists = await ListModel.find({ boardId: { $in: boardIds } }).select("_id");
    const listIds = lists.map((list) => list._id);

    await CardModel.deleteMany({ listId: { $in: listIds } });
    await ListModel.deleteMany({ boardId: { $in: boardIds } });
    await BoardModel.deleteMany({ workspaceId });
    await WorkspaceModel.deleteOne({ _id: workspaceId });
};

type WorkspaceDoc = Awaited<ReturnType<typeof getWorkspaceById>>;

const findMember = (workspace: WorkspaceDoc, userId: string) => {
    return workspace.members.find((member) => member.userId.toString() === userId);
};

export const addMember = async (
    workspaceId: string,
    userId: string,
    role: WorkspaceRole = "Member",
) => {
    const workspace = await getWorkspaceById(workspaceId);

    if (findMember(workspace, userId)) {
        throw new ConflictError(`User ${userId} is already a member of this workspace`);
    }

    workspace.members.push({ userId: new Types.ObjectId(userId), role });
    await workspace.save();
    return workspace;
};

export const updateMemberRole = async (
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
) => {
    const workspace = await getWorkspaceById(workspaceId);
    const member = findMember(workspace, userId);

    if (!member) {
        throw new NotFoundError(`User ${userId} is not a member of this workspace`);
    }

    member.role = role;
    await workspace.save();
    return workspace;
};

export const removeMember = async (workspaceId: string, userId: string) => {
    const workspace = await getWorkspaceById(workspaceId);
    const memberIndex = workspace.members.findIndex(
        (member) => member.userId.toString() === userId,
    );

    if (memberIndex === -1) {
        throw new NotFoundError(`User ${userId} is not a member of this workspace`);
    }

    workspace.members.splice(memberIndex, 1);
    await workspace.save();
    return workspace;
};
