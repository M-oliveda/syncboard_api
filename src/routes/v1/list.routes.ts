import { Router } from "express";
import { requireAuth } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { collectionResponse, successResponse } from "@/utils/response.js";
import * as listService from "@/services/list.service.js";
import {
    CreateListSchema,
    UpdateListSchema,
    type CreateListInput,
    type UpdateListInput,
} from "@/routes/v1/list.schema.js";
import { cardsUnderListRouter } from "@/routes/v1/card.routes.js";

/** Mounted under /boards/:boardId/lists — create + list. */
export const listsUnderBoardRouter = Router({ mergeParams: true });

listsUnderBoardRouter.use(requireAuth);

listsUnderBoardRouter.post(
    "/",
    validate(CreateListSchema),
    asyncHandler(async (req, res) => {
        const { title, order } = req.body as CreateListInput;
        const list = await listService.createList(req.params.boardId, title, order);
        res.status(201).json(successResponse(list));
    }),
);

listsUnderBoardRouter.get(
    "/",
    asyncHandler(async (req, res) => {
        const { items, page, limit, total } = await listService.listListsForBoard(
            req.params.boardId,
            req.query,
        );
        res.json(collectionResponse(items, page, limit, total));
    }),
);

/** Mounted at /lists — get/patch/delete by id. */
export const listRouter = Router();

listRouter.use(requireAuth);

listRouter.use("/:listId/cards", cardsUnderListRouter);

listRouter.get(
    "/:listId",
    asyncHandler(async (req, res) => {
        const list = await listService.getListById(req.params.listId);
        res.json(successResponse(list));
    }),
);

listRouter.patch(
    "/:listId",
    validate(UpdateListSchema),
    asyncHandler(async (req, res) => {
        const updates = req.body as UpdateListInput;
        const list = await listService.updateList(req.params.listId, updates);
        res.json(successResponse(list));
    }),
);

listRouter.delete(
    "/:listId",
    asyncHandler(async (req, res) => {
        await listService.deleteList(req.params.listId);
        res.status(204).send();
    }),
);
