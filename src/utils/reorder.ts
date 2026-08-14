const FIRST_ITEM_ORDER = 1;

/**
 * Computes a fractional order value that sits between two siblings, so a
 * card/list move only ever writes the moved document — never its siblings.
 */
export const computeOrderBetween = (
    prev: number | null,
    next: number | null,
): number => {
    if (prev === null && next === null) {
        return FIRST_ITEM_ORDER;
    }

    if (prev === null) {
        return (next as number) - 1;
    }

    if (next === null) {
        return prev + 1;
    }

    return (prev + next) / 2;
};
