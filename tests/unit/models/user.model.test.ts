import { describe, test, expect } from "@jest/globals";
import { UserModel } from "@/models/user.model.js";

describe("UserModel", () => {
    test("normalizes email to lowercase and trims whitespace", () => {
        const user = new UserModel({
            email: "  Test@Example.com  ",
            passwordHash: "hash",
        });
        expect(user.email).toBe("test@example.com");
    });

    test("requires email and passwordHash", () => {
        const user = new UserModel({});
        const error = user.validateSync();
        expect(error?.errors.email).toBeDefined();
        expect(error?.errors.passwordHash).toBeDefined();
    });

    test("passes validation with required fields present", () => {
        const user = new UserModel({ email: "test@example.com", passwordHash: "hash" });
        expect(user.validateSync()).toBeUndefined();
    });
});
