import { BoardModel } from "@/models/board.model.js";
import { ListModel } from "@/models/list.model.js";
import { CardModel } from "@/models/card.model.js";
import { NotFoundError } from "@/utils/errors.js";
import { parsePagination } from "@/utils/pagination.js";
import { getWorkspaceById } from "@/services/workspace.service.js";

export const createBoard = async (workspaceId: string, title: string) => {
    await getWorkspaceById(workspaceId);
    return BoardModel.create({ workspaceId, title });
};

export const listBoardsForWorkspace = async (
    workspaceId: string,
    query: Record<string, unknown>,
) => {
    await getWorkspaceById(workspaceId);
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = { workspaceId };

    const [items, total] = await Promise.all([
        BoardModel.find(filter).sort(sort).skip(skip).limit(limit),
        BoardModel.countDocuments(filter),
    ]);

    return { items, page, limit, total };
};

export const getBoardById = async (boardId: string) => {
    const board = await BoardModel.findById(boardId);

    if (!board) {
        throw new NotFoundError(`Board ${boardId} not found`);
    }

    return board;
};

export const getBoardWithListsAndCards = async (boardId: string) => {
    const board = await getBoardById(boardId);
    const lists = await ListModel.find({ boardId: board._id }).sort({ order: 1 });
    const cards = await CardModel.find({
        listId: { $in: lists.map((list) => list._id) },
    }).sort({ order: 1 });

    return { board, lists, cards };
};

export const updateBoardTitle = async (boardId: string, title: string) => {
    const board = await getBoardById(boardId);
    board.title = title;
    await board.save();
    return board;
};

export const deleteBoard = async (boardId: string): Promise<void> => {
    await getBoardById(boardId);

    const lists = await ListModel.find({ boardId }).select("_id");
    const listIds = lists.map((list) => list._id);

    await CardModel.deleteMany({ listId: { $in: listIds } });
    await ListModel.deleteMany({ boardId });
    await BoardModel.deleteOne({ _id: boardId });
};
