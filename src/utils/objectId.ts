import { Types } from "mongoose";
import { z } from "zod";

export const objectIdString = z
    .string()
    .refine((value) => Types.ObjectId.isValid(value), { message: "Invalid id" });
