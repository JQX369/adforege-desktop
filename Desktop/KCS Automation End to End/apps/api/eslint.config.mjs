import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import pluginHooks from "eslint-plugin-react-hooks";
import pluginA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: null,
        ecmaVersion: 2022,
        sourceType: "module"
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    plugins: {
      react: pluginReact,
      "react-hooks": pluginHooks,
      "jsx-a11y": pluginA11y
    },
    rules: {
      ...pluginReact.configs.recommended.rules,
      ...pluginReact.configs["jsx-runtime"].rules,
      ...pluginHooks.configs.recommended.rules,
      ...pluginA11y.configs.recommended.rules,
      "react/react-in-jsx-scope": "off"
    },
    settings: {
      react: {
        version: "detect"
      }
    }
  },
  {
    files: ["**/*.config.{js,cjs,mjs}", "next.config.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        module: "readonly"
      }
    },
    rules: {
      "no-undef": "off"
    }
  }
);
