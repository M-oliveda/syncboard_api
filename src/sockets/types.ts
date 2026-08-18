import type { DefaultEventsMap, Server, Socket } from "socket.io";
import type { HydratedDocument } from "mongoose";
import type { User as UserAttrs } from "@/models/user.model.js";

export interface SocketData {
    user: HydratedDocument<UserAttrs>;
    boardId?: string;
}

export type AppServer = Server<
    DefaultEventsMap,
    DefaultEventsMap,
    DefaultEventsMap,
    SocketData
>;

export type AppSocket = Socket<
    DefaultEventsMap,
    DefaultEventsMap,
    DefaultEventsMap,
    SocketData
>;
