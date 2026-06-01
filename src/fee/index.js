// src/fee/index.js
//
// Dynamic Fee & Gas Oracle.
//
// Computes optimal gas price / priority-fee suggestions from recent QVM network
// activity (q_feeHistory + q_gasPrice + q_maxPriorityFeePerGas), exposing
// slow / standard / fast tiers. Uses the JSON-RPC client primarily and the REST
// gateway (/v1/fees/*) as a fallback when configured.
//
//   const oracle = new FeeOracle({ rpc, restClient });
//   const fees = await oracle.estimate();
//   // { baseFeePerGas, maxPriorityFeePerGas, maxFeePerGas, tiers:{slow,standard,fast} }

'use strict';

function toBig(x) {
  if (typeof x === 'bigint') return x;
  if (typeof x === 'number') return BigInt(x);
  if (typeof x === 'string') return x.startsWith('0x') ? BigInt(x) : BigInt(x);
  throw new Error(`cannot convert to BigInt: ${x}`);
}
function hex(b) {
  return '0x' + b.toString(16);
}

class FeeOracle {
  /**
   * @param {Object} opts
   * @param {Object} [opts.rpc]        - QRpcClient (primary).
   * @param {Object} [opts.restClient] - QRestClient (fallback).
   * @param {number} [opts.historyBlocks=5]  - blocks of history to sample.
   * @param {number[]} [opts.percentiles]    - reward percentiles for tiers.
   */
  constructor(opts = {}) {
    this.rpc = opts.rpc || null;
    this.restClient = opts.restClient || null;
    this.historyBlocks = opts.historyBlocks || 5;
    this.percentiles = opts.percentiles || [25, 50, 75];
    if (!this.rpc && !this.restClient) {
      throw new Error('FeeOracle requires a rpc or restClient');
    }
  }

  /** Current base gas price (BigInt). */
  async gasPrice() {
    if (this.rpc) {
      try { return toBig(await this.rpc.gasPrice()); } catch (e) { if (!this.restClient) throw e; }
    }
    const r = await this.restClient.gasPrice();
    return toBig(r.gasPrice !== undefined ? r.gasPrice : r);
  }

  /** Current suggested priority fee (BigInt), with a derived fallback. */
  async maxPriorityFeePerGas() {
    if (this.rpc) {
      try { return toBig(await this.rpc.maxPriorityFeePerGas()); } catch (e) { if (!this.restClient) throw e; }
    }
    if (this.restClient) {
      try {
        const r = await this.restClient.feesPriority();
        return toBig(r.maxPriorityFeePerGas !== undefined ? r.maxPriorityFeePerGas : r);
      } catch (e) { /* derive below */ }
    }
    const base = await this.gasPrice();
    return (base * 20n) / 100n;
  }

  /** Raw fee history (passes through to q_feeHistory / REST). */
  async feeHistory(blockCount = this.historyBlocks, newestBlock = 'latest', percentiles = this.percentiles) {
    if (this.rpc) {
      try { return await this.rpc.feeHistory(typeof blockCount === 'number' ? hex(BigInt(blockCount)) : blockCount, newestBlock, percentiles); }
      catch (e) { if (!this.restClient) throw e; }
    }
    const params = { blockCount, rewardPercentiles: percentiles.join(',') };
    if (newestBlock && newestBlock !== 'latest') params.newestBlock = newestBlock;
    return await this.restClient.feesHistory(params);
  }

  /**
   * Compute slow/standard/fast priority-fee tiers by averaging the reward
   * percentiles across recent blocks. Falls back to scaling the suggested
   * priority fee if history is empty/unavailable.
   */
  async tiers() {
    let history;
    try {
      history = await this.feeHistory();
    } catch (e) {
      history = null;
    }
    const rewards = history && history.reward;
    if (Array.isArray(rewards) && rewards.length > 0) {
      let slow = 0n, std = 0n, fast = 0n, n = 0n;
      for (const row of rewards) {
        if (Array.isArray(row) && row.length >= 3) {
          slow += toBig(row[0]);
          std += toBig(row[1]);
          fast += toBig(row[2]);
          n += 1n;
        }
      }
      if (n > 0n) {
        return { slow: hex(slow / n), standard: hex(std / n), fast: hex(fast / n) };
      }
    }
    // Fallback: derive from the suggested priority fee.
    const p = await this.maxPriorityFeePerGas();
    return { slow: hex((p * 50n) / 100n), standard: hex(p), fast: hex((p * 150n) / 100n) };
  }

  /**
   * Full dynamic-fee estimate: base fee, suggested priority fee, a max fee
   * (base + priority), and the slow/standard/fast tiers. All values 0x-hex.
   * Quantova fee model is no-burn: base fee -> treasury, tip -> validator.
   */
  async estimate() {
    const base = await this.gasPrice();
    const priority = await this.maxPriorityFeePerGas();
    const tiers = await this.tiers();
    return {
      baseFeePerGas: hex(base),
      maxPriorityFeePerGas: hex(priority),
      maxFeePerGas: hex(base + priority),
      tiers,
      model: 'quantova-dynamic-no-burn',
    };
  }

  /**
   * Estimate the total fee for a specific transaction: gas (estimated if not
   * given) x effective gas price. Returns 0x-hex fields plus a BigInt `feeWei`.
   * @param {Object} tx - { from, to, value, data/input, gas? }
   */
  async estimateForTx(tx) {
    let gas;
    if (tx.gas != null) {
      gas = toBig(tx.gas);
    } else if (this.rpc) {
      try { gas = toBig(await this.rpc.estimateGas(tx)); }
      catch (e) {
        if (!this.restClient) throw e;
        const r = await this.restClient.estimateGas(tx);
        gas = toBig(r.gas !== undefined ? r.gas : r);
      }
    } else {
      const r = await this.restClient.estimateGas(tx);
      gas = toBig(r.gas !== undefined ? r.gas : r);
    }

    const base = await this.gasPrice();
    const priority = await this.maxPriorityFeePerGas();
    const effective = base + priority;
    const fee = gas * effective;
    return {
      gas: hex(gas),
      baseFeePerGas: hex(base),
      maxPriorityFeePerGas: hex(priority),
      effectiveGasPrice: hex(effective),
      fee: hex(fee),
      feeWei: fee,
    };
  }
}

module.exports = FeeOracle;
