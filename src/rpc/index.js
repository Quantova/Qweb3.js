// src/rpc/index.js

const axios = require('axios');
const { toNodeAddress } = require('../utils/keys');

class QRpcClient {
  constructor(endpoint = 'http://127.0.0.1:9944') {
    this.endpoint = endpoint;
    this.id = 1;
  }

  /**
   * Helper to perform a JSON-RPC call.
   */
  async call(method, params = []) {
    const payload = {
      jsonrpc: '2.0',
      id: this.id++,
      method: method,
      params: params
    };

    try {
      const response = await axios.post(this.endpoint, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });

      const result = response.data;
      if (result.error) {
        throw new Error(result.error.message || JSON.stringify(result.error));
      }
      return result.result;
    } catch (error) {
      const errMsg = error.response && error.response.data && error.response.data.error
        ? error.response.data.error.message
        : error.message;
      throw new Error(`RPC call failed for ${method}: ${errMsg}`);
    }
  }

  // --- 27 Custom q_* RPC methods ---
  async accounts() {
    return this.call('q_accounts', []);
  }

  async blockNumber() {
    return this.call('q_blockNumber', []);
  }

  async callMethod(tx, block = 'latest') {
    return this.call('q_call', [tx, block]);
  }

  async chainId() {
    return this.call('q_chainId', []);
  }

  async estimateGas(tx) {
    return this.call('q_estimateGas', [tx]);
  }

  async gasPrice() {
    return this.call('q_gasPrice', []);
  }

  async getBalance(address, block = 'latest') {
    return this.call('q_getBalance', [toNodeAddress(address), block]);
  }

  async getBlockByHash(hash, fullTxs = false) {
    return this.call('q_getBlockByHash', [hash, fullTxs]);
  }

  async getBlockByNumber(block, fullTxs = false) {
    return this.call('q_getBlockByNumber', [block, fullTxs]);
  }

  async getBlockTransactionCountByHash(hash) {
    return this.call('q_getBlockTransactionCountByHash', [hash]);
  }

  async getBlockTransactionCountByNumber(block) {
    return this.call('q_getBlockTransactionCountByNumber', [block]);
  }

  async getCode(address, block = 'latest') {
    return this.call('q_getCode', [toNodeAddress(address), block]);
  }

  async getLogs(filter) {
    return this.call('q_getLogs', [filter]);
  }

  async getStorageAt(address, position, block = 'latest') {
    return this.call('q_getStorageAt', [toNodeAddress(address), position, block]);
  }

  async getTransactionByBlockHashAndIndex(hash, index) {
    return this.call('q_getTransactionByBlockHashAndIndex', [hash, index]);
  }

  async getTransactionByBlockNumberAndIndex(block, index) {
    return this.call('q_getTransactionByBlockNumberAndIndex', [block, index]);
  }

  async getTransactionByHash(hash) {
    return this.call('q_getTransactionByHash', [hash]);
  }

  async getTransactionCount(address, block = 'latest') {
    return this.call('q_getTransactionCount', [toNodeAddress(address), block]);
  }

  async getTransactionReceipt(hash) {
    return this.call('q_getTransactionReceipt', [hash]);
  }

  async maxPriorityFeePerGas() {
    return this.call('q_maxPriorityFeePerGas', []);
  }

  async sendRawTransaction(signedTxHex) {
    return this.call('q_sendRawTransaction', [signedTxHex]);
  }

  async sendTransaction(tx) {
    return this.call('q_sendTransaction', [tx]);
  }

  async syncing() {
    return this.call('q_syncing', []);
  }

  async listening() {
    return this.call('q_listening', []);
  }

  async net_version() {
    return this.call('q_net_version', []);
  }

  async web3_clientVersion() {
    return this.call('q_web3_clientVersion', []);
  }

  async feeHistory(blockCount, newestBlock, rewardPercentiles = []) {
    return this.call('q_feeHistory', [blockCount, newestBlock, rewardPercentiles]);
  }
}

module.exports = QRpcClient;
