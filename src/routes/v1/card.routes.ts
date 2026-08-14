import { Router } from "express";
import { requireAuth } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { collectionResponse, successResponse } from "@/utils/response.js";
import * as cardService from "@/services/card.service.js";
import {
    CreateCardSchema,
    UpdateCardSchema,
    type CreateCardInput,
    type UpdateCardInput,
} from "@/routes/v1/card.schema.js";

/** Mounted under /lists/:listId/cards — create + list. */
export const cardsUnderListRouter = Router({ mergeParams: true });

cardsUnderListRouter.use(requireAuth);

cardsUnderListRouter.post(
    "/",
    validate(CreateCardSchema),
    asyncHandler(async (req, res) => {
        const input = req.body as CreateCardInput;
        const card = await cardService.createCard(req.params.listId, input);
        res.status(201).json(successResponse(card));
    }),
);

cardsUnderListRouter.get(
    "/",
    asyncHandler(async (req, res) => {
        const { items, page, limit, total } = await cardService.listCardsForList(
            req.params.listId,
            req.query,
        );
        res.json(collectionResponse(items, page, limit, total));
    }),
);

/** Mounted at /cards — get/patch/delete by id. */
export const cardRouter = Router();

cardRouter.use(requireAuth);

cardRouter.get(
    "/:cardId",
    asyncHandler(async (req, res) => {
        const card = await cardService.getCardById(req.params.cardId);
        res.json(successResponse(card));
    }),
);

cardRouter.patch(
    "/:cardId",
    validate(UpdateCardSchema),
    asyncHandler(async (req, res) => {
        const updates = req.body as UpdateCardInput;
        const card = await cardService.updateCard(req.params.cardId, updates);
        res.json(successResponse(card));
    }),
);

cardRouter.delete(
    "/:cardId",
    asyncHandler(async (req, res) => {
        await cardService.deleteCard(req.params.cardId);
        res.status(204).send();
    }),
);
