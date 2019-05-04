const path = require('path');
module.exports = [
  {
    name: 'umd',
    mode: 'production',
    target: "web",

    entry: {
      transaction: './transaction/transaction.js'
    },
    output: {
      filename: '[name].min.js',
      path: __dirname + '/dist',
      library: 'Transaction',
      libraryTarget: 'umd',
      umdNamedDefine: true,
    }
  },
  {
    name: 'test',
    devServer: {
      contentBase: path.join(__dirname, 'test'),
      writeToDisk: false
    },
    entry: './test/app.js',
    output: {
      filename: 'app.min.js',
      path: __dirname + '/test'
    }
  }
];