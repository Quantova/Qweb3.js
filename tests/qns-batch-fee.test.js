// tests/qns-batch-fee.test.js
const { QNS, BatchRequest, FeeOracle, QRpcClient } = require('../index');

function run() {
  console.log("▶ Running QNS, Batch & Fee Oracle Tests...");

  // --- QNS namehash (canonical ENS vectors) ---
  const qns = new QNS({ registryAddress: '0x' + 'dd'.repeat(20) });
  if (qns.namehash('') !== '0x0000000000000000000000000000000000000000000000000000000000000000') throw new Error("namehash('') failed");
  if (qns.namehash('eth') !== '0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae') throw new Error("namehash('eth') failed");
  if (qns.namehash('foo.eth') !== '0xde9b09fd7c5f901e23a3f19fecc54828e9c848539801e86591bd9801b019f84f') throw new Error("namehash('foo.eth') failed");
  if (!qns.isValidName('alec.q') || qns.isValidName('alec.eth')) throw new Error("QNS name validation failed");

  // --- Batch: insertion-order reassembly from out-of-order responses ---
  const prevHandler = global.__AXIOS_HANDLER__;
  global.__AXIOS_HANDLER__ = async (cfg) => {
    const resp = cfg.data.map((r) => ({ jsonrpc: '2.0', id: r.id, result: `r-${r.method}` })).reverse();
    return { data: resp };
  };
  return (async () => {
    const batch = new BatchRequest('http://node');
    batch.add('q_blockNumber').add('q_chainId').add('q_gasPrice');
    const results = await batch.execute();
    const got = results.map((r) => r.result).join(',');
    if (got !== 'r-q_blockNumber,r-q_chainId,r-q_gasPrice') throw new Error("batch ordering failed: " + got);

    // --- Fee oracle tiers from history ---
    global.__AXIOS_HANDLER__ = async (cfg) => {
      const m = cfg.data.method;
      const map = {
        q_gasPrice: '0x3b9aca00',
        q_maxPriorityFeePerGas: '0x5f5e100',
        q_feeHistory: { reward: [['0x1', '0x2', '0x3'], ['0x3', '0x4', '0x5']] },
      };
      return { data: { jsonrpc: '2.0', id: cfg.data.id, result: map[m] } };
    };
    const oracle = new FeeOracle({ rpc: new QRpcClient('http://node') });
    const est = await oracle.estimate();
    if (BigInt(est.maxFeePerGas) !== BigInt('0x3b9aca00') + BigInt('0x5f5e100')) throw new Error("fee maxFee failed");
    if (BigInt(est.tiers.standard) !== 3n) throw new Error("fee tier averaging failed");

    global.__AXIOS_HANDLER__ = prevHandler;
    console.log("  ✓ QNS, Batch & Fee Oracle Tests Passed.");
  })();
}

module.exports = { run };
