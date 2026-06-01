// src/hooks/index.js
//
// Unified Event Hooks.
//
// A small EventEmitter-style layer that turns the low-level subscription manager
// and RPC polling into developer-friendly real-time hooks:
//
//   const hooks = new EventHooks({ rpc, events });   // events = EventSubscriptionManager
//   hooks.on('block', h => ...);
//   hooks.on('confirmation', ({ hash, confirmations, receipt }) => ...);
//   const tracker = hooks.track(txHash);
//   tracker.on('receipt', r => ...).on('confirmed', r => ...).on('error', e => ...);
//
// Transaction tracking polls q_getTransactionReceipt (works against any node and
// the REST fallback) and emits: 'pending' -> 'receipt' -> 'confirmed' (after N
// confirmations) or 'error'/'failed'. Block streaming uses the WebSocket
// subscription manager when available, otherwise falls back to head polling.

'use strict';

const { EventEmitter } = require('events');

function toNum(x) {
  if (x == null) return null;
  if (typeof x === 'number') return x;
  if (typeof x === 'bigint') return Number(x);
  if (typeof x === 'string') return x.startsWith('0x') ? Number(BigInt(x)) : Number(x);
  return null;
}

/** Tracks a single transaction's lifecycle. */
class TxTracker extends EventEmitter {
  constructor(hash) {
    super();
    this.hash = hash;
    this.receipt = null;
    this.confirmations = 0;
    this.done = false;
  }
  _stop() {
    this.done = true;
    this.removeAllListeners();
  }
}

class EventHooks extends EventEmitter {
  /**
   * @param {Object} opts
   * @param {Object} opts.rpc                 - QRpcClient (for receipts/heads).
   * @param {Object} [opts.events]            - EventSubscriptionManager (WS heads).
   * @param {Object} [opts.restClient]        - QRestClient (fallback receipts/heads).
   * @param {number} [opts.pollIntervalMs=2500] - poll cadence (~block time).
   * @param {number} [opts.confirmations=1]   - confirmations before 'confirmed'.
   * @param {number} [opts.timeoutMs=120000]  - give up after this long.
   */
  constructor(opts = {}) {
    super();
    this.rpc = opts.rpc || null;
    this.events = opts.events || null;
    this.restClient = opts.restClient || null;
    this.pollIntervalMs = opts.pollIntervalMs || 2500;
    this.confirmations = opts.confirmations || 1;
    this.timeoutMs = opts.timeoutMs || 120000;

    this._blockSubId = null;
    this._blockPoller = null;
    this._trackers = new Map();
    this._latestBlock = null;

    if (!this.rpc && !this.restClient) {
      throw new Error('EventHooks requires a rpc or restClient');
    }
  }

  // ---- block streaming ----

  /** Begin emitting 'block' events for new heads. Idempotent. */
  async startBlocks() {
    if (this._blockSubId || this._blockPoller) return;
    if (this.events && typeof this.events.subscribeNewHeads === 'function') {
      try {
        this._blockSubId = await this.events.subscribeNewHeads((header) => {
          const num = toNum(header && (header.number || header.blockNumber));
          if (num != null) this._latestBlock = num;
          this.emit('block', header);
        });
        return;
      } catch (e) {
        // fall back to polling
      }
    }
    this._startBlockPolling();
  }

  _startBlockPolling() {
    const tick = async () => {
      try {
        const n = await this._getBlockNumber();
        if (n != null && n !== this._latestBlock) {
          this._latestBlock = n;
          this.emit('block', { number: n });
        }
      } catch (e) {
        this.emit('error', e);
      }
    };
    this._blockPoller = setInterval(tick, this.pollIntervalMs);
    tick();
  }

  /** Stop block streaming. */
  async stopBlocks() {
    if (this._blockSubId && this.events) {
      try { await this.events.unsubscribe(this._blockSubId); } catch (e) { /* ignore */ }
      this._blockSubId = null;
    }
    if (this._blockPoller) {
      clearInterval(this._blockPoller);
      this._blockPoller = null;
    }
  }

  // ---- transaction tracking ----

