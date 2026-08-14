const ERROR_BASE_URI = "https://syncboard.dev/errors";

export abstract class AppError extends Error {
    abstract readonly status: number;
    abstract readonly type: string;
    abstract readonly title: string;

    constructor(
        public readonly detail: string,
        options?: { cause?: unknown },
    ) {
        super(detail, options);
        this.name = this.constructor.name;
    }
}

export class ValidationError extends AppError {
    readonly status = 400;
    readonly type = `${ERROR_BASE_URI}/validation-error`;
    readonly title = "Validation Error";
}

export class UnauthenticatedError extends AppError {
    readonly status = 401;
    readonly type = `${ERROR_BASE_URI}/unauthenticated`;
    readonly title = "Unauthenticated";
}

export class NotFoundError extends AppError {
    readonly status = 404;
    readonly type = `${ERROR_BASE_URI}/not-found`;
    readonly title = "Not Found";
}

export class ConflictError extends AppError {
    readonly status = 409;
    readonly type = `${ERROR_BASE_URI}/conflict`;
    readonly title = "Conflict";
}
