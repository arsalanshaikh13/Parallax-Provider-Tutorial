// deprecated version
/// module.exports = {
//   linters: {
//     '**/*.+(js|md|css|json|yaml|scss|sass)': [
//       'eslint --fix',
//       'prettier --write',
//       'jest --findRelatedTests',
//       'git add',
//     ],
//   },
// };

// lint-staged.config.js modern version
module.exports = {
  // '**/*.{js,md,css,json,yaml,scss,sass}': [
  //   'eslint --fix',
  //   'prettier --write',
  //   'jest --findRelatedTests   ',
  //   //'git add', lint-stage v10+ does this internally
  // ],

  // 1. Files that should be linted and formatted (most code files)
  '**/*.{js,jsx,ts,tsx}': [
    'eslint --fix', // Run ESLint with auto-fix for JavaScript/TypeScript files
    'prettier --write', // Format JavaScript/TypeScript files
    // Run Jest for these code files to find and execute related tests
    // Using `yarn jest` instead of `jest` to ensure it uses the project's installed Jest
    ' jest --findRelatedTests --passWithNoTests ',
  ],

  // 2. Files that only need formatting (e.g., Markdown, JSON, CSS, etc.)
  '**/*.{md,json,css,scss,sass,yaml,yml}': [
    'prettier --write', // Only format these files
  ],
};
