export interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface ApiSuccess<T> {
    success: true;
    data: T;
    message?: string;
}

export interface ApiCollection<T> {
    success: true;
    data: T[];
    pagination: Pagination;
}

export const successResponse = <T>(data: T, message?: string): ApiSuccess<T> => ({
    success: true,
    data,
    ...(message ? { message } : {}),
});

export const collectionResponse = <T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
): ApiCollection<T> => ({
    success: true,
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
});
