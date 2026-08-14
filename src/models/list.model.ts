import { Schema, model, type InferSchemaType } from "mongoose";

const listSchema = new Schema(
    {
        boardId: {
            type: Schema.Types.ObjectId,
            ref: "Board",
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        order: {
            type: Number,
            required: true,
        },
    },
    { timestamps: true },
);

listSchema.index({ boardId: 1, order: 1 });

export type List = InferSchemaType<typeof listSchema>;

export const ListModel = model<List>("List", listSchema);
