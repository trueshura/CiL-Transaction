module.exports = {
  devServer: {
    writeToDisk: true
  },
  entry: {
    app:'./test/app.js',
    transaction: './transaction/transaction.js'
  },
  output: {
    filename: '[name].min.js',
    path: __dirname +'/dist'
  }
};