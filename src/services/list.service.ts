import { ListModel } from "@/models/list.model.js";
import { CardModel } from "@/models/card.model.js";
import { NotFoundError } from "@/utils/errors.js";
import { parsePagination } from "@/utils/pagination.js";
import { computeOrderBetween } from "@/utils/reorder.js";
import { getBoardById } from "@/services/board.service.js";

const nextAppendOrder = async (boardId: string): Promise<number> => {
    const last = await ListModel.findOne({ boardId })
        .sort({ order: -1 })
        .select("order");
    return computeOrderBetween(last?.order ?? null, null);
};

export const createList = async (boardId: string, title: string, order?: number) => {
    await getBoardById(boardId);
    const resolvedOrder = order ?? (await nextAppendOrder(boardId));
    return ListModel.create({ boardId, title, order: resolvedOrder });
};

export const listListsForBoard = async (
    boardId: string,
    query: Record<string, unknown>,
) => {
    await getBoardById(boardId);
    const { page, limit, skip, sort } = parsePagination(query, "order");
    const filter = { boardId };

    const [items, total] = await Promise.all([
        ListModel.find(filter).sort(sort).skip(skip).limit(limit),
        ListModel.countDocuments(filter),
    ]);

    return { items, page, limit, total };
};

export const getListById = async (listId: string) => {
    const list = await ListModel.findById(listId);

    if (!list) {
        throw new NotFoundError(`List ${listId} not found`);
    }

    return list;
};

export const updateList = async (
    listId: string,
    updates: { title?: string; order?: number },
) => {
    const list = await getListById(listId);

    if (updates.title !== undefined) {
        list.title = updates.title;
    }

    if (updates.order !== undefined) {
        list.order = updates.order;
    }

    await list.save();
    return list;
};

export const deleteList = async (listId: string): Promise<void> => {
    await getListById(listId);
    await CardModel.deleteMany({ listId });
    await ListModel.deleteOne({ _id: listId });
};
