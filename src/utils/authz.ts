import type { WorkspaceMember } from "@/models/workspace.model.js";
import { ForbiddenError } from "@/utils/errors.js";

export const requireWorkspaceMembership = (
    workspace: { _id: unknown; members: WorkspaceMember[] },
    userId: string,
): WorkspaceMember => {
    const member = workspace.members.find(
        (candidate) => candidate.userId.toString() === userId,
    );

    if (!member) {
        throw new ForbiddenError(
            `You are not a member of workspace ${String(workspace._id)}`,
        );
    }

    return member;
};

export const requireWorkspaceAdmin = (
    workspace: { _id: unknown; members: WorkspaceMember[] },
    userId: string,
): WorkspaceMember => {
    const member = requireWorkspaceMembership(workspace, userId);

    if (member.role !== "Admin") {
        throw new ForbiddenError(
            `Admin role required in workspace ${String(workspace._id)}`,
        );
    }

    return member;
};
