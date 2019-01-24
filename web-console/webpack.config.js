const process = require('process');
const path = require('path');
const webpack = require('webpack');
const postcssPresetEnv = require('postcss-preset-env');

const { version } = require('./package.json');

module.exports = env => ({
  mode: process.env.NODE_ENV || 'development',
  entry: {
    'web-console': './src/entry.ts'
  },
  output: {
    path: path.resolve(__dirname, './public'),
    filename: `[name]-${version}.js`,
    chunkFilename: `[name]-${version}.js`,
    publicPath: '/public'
  },
  target: 'web',
  resolve: {
    extensions: ['.tsx', '.ts', '.html', '.js', '.json', '.scss', '.css']
  },
  devServer: {
    publicPath: '/public',
    index: './index.html',
    port: 18081,
    proxy: {
      '/status': `http://${(env || {}).host || 'localhost:8888'}`,
      '/druid': `http://${(env || {}).host || 'localhost:8888'}`
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.s?css$/,
        use: [
            {loader: 'style-loader'}, // creates style nodes from JS strings
            {loader: 'css-loader'}, // translates CSS into CommonJS
            { loader: 'postcss-loader',
              options: {
                ident: 'postcss',
                plugins: () => [
                  postcssPresetEnv({
                    browsers: ['> 1%', 'last 3 versions', 'Firefox ESR', 'Opera 12.1']
                  })
                ]
              }
            },
            {loader: 'sass-loader'} // compiles Sass to CSS, using Node Sass by default
        ]
      },
        {
        test: /\.(png|jpg)$/,
        loader: 'file-loader',
        options: {
          name: 'images/[name].[ext]'
        }
      }
    ]
  },

  plugins: [
    // From: https://stackoverflow.com/questions/25384360/how-to-prevent-moment-js-from-loading-locales-with-webpack/25426019#25426019
    new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/)
  ]
});