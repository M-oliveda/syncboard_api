import { describe, test, expect } from "@jest/globals";
import { morganFormat } from "@/utils/morganFormat.js";

describe("morganFormat", () => {
    test("uses combined logs in production", () => {
        expect(morganFormat("production")).toBe("combined");
    });

    test("uses dev logs outside production", () => {
        expect(morganFormat("development")).toBe("dev");
    });
});
