import { Router } from "express";
import { requireAuth } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { currentUserId } from "@/utils/currentUser.js";
import { collectionResponse, successResponse } from "@/utils/response.js";
import * as boardService from "@/services/board.service.js";
import {
    CreateBoardSchema,
    UpdateBoardSchema,
    type CreateBoardInput,
    type UpdateBoardInput,
} from "@/routes/v1/board.schema.js";
import { listsUnderBoardRouter } from "@/routes/v1/list.routes.js";

/** Mounted under /workspaces/:workspaceId/boards — create + list. */
export const boardsUnderWorkspaceRouter = Router({ mergeParams: true });

boardsUnderWorkspaceRouter.use(requireAuth);

boardsUnderWorkspaceRouter.post(
    "/",
    validate(CreateBoardSchema),
    asyncHandler(async (req, res) => {
        const { title } = req.body as CreateBoardInput;
        const board = await boardService.createBoard(
            req.params.workspaceId,
            currentUserId(req),
            title,
        );
        res.status(201).json(successResponse(board));
    }),
);

boardsUnderWorkspaceRouter.get(
    "/",
    asyncHandler(async (req, res) => {
        const { items, page, limit, total } = await boardService.listBoardsForWorkspace(
            req.params.workspaceId,
            currentUserId(req),
            req.query,
        );
        res.json(collectionResponse(items, page, limit, total));
    }),
);

/** Mounted at /boards — get/patch/delete by id. */
export const boardRouter = Router();

boardRouter.use(requireAuth);

boardRouter.use("/:boardId/lists", listsUnderBoardRouter);

boardRouter.get(
    "/:boardId",
    asyncHandler(async (req, res) => {
        const { board, lists, cards } = await boardService.getBoardWithListsAndCards(
            req.params.boardId,
            currentUserId(req),
        );
        res.json(successResponse({ board, lists, cards }));
    }),
);

boardRouter.patch(
    "/:boardId",
    validate(UpdateBoardSchema),
    asyncHandler(async (req, res) => {
        const { title } = req.body as UpdateBoardInput;
        const board = await boardService.updateBoardTitle(
            req.params.boardId,
            currentUserId(req),
            title,
        );
        res.json(successResponse(board));
    }),
);

boardRouter.delete(
    "/:boardId",
    asyncHandler(async (req, res) => {
        await boardService.deleteBoard(req.params.boardId, currentUserId(req));
        res.status(204).send();
    }),
);
