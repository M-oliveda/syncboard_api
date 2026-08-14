import { BoardModel } from "@/models/board.model.js";
import { ListModel } from "@/models/list.model.js";
import { CardModel } from "@/models/card.model.js";
import { NotFoundError } from "@/utils/errors.js";
import { parsePagination } from "@/utils/pagination.js";
import * as workspaceService from "@/services/workspace.service.js";

/** Raw fetch — no authorization check. Use assertBoardAccess for anything
 * reached from a route. */
export const getBoardById = async (boardId: string) => {
    const board = await BoardModel.findById(boardId);

    if (!board) {
        throw new NotFoundError(`Board ${boardId} not found`);
    }

    return board;
};

export const assertBoardAccess = async (boardId: string, userId: string) => {
    const board = await getBoardById(boardId);
    const { workspace, member } = await workspaceService.assertWorkspaceAccess(
        board.workspaceId.toString(),
        userId,
    );

    return { board, workspace, member };
};

export const createBoard = async (
    workspaceId: string,
    userId: string,
    title: string,
) => {
    await workspaceService.assertWorkspaceAccess(workspaceId, userId);
    return BoardModel.create({ workspaceId, title });
};

export const listBoardsForWorkspace = async (
    workspaceId: string,
    userId: string,
    query: Record<string, unknown>,
) => {
    await workspaceService.assertWorkspaceAccess(workspaceId, userId);
    const { page, limit, skip, sort } = parsePagination(query);
    const filter = { workspaceId };

    const [items, total] = await Promise.all([
        BoardModel.find(filter).sort(sort).skip(skip).limit(limit),
        BoardModel.countDocuments(filter),
    ]);

    return { items, page, limit, total };
};

export const getBoardWithListsAndCards = async (boardId: string, userId: string) => {
    const { board } = await assertBoardAccess(boardId, userId);
    const lists = await ListModel.find({ boardId: board._id }).sort({ order: 1 });
    const cards = await CardModel.find({
        listId: { $in: lists.map((list) => list._id) },
    }).sort({ order: 1 });

    return { board, lists, cards };
};

export const updateBoardTitle = async (
    boardId: string,
    userId: string,
    title: string,
) => {
    const { board } = await assertBoardAccess(boardId, userId);
    board.title = title;
    await board.save();
    return board;
};

export const deleteBoard = async (boardId: string, userId: string): Promise<void> => {
    const { board } = await assertBoardAccess(boardId, userId);

    const lists = await ListModel.find({ boardId: board._id }).select("_id");
    const listIds = lists.map((list) => list._id);

    await CardModel.deleteMany({ listId: { $in: listIds } });
    await ListModel.deleteMany({ boardId: board._id });
    await BoardModel.deleteOne({ _id: board._id });
};
