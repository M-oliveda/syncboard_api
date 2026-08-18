/** @type {import("jest").Config} */
export default {
    preset: "ts-jest/presets/default-esm",
    extensionsToTreatAsEsm: [".ts", ".tsx"],
    testEnvironment: "node",
    rootDir: ".",
    testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
    // Every integration test file shares one real MongoDB database via
    // tests/setup.ts, which wipes all collections after each test — running
    // files in parallel workers races that wipe against other files' data.
    maxWorkers: 1,
    // MongoDB may still be coming up (Compose healthcheck / Atlas handshake).
    testTimeout: 30000,
    setupFiles: ["dotenv/config"],
    setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
    transform: {
        "^.+\\.tsx?$": ["ts-jest", { useESM: true }],
    },
    moduleNameMapper: {
        "^@/(.*)\\.js$": "<rootDir>/src/$1",
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
    // Route wiring + app.ts are this tier's own surface area — everything else
    // (services/models/middleware/utils/config) is unit-tested against 100%
    // in jest.config.js, so re-demanding 100% of it here via HTTP would force
    // duplicate coverage of branches (env validation, log formatting, etc.)
    // that integration tests can't reasonably reach through a live server.
    collectCoverageFrom: ["src/routes/**/*.ts", "src/app.ts"],
    coverageDirectory: "coverage/integration",
    coverageThreshold: {
        global: {
            statements: 100,
            branches: 100,
            functions: 100,
            lines: 100,
        },
    },
};
