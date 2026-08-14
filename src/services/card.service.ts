import { Types } from "mongoose";
import { CardModel } from "@/models/card.model.js";
import { NotFoundError } from "@/utils/errors.js";
import { parsePagination } from "@/utils/pagination.js";
import { computeOrderBetween } from "@/utils/reorder.js";
import { getListById } from "@/services/list.service.js";
import type { CreateCardInput, UpdateCardInput } from "@/routes/v1/card.schema.js";

const nextAppendOrder = async (listId: string): Promise<number> => {
    const last = await CardModel.findOne({ listId })
        .sort({ order: -1 })
        .select("order");
    return computeOrderBetween(last?.order ?? null, null);
};

export const createCard = async (listId: string, input: CreateCardInput) => {
    await getListById(listId);
    const order = input.order ?? (await nextAppendOrder(listId));

    return CardModel.create({
        listId,
        title: input.title,
        description: input.description ?? "",
        order,
        assignees: input.assignees ?? [],
        labels: input.labels ?? [],
        checklist: input.checklist ?? [],
    });
};

export const listCardsForList = async (
    listId: string,
    query: Record<string, unknown>,
) => {
    await getListById(listId);
    const { page, limit, skip, sort } = parsePagination(query, "order");
    const filter = { listId };

    const [items, total] = await Promise.all([
        CardModel.find(filter).sort(sort).skip(skip).limit(limit),
        CardModel.countDocuments(filter),
    ]);

    return { items, page, limit, total };
};

export const getCardById = async (cardId: string) => {
    const card = await CardModel.findById(cardId);

    if (!card) {
        throw new NotFoundError(`Card ${cardId} not found`);
    }

    return card;
};

export const updateCard = async (cardId: string, updates: UpdateCardInput) => {
    const card = await getCardById(cardId);

    if (updates.listId !== undefined && updates.listId !== card.listId.toString()) {
        await getListById(updates.listId);
        card.listId = new Types.ObjectId(updates.listId);
        card.order = updates.order ?? (await nextAppendOrder(updates.listId));
    } else if (updates.order !== undefined) {
        card.order = updates.order;
    }

    if (updates.title !== undefined) {
        card.title = updates.title;
    }

    if (updates.description !== undefined) {
        card.description = updates.description;
    }

    if (updates.assignees !== undefined) {
        card.assignees = updates.assignees.map((id) => new Types.ObjectId(id));
    }

    if (updates.labels !== undefined) {
        card.labels = updates.labels;
    }

    if (updates.checklist !== undefined) {
        card.checklist.splice(0, card.checklist.length, ...updates.checklist);
    }

    await card.save();
    return card;
};

export const deleteCard = async (cardId: string): Promise<void> => {
    await getCardById(cardId);
    await CardModel.deleteOne({ _id: cardId });
};
