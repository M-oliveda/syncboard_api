import type { HydratedDocument } from "mongoose";
import type { User as UserAttrs } from "@/models/user.model.js";

declare global {
    namespace Express {
        interface Request {
            id?: string;
        }

        // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- declaration merging
        interface User extends HydratedDocument<UserAttrs> {}
    }
}
