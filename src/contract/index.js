// src/contract/index.js
//
// QVM Smart Contract class (qweb3.contract).
//
// Wraps a deployed Solidity-on-QVM contract behind a clean interface:
//
//   const c = new QContract(abi, address, { rpc, wallet, restClient });
//   const bal = await c.call('balanceOf', [addr]);          // read (q_call)
//   const txHash = await c.send('transfer', [to, amount], { from }); // write
//   const events = c.decodeLogs(receipt.logs);              // logs -> JSON
//
// Reads go through q_call (JSON-RPC) by default and fall back to the REST
// gateway's POST /v1/transactions/call when configured. Writes build calldata,
// sign locally with the post-quantum wallet, and broadcast via
// q_sendRawTransaction (REST fallback: POST /v1/transactions).

'use strict';

const abiCodec = require('../abi');

class QContract {
  /**
   * @param {Array} abi      - The contract ABI (array of fragments).
   * @param {string} address - The contract address (QVM H160).
   * @param {Object} opts
   * @param {Object} opts.rpc        - QRpcClient instance (primary transport).
   * @param {Object} [opts.wallet]   - QuantumWallet for signing send()s.
   * @param {Object} [opts.restClient] - QRestClient for fallback reads/sends.
   * @param {Object} [opts.signer]   - QuantumSigner (defaults to wallet's).
   */
  constructor(abi, address, opts = {}) {
    if (!Array.isArray(abi)) throw new Error('abi must be an array');
    if (!address) throw new Error('contract address is required');

    this.abi = abi;
    this.address = address;
    this.rpc = opts.rpc || null;
    this.wallet = opts.wallet || null;
    this.restClient = opts.restClient || null;
    this.signer = opts.signer || null;

    // Index callable functions and events by name.
    this._functions = new Map();
    this._events = new Map();
    this._eventsByTopic = new Map();

    for (const frag of abi) {
      if (frag.type === 'function' || frag.type === undefined) {
        if (frag.name) this._functions.set(frag.name, frag);
      } else if (frag.type === 'event' && frag.name) {
        const sig = abiCodec.buildSignature(frag.name, frag.inputs);
        const topic = abiCodec.eventTopic(sig);
        const enriched = { ...frag, signature: sig, topic };
        this._events.set(frag.name, enriched);
        this._eventsByTopic.set(topic.toLowerCase(), enriched);
      }
    }

    // Convenience: c.methods.transfer(...) style accessors that return calldata.
    this.methods = {};
    for (const [name, frag] of this._functions) {
      this.methods[name] = (...args) => ({
        encode: () => abiCodec.encodeFunctionCall(frag, args),
        call: (overrides) => this.call(name, args, overrides),
        send: (overrides) => this.send(name, args, overrides),
      });
    }
  }

  _getFunction(name) {
    const frag = this._functions.get(name);
    if (!frag) throw new Error(`function '${name}' not found in ABI`);
    return frag;
  }

  /** Build 0x calldata for a function + args (no network access). */
  encode(name, args = []) {
    return abiCodec.encodeFunctionCall(this._getFunction(name), args);
  }

  /**
   * Read-only call (no state change). Uses q_call (primary), REST fallback.
   * Returns the decoded output (single value if one output, else an array).
   * @param {string} name
   * @param {Array} args
   * @param {Object} [overrides] - { from, block }
   */
  async call(name, args = [], overrides = {}) {
    const frag = this._getFunction(name);
    const data = abiCodec.encodeFunctionCall(frag, args);
    const block = overrides.block || 'latest';
    const txObj = { to: this.address, data, input: data };
    if (overrides.from) txObj.from = overrides.from;

    const raw = await this._readCall(txObj, block);
    if (raw == null || raw === '0x' || raw === '') {
      return (frag.outputs && frag.outputs.length) ? null : null;
    }
    return abiCodec.decodeFunctionResult(frag, raw);
  }

  async _readCall(txObj, block) {
    // Primary: JSON-RPC q_call
    if (this.rpc) {
      try {
        return await this.rpc.callMethod(txObj, block);
      } catch (err) {
        if (!this.restClient) throw err;
        // fall through to REST
      }
    }
    // Fallback: REST gateway POST /v1/transactions/call
    if (this.restClient) {
      const res = await this.restClient.call(txObj, block === 'latest' ? undefined : block);
      return res && (res.data !== undefined ? res.data : res);
    }
    throw new Error('no transport available for contract call (need rpc or restClient)');
  }

