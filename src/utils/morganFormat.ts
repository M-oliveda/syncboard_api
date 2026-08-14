/** Structured "combined" logs in production; concise colored "dev" logs elsewhere. */
export const morganFormat = (nodeEnv: string): "combined" | "dev" => {
    return nodeEnv === "production" ? "combined" : "dev";
};
