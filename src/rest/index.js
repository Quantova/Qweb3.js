// src/rest/index.js
//
// QRestClient — a thin, readable client for the Quantova public REST API
// (the quantova-rest-api gateway, served under /v1). It mirrors the q_* surface
// over HTTP and is used both directly and as the JSON-RPC fallback transport for
// the contract and QNS modules.
//
// The gateway is read/relay only: it holds no keys and never signs. Writes still
// require a locally-signed raw transaction (submitRaw / POST /v1/transactions).

'use strict';

const axios = require('axios');
const { toNodeAddress } = require('../utils/keys');

// Encode a value for safe use as ONE URL path segment (neutralizes '/', '..', etc.) so a
// user-supplied address/slot/hash/block tag cannot inject extra path segments. (QWEB3-VAL-001)
const seg = (v) => encodeURIComponent(String(v));

class QRestClient {
  /**
   * @param {string} baseUrl - REST gateway base, e.g. https://api.quantova.io
   * @param {Object} [opts]  - { timeout }
   */
  constructor(baseUrl = 'http://127.0.0.1:8080', opts = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.prefix = '/v1';
    this.timeout = opts.timeout || 30000;
    this.http = axios.create({ baseURL: this.baseUrl, timeout: this.timeout });
  }

  async _get(path, params) {
    try {
      const res = await this.http.get(this.prefix + path, { params });
      return res.data;
    } catch (err) {
      throw this._wrap(err, 'GET ' + path);
    }
  }
  async _post(path, body) {
    try {
      const res = await this.http.post(this.prefix + path, body, {
        headers: { 'content-type': 'application/json' },
      });
      return res.data;
    } catch (err) {
      throw this._wrap(err, 'POST ' + path);
    }
  }
  _wrap(err, where) {
    const data = err.response && err.response.data;
    const msg = data && data.error ? data.error.message : err.message;
    return new Error(`REST ${where} failed: ${msg}`);
  }

  // ---- discovery / health ----
  index() { return this._get(''); }
  async healthz() {
    const res = await this.http.get('/healthz');
    return res.data;
  }

  // ---- accounts & state ----
  getBalance(address, block) { return this._get(`/accounts/${seg(toNodeAddress(address))}/balance`, block ? { block } : undefined); }
  getTransactionCount(address, block) { return this._get(`/accounts/${seg(toNodeAddress(address))}/transaction-count`, block ? { block } : undefined); }
  getCode(address, block) { return this._get(`/accounts/${seg(toNodeAddress(address))}/code`, block ? { block } : undefined); }
  getStorageAt(address, slot, block) { return this._get(`/contracts/${seg(toNodeAddress(address))}/storage/${seg(slot)}`, block ? { block } : undefined); }

  // ---- blocks ----
  blockLatest(hydrated) { return this._get('/blocks/latest', hydrated ? { hydrated: true } : undefined); }
  blockFinalized(hydrated) { return this._get('/blocks/finalized', hydrated ? { hydrated: true } : undefined); }
  blockByNumber(number, hydrated) { return this._get(`/blocks/number/${seg(number)}`, hydrated ? { hydrated: true } : undefined); }
  blockByHash(hash, hydrated) { return this._get(`/blocks/hash/${seg(hash)}`, hydrated ? { hydrated: true } : undefined); }
  blockTxCountByNumber(number) { return this._get(`/blocks/number/${seg(number)}/transaction-count`); }
  blockTxCountByHash(hash) { return this._get(`/blocks/hash/${seg(hash)}/transaction-count`); }

  // ---- transactions ----
  getTransaction(hash) { return this._get(`/transactions/${seg(hash)}`); }
  getTransactionReceipt(hash) { return this._get(`/transactions/${seg(hash)}/receipt`); }
  sendRawTransaction(rawTransaction) { return this._post('/transactions', { rawTransaction }); }
  call(txObject, block) { return this._post('/transactions/call', { ...txObject, block }); }
  estimateGas(txObject) { return this._post('/transactions/estimate-gas', txObject); }

  // ---- gas & fees ----
  gasPrice() { return this._get('/gas-price'); }
  feesPriority() { return this._get('/fees/priority'); }
  feesHistory(params) { return this._get('/fees/history', params); }
  feesEstimate() { return this._get('/fees/estimate'); }
  feesSimulate(txObject) { return this._post('/fees/simulate', txObject); }

  // ---- network & node ----
  chainId() { return this._get('/chain/id'); }
  networkVersion() { return this._get('/network/version'); }
  networkListening() { return this._get('/network/listening'); }
  nodeSyncing() { return this._get('/node/syncing'); }
  nodeClientVersion() { return this._get('/node/client-version'); }
  nodeAccounts() { return this._get('/node/accounts'); }

  // ---- bridge ----
  bridgeQuote(body) { return this._post('/bridge/quote', body); }
  bridgeInitiate(body) { return this._post('/bridge/initiate', body); }
  bridgeStatus(tx, params) { return this._get(`/bridge/status/${seg(tx)}`, params); }
  bridgeClaim(body) { return this._post('/bridge/claim', body); }
}

module.exports = QRestClient;
