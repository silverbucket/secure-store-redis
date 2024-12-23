import securityNode from "eslint-plugin-security-node";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

export default [
    {
        ignores: [
            "**/dist",
            "**/node_modules",
            "**/test",
            "**/pnpm-lock.yaml",
            "**/coverage",
        ],
    },
    ...compat.extends(
        "eslint:recommended",
        "plugin:security-node/recommended",
        "plugin:@typescript-eslint/recommended",
    ),
    {
        plugins: {
            "security-node": securityNode,
        },

        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.mocha,
            },

            ecmaVersion: 2021,
            sourceType: "module",

            parserOptions: {
                ecmaFeatures: {
                    jsx: false,
                },
            },
        },
    },
    {
        files: ["**/*.test.ts"],
    },
];
