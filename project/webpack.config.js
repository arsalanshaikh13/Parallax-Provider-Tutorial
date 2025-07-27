const path = require('path');

module.exports = {
  entry: './src/main.js', //input file
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    // publicPath: "/", // required for dev server routing
  },
  mode: 'development',
  devServer: {
    static: {
      directory: __dirname, // 👈 serve files from the project root
    },
  },
};
