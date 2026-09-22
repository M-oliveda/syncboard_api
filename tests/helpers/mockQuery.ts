import { jest } from "@jest/globals";

/** A chainable, awaitable stand-in for a Mongoose Query, for mocked-model unit tests. */
export interface FakeQuery<T> extends PromiseLike<T> {
    sort: jest.Mock;
    skip: jest.Mock;
    limit: jest.Mock;
    select: jest.Mock;
    populate: jest.Mock;
}

export const createFakeQuery = <T>(result: T): FakeQuery<T> => {
    const query = {} as FakeQuery<T>;
    query.sort = jest.fn(() => query);
    query.skip = jest.fn(() => query);
    query.limit = jest.fn(() => query);
    query.select = jest.fn(() => query);
    query.populate = jest.fn(() => query);
    query.then = ((onFulfilled, onRejected) =>
        Promise.resolve(result).then(
            onFulfilled,
            onRejected,
        )) as PromiseLike<T>["then"];
    return query;
};
