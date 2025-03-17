/**
 * Copyright (c) OpenSpug Organization. https://github.com/openspug/spug
 * Copyright (c) <spug.dev@gmail.com>
 * Released under the AGPL-3.0 License.
 */
const {override, addDecoratorsLegacy, addLessLoader, addWebpackPlugin} = require('customize-cra');
const webpack = require('webpack');

module.exports = override(
  addDecoratorsLegacy(),
  addLessLoader({
    lessOptions: {
      javascriptEnabled: true,
      modifyVars: {
        '@primary-color': '#2563fc'
      }
    }
  }),
  addWebpackPlugin(
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
        PUBLIC_URL: JSON.stringify(process.env.PUBLIC_URL || ''),
        REACT_APP_ENV: JSON.stringify(process.env.REACT_APP_ENV || 'development')
      },
      'process.browser': true
    })
  )
);
