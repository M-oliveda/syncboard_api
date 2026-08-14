import { describe, test, expect, jest } from "@jest/globals";
import { z } from "zod";
import type { Request, Response } from "express";
import { validate } from "@/middleware/validate.js";
import { ValidationError } from "@/utils/errors.js";

const schema = z.object({ title: z.string().min(1) });

describe("validate", () => {
    test("replaces req.body with the parsed data and calls next on success", () => {
        const req = { body: { title: "Hello" } } as Request;
        const next = jest.fn();

        validate(schema)(req, {} as Response, next);

        expect(req.body).toEqual({ title: "Hello" });
        expect(next).toHaveBeenCalledWith();
    });

    test("calls next with a ValidationError on failure", () => {
        const req = { body: {} } as Request;
        const next = jest.fn();

        validate(schema)(req, {} as Response, next);

        expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test("falls back to 'body' for a root-level issue with no field path", () => {
        const rootRefineSchema = schema.refine(() => false, {
            message: "Invalid body",
        });
        const req = { body: { title: "Hello" } } as Request;
        const next = jest.fn();

        validate(rootRefineSchema)(req, {} as Response, next);

        const error = next.mock.calls[0]?.[0] as ValidationError;
        expect(error.detail).toContain("body: Invalid body");
    });
});
