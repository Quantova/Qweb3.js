// src/provider/index.js

const BrowserProvider = require('./browserProvider');
const RpcProvider = require('./rpcProvider').default || require('./rpcProvider');

module.exports = {
    BrowserProvider,
    RpcProvider
};
