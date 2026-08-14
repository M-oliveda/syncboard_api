import { Router } from "express";
import { authRouter } from "@/routes/v1/auth.routes.js";
import { workspaceRouter } from "@/routes/v1/workspace.routes.js";
import { boardRouter } from "@/routes/v1/board.routes.js";
import { listRouter } from "@/routes/v1/list.routes.js";
import { cardRouter } from "@/routes/v1/card.routes.js";

export const v1Router = Router();

v1Router.use("/auth", authRouter);
v1Router.use("/workspaces", workspaceRouter);
v1Router.use("/boards", boardRouter);
v1Router.use("/lists", listRouter);
v1Router.use("/cards", cardRouter);
