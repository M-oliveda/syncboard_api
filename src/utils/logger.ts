import winston from "winston";

const { combine, timestamp, json, colorize, printf } = winston.format;

const devFormat = combine(
    colorize(),
    timestamp(),
    printf(({ level, message, timestamp: time, ...meta }) => {
        const metaString =
            Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";
        return `${String(time)} ${level}: ${String(message)}${metaString}`;
    }),
);

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL ?? "info",
    format:
        process.env.NODE_ENV === "production"
            ? combine(timestamp(), json())
            : devFormat,
    transports: [new winston.transports.Console()],
});
