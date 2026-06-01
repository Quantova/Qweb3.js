// src/errors/index.js

// Import all custom error classes
const ConnectionError = require('./connectionError');
const InvalidArgumentError = require('./invalidArgError');
const RpcError = require('./rpcError');
const TransactionError = require('./transactionError');

// Export all error classes in a single object
module.exports = {
  ConnectionError,
  InvalidArgumentError,
  RpcError,
  TransactionError,
};

