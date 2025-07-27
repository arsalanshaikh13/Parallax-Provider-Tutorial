// ESM syntax
// import js from '@eslint/js';
// import globals from 'globals';
// import pluginJest from 'eslint-plugin-jest';
// import airbnbBase from 'eslint-config-airbnb-base';
// import prettier from 'eslint-config-prettier';

// eslint.config.js (CommonJS) syntax
const js = require('@eslint/js');
const globals = require('globals');
const pluginJest = require('eslint-plugin-jest');
const airbnbBase = require('eslint-config-airbnb-base');
const prettier = require('eslint-config-prettier');
module.exports = [
  //Base ESLint + environment setup
  {
    ignores: [
      'dist',
      'node-modules',
      '.eslintrc',
      '*.json',
      '*.yml',
      '*.css',
      'project/*',
      'test/*',
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module', // only needed when type='module' mentioned in package.json
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        ...globals.jest,
      },
    },
    plugins: {
      jest: pluginJest,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...pluginJest.configs.recommended.rules,
      ...airbnbBase.rules, //  spreads airbnb rules
      ...prettier.rules, //  disables conflicting rules
      'no-console': 'warn',
      'no-unused-vars': ['error', {vars: 'local', args: 'none'}],
      'no-plusplus': 'off',
      'no-underscore-dange': 'off',
    },
    // //Airbnb base config (rules only)
    // airbnbBase,

    // //Prettier overrides (turns off formatting-related rules)
    // prettier,
  },
];