  /**
   * State-changing call. Builds calldata, signs locally with the post-quantum
   * wallet, and broadcasts. Returns the transaction hash.
   *
   * The actual signed-extrinsic construction is delegated to the wallet's
   * buildAndSignContractTx() when available (so the post-quantum signing model
   * from @quantova lives in one place); otherwise this throws a clear error.
   *
   * @param {string} name
   * @param {Array} args
   * @param {Object} [overrides] - { from, value, gas, gasPrice, nonce }
   */
  async send(name, args = [], overrides = {}) {
    const frag = this._getFunction(name);
    if (frag.stateMutability === 'view' || frag.stateMutability === 'pure' || frag.constant) {
      throw new Error(`'${name}' is read-only; use call() instead of send()`);
    }
    const from = overrides.from;
    if (!from) throw new Error('send() requires overrides.from (signing account address)');
    if (!this.wallet) throw new Error('send() requires a wallet for post-quantum signing');

    const data = abiCodec.encodeFunctionCall(frag, args);

    // Preferred: native post-quantum write — build + PQ-sign + submit a revive.call as
    // the wallet's own native account (the path that actually executes on Quantova).
    if (typeof this.wallet.signAndSendContractTx === 'function') {
      const rpcUrl = (this.rpc && (this.rpc.endpoint || this.rpc.url)) || undefined;
      return this.wallet.signAndSendContractTx({
        rpcUrl,
        from,
        to: this.address,
        data,
        value: overrides.value || '0',
        gas: overrides.gas,
        storageDepositLimit: overrides.storageDepositLimit,
      });
    }

    // Legacy: delegate eth-format signed-extrinsic assembly (q_sendRawTransaction).
    if (typeof this.wallet.buildAndSignContractTx === 'function') {
      const signedHex = await this.wallet.buildAndSignContractTx({
        from,
        to: this.address,
        data,
        value: overrides.value || '0x0',
        gas: overrides.gas,
        gasPrice: overrides.gasPrice,
        nonce: overrides.nonce,
      });
      return this._broadcast(signedHex);
    }

    throw new Error(
      "wallet.buildAndSignContractTx() is not available — post-quantum extrinsic " +
      "assembly must be provided by the wallet/@quantova api layer to submit a write. " +
      "Use encode('" + name + "', args) to get calldata and sign/submit it yourself."
    );
  }

  async _broadcast(signedHex) {
    if (this.rpc) {
      try {
        return await this.rpc.sendRawTransaction(signedHex);
      } catch (err) {
        if (!this.restClient) throw err;
      }
    }
    if (this.restClient) {
      const res = await this.restClient.sendRawTransaction(signedHex);
      return res && (res.transactionHash !== undefined ? res.transactionHash : res);
    }
    throw new Error('no transport available to broadcast transaction');
  }

  /**
   * Estimate gas for a state-changing call without sending it.
   */
  async estimateGas(name, args = [], overrides = {}) {
    const frag = this._getFunction(name);
    const data = abiCodec.encodeFunctionCall(frag, args);
    const txObj = { to: this.address, data, input: data };
    if (overrides.from) txObj.from = overrides.from;
    if (overrides.value) txObj.value = overrides.value;

    if (this.rpc) {
      try {
        return await this.rpc.estimateGas(txObj);
      } catch (err) {
        if (!this.restClient) throw err;
      }
    }
    if (this.restClient) {
      const res = await this.restClient.estimateGas(txObj);
      return res && (res.gas !== undefined ? res.gas : res);
    }
    throw new Error('no transport available to estimate gas');
  }

  // -------------------------------------------------------------------------
  // Event log decoding
  // -------------------------------------------------------------------------

  /**
   * Decode a single raw log object into a human-readable event.
   * Expects a QVM receipt log: { topics: [...], data }.
   * Returns { name, signature, args, raw } or null if no matching ABI event.
   */
  decodeLog(log) {
    if (!log || !Array.isArray(log.topics) || log.topics.length === 0) return null;
    const topic0 = String(log.topics[0]).toLowerCase();
    const ev = this._eventsByTopic.get(topic0);
    if (!ev) return null;

    const indexed = (ev.inputs || []).filter((i) => i.indexed);
    const nonIndexed = (ev.inputs || []).filter((i) => !i.indexed);

    const args = {};
    // Indexed params come from topics[1..]; non-indexed from data.
    indexed.forEach((input, i) => {
      const topic = log.topics[i + 1];
      if (topic == null) return;
      // For value types the topic is the 32-byte word; decode it as that type.
      args[input.name || `arg${i}`] = abiCodec.decodeParameters([input.type], topic)[0];
    });

    if (nonIndexed.length > 0 && log.data && log.data !== '0x') {
      const decoded = abiCodec.decodeParameters(nonIndexed.map((i) => i.type), log.data);
      nonIndexed.forEach((input, i) => {
        args[input.name || `arg${indexed.length + i}`] = decoded[i];
      });
    }

    return { name: ev.name, signature: ev.signature, topic: ev.topic, args, raw: log };
  }

  /**
   * Decode an array of logs (e.g. receipt.logs), skipping logs whose topic does
   * not match any event in this contract's ABI.
   */
  decodeLogs(logs) {
    if (!Array.isArray(logs)) return [];
    const out = [];
    for (const log of logs) {
      const decoded = this.decodeLog(log);
      if (decoded) out.push(decoded);
    }
    return out;
  }

  /** Return the keccak topic hash for a named event (from the ABI). */
  eventTopic(name) {
    const ev = this._events.get(name);
    if (!ev) throw new Error(`event '${name}' not found in ABI`);
    return ev.topic;
  }
}

module.exports = QContract;
