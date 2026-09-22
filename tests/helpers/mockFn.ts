import { jest } from "@jest/globals";

type LooseMock = jest.Mock<(...args: unknown[]) => PromiseLike<unknown>>;

/**
 * `jest.fn()` with no implementation is `() => unknown`, so
 * `mockResolvedValueOnce` expects `never`. This mock returns a PromiseLike
 * so both `mockResolvedValue*` and `mockReturnValue*` (e.g. FakeQuery) type-check.
 */
export const mockFn = (): LooseMock =>
    jest.fn<(...args: unknown[]) => PromiseLike<unknown>>();
