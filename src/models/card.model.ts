import { Schema, model, type InferSchemaType } from "mongoose";

const checklistItemSchema = new Schema(
    {
        text: {
            type: String,
            required: true,
            trim: true,
        },
        done: {
            type: Boolean,
            default: false,
        },
    },
    { _id: false },
);

const cardSchema = new Schema(
    {
        listId: {
            type: Schema.Types.ObjectId,
            ref: "List",
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            default: "",
        },
        order: {
            type: Number,
            required: true,
        },
        assignees: {
            type: [{ type: Schema.Types.ObjectId, ref: "User" }],
            default: [],
        },
        labels: {
            type: [String],
            default: [],
        },
        checklist: {
            type: [checklistItemSchema],
            default: [],
        },
    },
    { timestamps: true },
);

cardSchema.index({ listId: 1, order: 1 });

export type Card = InferSchemaType<typeof cardSchema>;

export const CardModel = model<Card>("Card", cardSchema);
