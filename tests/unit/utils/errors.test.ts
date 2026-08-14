import { describe, test, expect } from "@jest/globals";
import {
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthenticatedError,
    ValidationError,
} from "@/utils/errors.js";

describe("domain error classes", () => {
    test("ValidationError carries a 400 status and RFC 7807 fields", () => {
        const error = new ValidationError("title is required");
        expect(error.status).toBe(400);
        expect(error.type).toBe("https://syncboard.dev/errors/validation-error");
        expect(error.title).toBe("Validation Error");
        expect(error.detail).toBe("title is required");
        expect(error.message).toBe("title is required");
        expect(error.name).toBe("ValidationError");
        expect(error).toBeInstanceOf(Error);
    });

    test("UnauthenticatedError carries a 401 status", () => {
        const error = new UnauthenticatedError("Missing token");
        expect(error.status).toBe(401);
        expect(error.type).toBe("https://syncboard.dev/errors/unauthenticated");
    });

    test("NotFoundError carries a 404 status", () => {
        const error = new NotFoundError("Board x not found");
        expect(error.status).toBe(404);
        expect(error.type).toBe("https://syncboard.dev/errors/not-found");
    });

    test("ConflictError carries a 409 status", () => {
        const error = new ConflictError("Already exists");
        expect(error.status).toBe(409);
        expect(error.type).toBe("https://syncboard.dev/errors/conflict");
    });

    test("ForbiddenError carries a 403 status", () => {
        const error = new ForbiddenError("Admin role required");
        expect(error.status).toBe(403);
        expect(error.type).toBe("https://syncboard.dev/errors/forbidden");
    });
});
