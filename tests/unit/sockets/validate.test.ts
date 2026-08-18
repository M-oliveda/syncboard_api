import { describe, test, expect } from "@jest/globals";
import { z } from "zod";
import { parseSocketPayload } from "@/sockets/validate.js";
import { ValidationError } from "@/utils/errors.js";

const schema = z.object({ boardId: z.string().min(1) });

describe("parseSocketPayload", () => {
    test("returns the parsed data on success", () => {
        const result = parseSocketPayload(schema, { boardId: "abc" });
        expect(result).toEqual({ boardId: "abc" });
    });

    test("throws a ValidationError with a joined detail on failure", () => {
        expect(() => parseSocketPayload(schema, { boardId: "" })).toThrow(
            ValidationError,
        );
    });

    test("falls back to 'payload' for a root-level issue with no field path", () => {
        const rootRefineSchema = schema.refine(() => false, {
            message: "Invalid payload",
        });

        try {
            parseSocketPayload(rootRefineSchema, { boardId: "abc" });
            throw new Error("expected parseSocketPayload to throw");
        } catch (error) {
            expect(error).toBeInstanceOf(ValidationError);
            expect((error as ValidationError).detail).toContain(
                "payload: Invalid payload",
            );
        }
    });
});
