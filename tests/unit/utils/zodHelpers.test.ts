import { describe, test, expect } from "@jest/globals";
import { z } from "zod";
import { requireAtLeastOneField } from "@/utils/zodHelpers.js";

describe("requireAtLeastOneField", () => {
    const schema = requireAtLeastOneField(
        z.object({ title: z.string().optional(), order: z.number().optional() }),
    );

    test("accepts a body with at least one field", () => {
        expect(schema.safeParse({ title: "New title" }).success).toBe(true);
    });

    test("rejects an empty body", () => {
        expect(schema.safeParse({}).success).toBe(false);
    });
});
