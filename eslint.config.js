import js from '@eslint/js'
import ts from 'typescript-eslint'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'

export default ts.config(
  { ignores: ['dist/', 'dist-single/', 'node_modules/', 'tests/fixtures/out/', 'test-results/', 'playwright-report/', '.venv/', 'bench/'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  { files: ['**/*.svelte', '**/*.svelte.ts'], languageOptions: { parserOptions: { parser: ts.parser } } },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // contract-only rule: the app must never import PhosKinTime code
      'no-restricted-imports': ['error', { patterns: ['phoskintime', 'phoskintime/*', 'networkmodel*', 'protwise*'] }],
      'svelte/require-each-key': 'off',
      'svelte/prefer-svelte-reactivity': 'off',
    },
  },
)
