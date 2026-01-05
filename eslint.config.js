import vue from 'eslint-plugin-vue';
import typescript from '@vue/eslint-config-typescript';
import prettierConfig from '@vue/eslint-config-prettier';

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.vite/**'],
  },
  ...vue.configs['flat/essential'],
  ...typescript(),
  prettierConfig,
  {
    files: ['**/*.{js,mjs,cjs,vue,ts}'],
    rules: {
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'vue/multi-word-component-names': 'off',
      'vue/no-reserved-component-names': 'off',
      'vue/block-lang': 'off',
      'vue/no-deprecated-destroyed-lifecycle': 'warn',
      'vue/require-toggle-inside-transition': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'off',
    },
  },
];
