import { Types } from "mongoose";
import {
    WorkspaceModel,
    type WorkspaceMember,
    type WorkspaceRole,
} from "@/models/workspace.model.js";
import { BoardModel } from "@/models/board.model.js";
import { ListModel } from "@/models/list.model.js";
import { CardModel } from "@/models/card.model.js";
import { ConflictError, NotFoundError } from "@/utils/errors.js";
import { parsePagination } from "@/utils/pagination.js";
import { requireWorkspaceAdmin, requireWorkspaceMembership } from "@/utils/authz.js";

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
        WorkspaceModel.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .populate("members.userId", "email"),
        WorkspaceModel.countDocuments(filter),
    ]);

    return { items, page, limit, total };
};

/** Read-only, populated fetch for responses that need member emails. Never used by
 * assertWorkspaceAccess/authz — those need members[].userId as a raw ObjectId so
 * `.toString()` comparisons keep working. */
export const getWorkspaceWithPopulatedMembers = async (workspaceId: string) => {
    const workspace = await WorkspaceModel.findById(workspaceId);

    if (!workspace) {
        throw new NotFoundError(`Workspace ${workspaceId} not found`);
    }

    await workspace.populate("members.userId", "email");
    return workspace;
};

/** Raw fetch — no authorization check. Only call directly when the caller
 * doesn't need membership enforced (e.g. from assertWorkspaceAccess itself,
 * or createWorkspace's own follow-up reads). Route/service call sites that
 * need access control should use assertWorkspaceAccess instead. */
export const getWorkspaceById = async (workspaceId: string) => {
    const workspace = await WorkspaceModel.findById(workspaceId);

    if (!workspace) {
        throw new NotFoundError(`Workspace ${workspaceId} not found`);
    }

    return workspace;
};

type WorkspaceDoc = Awaited<ReturnType<typeof getWorkspaceById>>;

export const assertWorkspaceAccess = async (
    workspaceId: string,
    userId: string,
    options: { requireAdmin?: boolean } = {},
): Promise<{ workspace: WorkspaceDoc; member: WorkspaceMember }> => {
    const workspace = await getWorkspaceById(workspaceId);
    const member = options.requireAdmin
        ? requireWorkspaceAdmin(workspace, userId)
        : requireWorkspaceMembership(workspace, userId);

    return { workspace, member };
};

export const updateWorkspaceName = async (
    workspaceId: string,
    userId: string,
    name: string,
) => {
    const { workspace } = await assertWorkspaceAccess(workspaceId, userId, {
        requireAdmin: true,
    });
    workspace.name = name;
    await workspace.save();
    return workspace;
};

export const deleteWorkspace = async (
    workspaceId: string,
    userId: string,
): Promise<void> => {
    await assertWorkspaceAccess(workspaceId, userId, { requireAdmin: true });

    const boards = await BoardModel.find({ workspaceId }).select("_id");
    const boardIds = boards.map((board) => board._id);
    const lists = await ListModel.find({ boardId: { $in: boardIds } }).select("_id");
    const listIds = lists.map((list) => list._id);

    await CardModel.deleteMany({ listId: { $in: listIds } });
    await ListModel.deleteMany({ boardId: { $in: boardIds } });
    await BoardModel.deleteMany({ workspaceId });
    await WorkspaceModel.deleteOne({ _id: workspaceId });
};

const findMember = (workspace: WorkspaceDoc, userId: string) => {
    return workspace.members.find((member) => member.userId.toString() === userId);
};

export const addMember = async (
    workspaceId: string,
    callerId: string,
    targetUserId: string,
    role: WorkspaceRole = "Member",
) => {
    const { workspace } = await assertWorkspaceAccess(workspaceId, callerId, {
        requireAdmin: true,
    });

    if (findMember(workspace, targetUserId)) {
        throw new ConflictError(
            `User ${targetUserId} is already a member of this workspace`,
        );
    }

    workspace.members.push({ userId: new Types.ObjectId(targetUserId), role });
    await workspace.save();
    await workspace.populate("members.userId", "email");
    return workspace;
};

export const updateMemberRole = async (
    workspaceId: string,
    callerId: string,
    targetUserId: string,
    role: WorkspaceRole,
) => {
    const { workspace } = await assertWorkspaceAccess(workspaceId, callerId, {
        requireAdmin: true,
    });
    const member = findMember(workspace, targetUserId);

    if (!member) {
        throw new NotFoundError(
            `User ${targetUserId} is not a member of this workspace`,
        );
    }

    member.role = role;
    await workspace.save();
    await workspace.populate("members.userId", "email");
    return workspace;
};

export const removeMember = async (
    workspaceId: string,
    callerId: string,
    targetUserId: string,
) => {
    const { workspace } = await assertWorkspaceAccess(workspaceId, callerId, {
        requireAdmin: true,
    });
    const memberIndex = workspace.members.findIndex(
        (member) => member.userId.toString() === targetUserId,
    );

    if (memberIndex === -1) {
        throw new NotFoundError(
            `User ${targetUserId} is not a member of this workspace`,
        );
    }

    workspace.members.splice(memberIndex, 1);
    await workspace.save();
    await workspace.populate("members.userId", "email");
    return workspace;
};
