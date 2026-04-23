import path from 'path';
import { fileURLToPath } from 'url';

import nextTypescript from 'eslint-config-next/typescript';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import react from 'eslint-plugin-react';
import eslintPluginNext from '@next/eslint-plugin-next';
import eslintPluginReactHooks from 'eslint-plugin-react-hooks';
import stylisticTs from '@stylistic/eslint-plugin-ts';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

const eslint = [
  ...nextTypescript,
  ...nextCoreWebVitals,
  ...compat.extends('eslint:recommended'),
  ...compat.extends('plugin:react/recommended'),
  {
    plugins: {
      react,
      eslintPluginNext,
      eslintPluginReactHooks,
      '@stylistic/ts': stylisticTs,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'import/prefer-default-export': 0,
      'import/extensions': 0,
      'import/no-unresolved': 0,
      'react/prop-types': 0,
      'no-console': 0,
      'react/require-default-props': 0,
      'react/react-in-jsx-scope': 0,
      'react/jsx-props-no-spreading': 0,
      'functional/no-conditional-statement': 0,
      'functional/no-expression-statement': 0,
      'functional/immutable-data': 0,
      'functional/functional-parameters': 0,
      'functional/no-try-statement': 0,
      'functional/no-throw-statement': 0,
      'import/no-extraneous-dependencies': 'off',
      'class-methods-use-this': 'off',
      'consistent-return': 'off',
      'no-shadow': 'off',
      'no-return-assign': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-shadow': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-underscore-dangle': [2, {
        allow: ['__filename', '__dirname'],
      }],
      'react/function-component-definition': [2, {
        namedComponents: 'arrow-function',
      }],
      'testing-library/no-debug': 0,
      'react/jsx-filename-extension': [1, {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      }],
      'linebreak-style': 0,
      'jsx-a11y/label-has-associated-control': [2, {
        labelComponents: ['CustomInputLabel'],
        labelAttributes: ['label'],
        controlComponents: ['CustomInput'],
        depth: 3,
      }],
      'no-param-reassign': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'max-len': 'off',
      'indent': ['error', 2],
      'eol-last': ['error', 'always'],
      'key-spacing': ['error', { beforeColon: false, afterColon: true, mode: 'minimum' }],
      'object-curly-spacing': ['error', 'always'],
      'comma-spacing': ['error', { before: false, after: true }],
      'array-bracket-spacing': ['error', 'never'],
      'semi': ['error', 'always'],
      'no-extra-semi': 'error',
      'import/order': ['error', {
        'groups': ['builtin', 'external', 'internal'],
        'newlines-between': 'always',
      }],
      'quotes': ['error', 'single'],
      'comma-dangle': ['error', 'always-multiline'],
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',
      'next-env.d.ts',
    ],
  },
];

export default eslint;
