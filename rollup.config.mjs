//https://github.com/adiman9/ParallaxProvider/blob/master/rollup.config.js
// const rollupBabel = require("rollup-plugin-babel");
// import pkg from "./package.json";

// const LIB_NAME = "ParallaxProvider";

// export default {
//   input: "src/index.js",
//   output: [
//     {
//       name: LIB_NAME,
//       file: pkg.browser,
//       format: "umd",
//     },
//     {
//       name: LIB_NAME,
//       file: pkg.main,
//       format: "cjs",
//     },
//     {
//       name: LIB_NAME,
//       file: pkg.module,
//       format: "es",
//     },
//   ],
//   plugins: [
//     rollupBabel({
//       exclude: "node_modules/**",
//       babelrc: true,//deprecated
//       runtimeHelpers: false,//deprecated
//     }),
//   ],
// };

import rollupBabel from '@rollup/plugin-babel';
// import pkg from "./package.json";

const LIB_NAME = 'ParallaxProvider';

export default {
  input: 'src/index.js',
  output: [
    {
      name: LIB_NAME,
      file: 'dist/parallax-provider.umd.js',
      format: 'umd',
    },
    {
      name: LIB_NAME,
      file: 'dist/parallax-provider.cjs.js',
      format: 'cjs',
    },
    {
      name: LIB_NAME,
      file: 'dist/parallax-provider.esm.js',
      format: 'esm',
    },
  ],
  plugins: [
    rollupBabel({
      babelHelpers: 'bundled',
      exclude: 'node_modules/**',
    }),
  ],
};

// yarn --add dev @babel/core @babel/cli @babel/preset-env rollup @rollup/plugin-babel
