// Shared ESLint flat config base. Consuming packages spread this and add
// their own environment-specific overrides (NestJS decorators, Next.js
// rules, etc).
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");
const prettier = require("eslint-config-prettier");

module.exports = [
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: "module",
        ecmaVersion: "latest",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      // Tenant-isolation discipline: raw/unscoped Prisma escape hatches are
      // flagged so a reviewer sees every use (see docs/multi-tenancy.md).
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[property.name='queryRawUnsafe']",
          message:
            "queryRawUnsafe bypasses parameterization — use parameterized $queryRaw or a Prisma query builder call instead.",
        },
        {
          selector: "MemberExpression[property.name='executeRawUnsafe']",
          message:
            "executeRawUnsafe bypasses parameterization — confirm this is not building SQL from request input.",
        },
      ],
    },
  },
  prettier,
  {
    ignores: [
      "dist/**",
      "generated/**",
      ".next/**",
      "node_modules/**",
      "coverage/**",
    ],
  },
];
