import { ListModel } from "@/models/list.model.js";
import { CardModel } from "@/models/card.model.js";
import { NotFoundError } from "@/utils/errors.js";
import { parsePagination } from "@/utils/pagination.js";
import { computeOrderBetween } from "@/utils/reorder.js";
import * as boardService from "@/services/board.service.js";

const nextAppendOrder = async (boardId: string): Promise<number> => {
    const last = await ListModel.findOne({ boardId })
        .sort({ order: -1 })
        .select("order");
    return computeOrderBetween(last?.order ?? null, null);
};

/** Raw fetch — no authorization check. Use assertListAccess for anything
 * reached from a route. */
export const getListById = async (listId: string) => {
    const list = await ListModel.findById(listId);

    if (!list) {
        throw new NotFoundError(`List ${listId} not found`);
    }

    return list;
};

export const assertListAccess = async (listId: string, userId: string) => {
    const list = await getListById(listId);
    const { board, workspace, member } = await boardService.assertBoardAccess(
        list.boardId.toString(),
        userId,
    );

    return { list, board, workspace, member };
};

export const createList = async (
    boardId: string,
    userId: string,
    title: string,
    order?: number,
) => {
    await boardService.assertBoardAccess(boardId, userId);
    const resolvedOrder = order ?? (await nextAppendOrder(boardId));
    return ListModel.create({ boardId, title, order: resolvedOrder });
};

export const listListsForBoard = async (
    boardId: string,
    userId: string,
    query: Record<string, unknown>,
) => {
    await boardService.assertBoardAccess(boardId, userId);
    const { page, limit, skip, sort } = parsePagination(query, "order");
    const filter = { boardId };

    const [items, total] = await Promise.all([
        ListModel.find(filter).sort(sort).skip(skip).limit(limit),
        ListModel.countDocuments(filter),
    ]);

    return { items, page, limit, total };
};

export const updateList = async (
    listId: string,
    userId: string,
    updates: { title?: string; order?: number },
) => {
    const { list } = await assertListAccess(listId, userId);

    if (updates.title !== undefined) {
        list.title = updates.title;
    }

    if (updates.order !== undefined) {
        list.order = updates.order;
    }

    await list.save();
    return list;
};

export const deleteList = async (listId: string, userId: string): Promise<void> => {
    const { list } = await assertListAccess(listId, userId);
    await CardModel.deleteMany({ listId: list._id });
    await ListModel.deleteOne({ _id: list._id });
};
