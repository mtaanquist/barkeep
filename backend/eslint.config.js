import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-unused-vars": [
        "error",
        // Express spots error handlers by their four arguments, so `next`
        // has to stay even when unused.
        { argsIgnorePattern: "^(next|_)", caughtErrors: "none" },
      ],
    },
  },
];