  /**
   * Track a transaction by hash. Returns a TxTracker (EventEmitter) emitting:
   *   'pending'   (no receipt yet, each poll)
   *   'receipt'   (receipt first seen) -> payload: receipt
   *   'confirmed' (>= N confirmations)  -> payload: receipt
   *   'failed'    (receipt.status == 0) -> payload: receipt
   *   'error'     (transport error or timeout) -> payload: Error
   * Also re-emits 'confirmation' on the hooks instance for global listeners.
   */
  track(hash) {
    if (this._trackers.has(hash)) return this._trackers.get(hash);

    const tracker = new TxTracker(hash);
    this._trackers.set(hash, tracker);

    const started = Date.now();
    let sawReceipt = false;

    const poll = async () => {
      if (tracker.done) return;
      if (Date.now() - started > this.timeoutMs) {
        const err = new Error(`transaction ${hash} not confirmed within ${this.timeoutMs}ms`);
        tracker.emit('error', err);
        this.emit('error', err);
        this._finish(tracker);
        return;
      }
      try {
        const receipt = await this._getReceipt(hash);
        if (!receipt) {
          tracker.emit('pending', { hash });
          return;
        }
        if (!sawReceipt) {
          sawReceipt = true;
          tracker.receipt = receipt;
          tracker.emit('receipt', receipt);
          this.emit('receipt', { hash, receipt });

          const status = receipt.status;
          const failed = status != null && (toNum(status) === 0);
          if (failed) {
            tracker.emit('failed', receipt);
            this.emit('failed', { hash, receipt });
            this._finish(tracker);
            return;
          }
        }

        // Count confirmations from current head vs receipt block.
        const head = await this._getBlockNumber();
        const mined = toNum(receipt.blockNumber);
        if (head != null && mined != null) {
          tracker.confirmations = Math.max(0, head - mined + 1);
          this.emit('confirmation', { hash, confirmations: tracker.confirmations, receipt });
          tracker.emit('confirmation', { confirmations: tracker.confirmations, receipt });
          if (tracker.confirmations >= this.confirmations) {
            tracker.emit('confirmed', receipt);
            this.emit('confirmed', { hash, receipt });
            this._finish(tracker);
          }
        }
      } catch (e) {
        tracker.emit('error', e);
        this.emit('error', e);
        // keep polling on transient errors unless timed out
      }
    };

    tracker._interval = setInterval(poll, this.pollIntervalMs);
    poll();
    return tracker;
  }

  _finish(tracker) {
    if (tracker._interval) clearInterval(tracker._interval);
    this._trackers.delete(tracker.hash);
    // defer cleanup so final listeners fire
    setImmediate(() => tracker._stop());
  }

  /** Promise that resolves with the receipt once confirmed (or rejects). */
  waitForReceipt(hash) {
    return new Promise((resolve, reject) => {
      const t = this.track(hash);
      t.once('confirmed', resolve);
      t.once('failed', (r) => reject(Object.assign(new Error('transaction reverted'), { receipt: r })));
      t.once('error', reject);
    });
  }

  /** Stop tracking a specific tx. */
  untrack(hash) {
    const t = this._trackers.get(hash);
    if (t) this._finish(t);
  }

  /** Tear everything down. */
  async destroy() {
    await this.stopBlocks();
    for (const hash of Array.from(this._trackers.keys())) this.untrack(hash);
    this.removeAllListeners();
  }

  // ---- transport helpers (rpc primary, rest fallback) ----

  async _getReceipt(hash) {
    if (this.rpc) {
      try { return await this.rpc.getTransactionReceipt(hash); }
      catch (e) { if (!this.restClient) throw e; }
    }
    if (this.restClient) {
      try {
        const r = await this.restClient.getTransactionReceipt(hash);
        return r;
      } catch (e) {
        // REST returns 404 (thrown) when not yet mined -> treat as pending
        return null;
      }
    }
    return null;
  }

  async _getBlockNumber() {
    if (this.rpc) {
      try { return toNum(await this.rpc.blockNumber()); }
      catch (e) { if (!this.restClient) throw e; }
    }
    if (this.restClient) {
      const b = await this.restClient.blockLatest();
      return toNum(b && b.number);
    }
    return null;
  }
}

module.exports = EventHooks;
module.exports.TxTracker = TxTracker;
