const path = require('path');

module.exports = {
  entry: './src/main.js', //input file
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    // publicPath: "/", // required for dev server routing
  },
  resolve: {
    extensions: ['.mjs', '.js', '.json'],
  },
  mode: 'development',
  devServer: {
    static: {
      directory: __dirname, // 👈 serve files from the project root
    },
    host: '0.0.0.0', // required so Docker exposes it externally
    port: 3000, // can be any port
    hot: true, // enable hot module reload - optional
    open: false, // don't auto open browser inside docker container - optional
    watchFiles: ['src/**'], // enable file watching
  },
};
