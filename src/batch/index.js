// src/batch/index.js
//
// Batch Requests Portal.
//
// Groups multiple q_* JSON-RPC requests into a single network payload (a
// JSON-RPC 2.0 batch array) to cut round-trips. Results are returned in the
// same order the calls were added, with per-call success/error so one failing
// call doesn't sink the whole batch.
//
//   const batch = new BatchRequest('http://127.0.0.1:9944');
//   batch.add('q_blockNumber');
//   batch.add('q_getBalance', [addr, 'latest']);
//   const results = await batch.execute();
//   // [{ success:true, result:'0x...' }, { success:true, result:'0x...' }]

'use strict';

const axios = require('axios');

class BatchRequest {
  /**
   * @param {string} endpoint - HTTP JSON-RPC endpoint.
   * @param {Object} [opts]   - { timeout }
   */
  constructor(endpoint = 'http://127.0.0.1:9944', opts = {}) {
    this.endpoint = endpoint;
    this.timeout = opts.timeout || 30000;
    this._calls = [];
    this._nextId = 1;
  }

  /**
   * Queue a call. Optionally pass a callback invoked with (error, result) when
   * the batch resolves. Returns `this` for chaining.
   */
  add(method, params = [], callback = null) {
    const id = this._nextId++;
    this._calls.push({ id, method, params, callback });
    return this;
  }

  /** Number of queued calls. */
  get length() {
    return this._calls.length;
  }

  /** Clear the queue without executing. */
  reset() {
    this._calls = [];
    this._nextId = 1;
    return this;
  }

  /**
   * Send all queued calls as one JSON-RPC batch. Returns an array (in insertion
   * order) of { success, result } or { success:false, error }.
   */
  async execute() {
    if (this._calls.length === 0) return [];

    const payload = this._calls.map((c) => ({
      jsonrpc: '2.0',
      id: c.id,
      method: c.method,
      params: c.params,
    }));

    let responseData;
    try {
      const res = await axios.post(this.endpoint, payload, {
        headers: { 'content-type': 'application/json' },
        timeout: this.timeout,
      });
      responseData = res.data;
    } catch (err) {
      const msg = err.response && err.response.data && err.response.data.error
        ? err.response.data.error.message
        : err.message;
      // Whole-batch transport failure: reject every call uniformly.
      const failure = this._calls.map((c) => {
        const out = { success: false, error: `batch request failed: ${msg}` };
        if (c.callback) c.callback(new Error(out.error), null);
        return out;
      });
      this.reset();
      return failure;
    }

    // A JSON-RPC batch returns an array of responses, not necessarily in order.
    const byId = new Map();
    if (Array.isArray(responseData)) {
      for (const r of responseData) byId.set(r.id, r);
    } else if (responseData && responseData.id !== undefined) {
      // Some servers collapse a single-element batch into one object.
      byId.set(responseData.id, responseData);
    }

    const out = this._calls.map((c) => {
      const r = byId.get(c.id);
      if (!r) {
        const res = { success: false, error: `no response for ${c.method} (id ${c.id})` };
        if (c.callback) c.callback(new Error(res.error), null);
        return res;
      }
      if (r.error) {
        const res = { success: false, error: r.error.message || JSON.stringify(r.error) };
        if (c.callback) c.callback(new Error(res.error), null);
        return res;
      }
      if (c.callback) c.callback(null, r.result);
      return { success: true, result: r.result };
    });

    this.reset();
    return out;
  }

  /**
   * Convenience: execute and return only the result values (throws on the first
   * error encountered). Use execute() when you want per-call error handling.
   */
  async executeOrThrow() {
    const results = await this.execute();
    return results.map((r) => {
      if (!r.success) throw new Error(r.error);
      return r.result;
    });
  }
}

module.exports = BatchRequest;
