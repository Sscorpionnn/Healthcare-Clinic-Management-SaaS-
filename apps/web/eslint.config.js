const nextConfig = require("eslint-config-next");

module.exports = [
  ...nextConfig,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
];
