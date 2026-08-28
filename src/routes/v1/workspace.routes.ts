import { Router } from "express";
import { requireAuth } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { currentUserId } from "@/utils/currentUser.js";
import { collectionResponse, successResponse } from "@/utils/response.js";
import * as workspaceService from "@/services/workspace.service.js";
import { boardsUnderWorkspaceRouter } from "@/routes/v1/board.routes.js";
import {
    AddMemberSchema,
    CreateWorkspaceSchema,
    UpdateMemberRoleSchema,
    UpdateWorkspaceSchema,
    type AddMemberInput,
    type CreateWorkspaceInput,
    type UpdateMemberRoleInput,
    type UpdateWorkspaceInput,
} from "@/routes/v1/workspace.schema.js";

export const workspaceRouter = Router();

workspaceRouter.use(requireAuth);

workspaceRouter.use("/:workspaceId/boards", boardsUnderWorkspaceRouter);

workspaceRouter.post(
    "/",
    validate(CreateWorkspaceSchema),
    asyncHandler(async (req, res) => {
        const { name } = req.body as CreateWorkspaceInput;
        const workspace = await workspaceService.createWorkspace(
            name,
            currentUserId(req),
        );
        res.status(201).json(successResponse(workspace));
    }),
);

workspaceRouter.get(
    "/",
    asyncHandler(async (req, res) => {
        const { items, page, limit, total } =
            await workspaceService.listWorkspacesForUser(currentUserId(req), req.query);
        res.json(collectionResponse(items, page, limit, total));
    }),
);

workspaceRouter.get(
    "/:workspaceId",
    asyncHandler(async (req, res) => {
        await workspaceService.assertWorkspaceAccess(
            req.params.workspaceId,
            currentUserId(req),
        );
        const workspace = await workspaceService.getWorkspaceWithPopulatedMembers(
            req.params.workspaceId,
        );
        res.json(successResponse(workspace));
    }),
);

workspaceRouter.patch(
    "/:workspaceId",
    validate(UpdateWorkspaceSchema),
    asyncHandler(async (req, res) => {
        const { name } = req.body as UpdateWorkspaceInput;
        const workspace = await workspaceService.updateWorkspaceName(
            req.params.workspaceId,
            currentUserId(req),
            name,
        );
        res.json(successResponse(workspace));
    }),
);

workspaceRouter.delete(
    "/:workspaceId",
    asyncHandler(async (req, res) => {
        await workspaceService.deleteWorkspace(
            req.params.workspaceId,
            currentUserId(req),
        );
        res.status(204).send();
    }),
);

workspaceRouter.post(
    "/:workspaceId/members",
    validate(AddMemberSchema),
    asyncHandler(async (req, res) => {
        const { userId, role } = req.body as AddMemberInput;
        const workspace = await workspaceService.addMember(
            req.params.workspaceId,
            currentUserId(req),
            userId,
            role,
        );
        res.status(201).json(successResponse(workspace));
    }),
);

workspaceRouter.patch(
    "/:workspaceId/members/:userId",
    validate(UpdateMemberRoleSchema),
    asyncHandler(async (req, res) => {
        const { role } = req.body as UpdateMemberRoleInput;
        const workspace = await workspaceService.updateMemberRole(
            req.params.workspaceId,
            currentUserId(req),
            req.params.userId,
            role,
        );
        res.json(successResponse(workspace));
    }),
);

workspaceRouter.delete(
    "/:workspaceId/members/:userId",
    asyncHandler(async (req, res) => {
        const workspace = await workspaceService.removeMember(
            req.params.workspaceId,
            currentUserId(req),
            req.params.userId,
        );
        res.json(successResponse(workspace));
    }),
);
