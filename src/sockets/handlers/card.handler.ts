import * as cardService from "@/services/card.service.js";
import * as listService from "@/services/list.service.js";
import { CardMovedSchema } from "@/sockets/schemas.js";
import { emitSocketError } from "@/sockets/socketError.js";
import { parseSocketPayload } from "@/sockets/validate.js";
import type { AppServer, AppSocket } from "@/sockets/types.js";

export const registerCardHandlers = (io: AppServer, socket: AppSocket): void => {
    socket.on("card:moved", async (payload: unknown) => {
        try {
            const { cardId, targetListId, newOrder } = parseSocketPayload(
                CardMovedSchema,
                payload,
            );
            const userId = socket.data.user._id.toString();
            const card = await cardService.updateCard(cardId, userId, {
                listId: targetListId,
                order: newOrder,
            });

            const list = await listService.getListById(targetListId);
            io.to(`board:${list.boardId.toString()}`).emit("card:updated", card);
        } catch (error) {
            emitSocketError(socket, error);
        }
    });
};
