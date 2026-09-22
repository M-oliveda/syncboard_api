/** @type {import("jest").Config} */
export default {
    preset: "ts-jest/presets/default-esm",
    extensionsToTreatAsEsm: [".ts", ".tsx"],
    testEnvironment: "node",
    rootDir: ".",
    testMatch: ["<rootDir>/tests/unit/**/*.test.ts"],
    setupFiles: ["dotenv/config"],
    transform: {
        "^.+\\.tsx?$": ["ts-jest", { useESM: true }],
    },
    moduleNameMapper: {
        "^@/(.*)\\.js$": "<rootDir>/src/$1",
        "^(\\.{1,2}/.*)\\.js$": "$1",
    },
    // Route wiring (app.ts, routes/**) and the process entrypoint (index.ts) are
    // exercised end-to-end by the integration suite, not unit tests — see
    // README.md#test-structure.
    collectCoverageFrom: [
        "src/**/*.ts",
        "!src/routes/**",
        "!src/app.ts",
        "!src/index.ts",
        "!src/docs/**",
        "!src/types/**",
    ],
    coverageDirectory: "coverage/unit",
    coverageThreshold: {
        global: {
            statements: 100,
            branches: 100,
            functions: 100,
            lines: 100,
        },
    },
};
