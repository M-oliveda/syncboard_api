/** @type {import("jest").Config} */
export default {
    preset: "ts-jest/presets/default-esm",
    extensionsToTreatAsEsm: [".ts"],
    testEnvironment: "node",
    rootDir: ".",
    testMatch: ["<rootDir>/tests/unit/**/*.test.ts"],
    transform: {
        "^.+\\.tsx?$": ["ts-jest", { useESM: true }],
    },
    moduleNameMapper: {
        "^(\\.{1,2}/.*)\\.js$": "$1",
        "^@/(.*)$": "<rootDir>/src/$1",
    },
    collectCoverageFrom: ["src/**/*.ts"],
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
