/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: [
    "<rootDir>/src/**/*.spec.ts",
    "<rootDir>/test/**/*.spec.ts",
    "<rootDir>/test/**/*.e2e-spec.ts",
  ],
  moduleFileExtensions: ["js", "json", "ts"],
  collectCoverageFrom: [
    "src/common/**/*.ts",
    "src/**/*.service.ts",
    "src/**/*.policy.ts",
  ],
};
