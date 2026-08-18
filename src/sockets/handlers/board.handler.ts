import * as boardService from "@/services/board.service.js";
import { BoardJoinSchema } from "@/sockets/schemas.js";
import { emitSocketError } from "@/sockets/socketError.js";
import { parseSocketPayload } from "@/sockets/validate.js";
import type { AppServer, AppSocket } from "@/sockets/types.js";

const boardRoom = (boardId: string): string => `board:${boardId}`;

const broadcastPresence = async (io: AppServer, boardId: string): Promise<void> => {
    const sockets = await io.in(boardRoom(boardId)).fetchSockets();
    const activeUsers = sockets.map((remoteSocket) => ({
        userId: remoteSocket.data.user._id.toString(),
        email: remoteSocket.data.user.email,
    }));

    io.to(boardRoom(boardId)).emit("board:user-presence", { boardId, activeUsers });
};

export const registerBoardHandlers = (io: AppServer, socket: AppSocket): void => {
    socket.on("board:join", async (payload: unknown) => {
        try {
            const { boardId } = parseSocketPayload(BoardJoinSchema, payload);
            const userId = socket.data.user._id.toString();
            await boardService.assertBoardAccess(boardId, userId);

            socket.data.boardId = boardId;
            await socket.join(boardRoom(boardId));
            await broadcastPresence(io, boardId);
        } catch (error) {
            emitSocketError(socket, error);
        }
    });

    socket.on("disconnect", async () => {
        const { boardId } = socket.data;
        if (boardId) {
            await broadcastPresence(io, boardId);
        }
    });
};
