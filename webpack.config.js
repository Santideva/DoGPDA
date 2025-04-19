const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development', // Switch to development for local testing
  entry: './src/index.js',

  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true, // Clean the dist folder before each build
  },

  module: {
    rules: [
      // → JavaScript with Babel
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },

      // → CSS handling
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },

      // Add more loaders here if you deal with images, shaders, etc.
    ],
  },

  resolve: {
    extensions: ['.js', '.json'],
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html', // use your existing HTML template
      filename: 'index.html',       // will emit into dist/index.html
    }),
  ],

  devServer: {
    static: './dist',
    open: true,          // open in browser automatically
    hot: true,           // enable hot module replacement
    port: 8080,          // optional: customize dev server port
  },
};
