import js from '@eslint/js'
import globals from 'globals'
import ts from 'typescript-eslint'
import solid from 'eslint-plugin-solid'
import { importX } from 'eslint-plugin-import-x'
import perfectionist from 'eslint-plugin-perfectionist'
import prettier from 'eslint-plugin-prettier/recommended'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig(
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    '.tmp/**',
  ]),
  {
    extends: [js.configs.recommended],
    files: ['**/*.{js,mjs,cjs,jsx,ts,tsx}'],
    plugins: { perfectionist, 'import-x': importX },
    rules: {
      'import-x/first': 'error',
      'prefer-template': 'error',
      'object-shorthand': 'error',
      'import-x/newline-after-import': 'error',
      'perfectionist/sort-objects': [
        'error',
        { order: 'asc', type: 'line-length' },
      ],
      'perfectionist/sort-exports': [
        'error',
        { order: 'asc', type: 'line-length' },
      ],
      'perfectionist/sort-jsx-props': [
        'error',
        { order: 'asc', type: 'line-length' },
      ],
      'perfectionist/sort-interfaces': [
        'error',
        { order: 'asc', type: 'line-length' },
      ],
      'perfectionist/sort-object-types': [
        'error',
        { order: 'asc', type: 'line-length' },
      ],
      'perfectionist/sort-named-imports': [
        'error',
        { order: 'asc', type: 'line-length' },
      ],
      'perfectionist/sort-named-exports': [
        'error',
        { order: 'asc', type: 'line-length' },
      ],
      'perfectionist/sort-imports': [
        'error',
        {
          order: 'asc',
          newlinesBetween: 1,
          type: 'line-length',
          // Style and other side-effect imports keep their execution order.
          sortSideEffects: false,
          groups: [
            ['type-builtin', 'value-builtin'],
            ['type-external', 'value-external'],
            ['type-internal', 'value-internal', 'tsconfig-path'],
            [
              'type-parent',
              'type-index',
              'value-index',
              'type-sibling',
              'value-parent',
              'value-sibling',
            ],
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [ts.configs.recommended],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
    },
  },
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportAllDeclaration',
          message: 'Use explicit exports for the public API (see AGENTS.md).',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [solid.configs.recommended],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [solid.configs.typescript],
  },
  {
    files: ['*.config.{js,mjs,cjs,ts}'],
    languageOptions: { globals: globals.node },
  },
  prettier,
  {
    rules: { curly: ['error', 'all'] },
  },
)
