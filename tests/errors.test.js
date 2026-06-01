// tests/errors.test.js
const { ConnectionError, InvalidArgumentError, RpcError, TransactionError } = require('../index');

function run() {
  console.log("▶ Running Custom SDK Errors Tests...");

  // ConnectionError
  try {
    throw new ConnectionError("Quantova connection timeout", "http://127.0.0.1:9944", "504");
  } catch (err) {
    if (err.statusCode !== "504") throw new Error("ConnectionError status code mismatch");
  }

  // InvalidArgumentError
  try {
    throw new InvalidArgumentError("Invalid argument", "transfer", 12345, "string");
  } catch (err) {
    if (err.functionName !== "transfer") throw new Error("InvalidArgumentError function mismatch");
  }

  // RpcError
  try {
    throw new RpcError("Failed to fetch block", "https://mainnet.quantova.io/", "q_getBlockByNumber", 500, { block: "0x1" }, { error: "Failed" });
  } catch (err) {
    if (err.statusCode !== 500) throw new Error("RpcError status mismatch");
  }

  // TransactionError
  try {
    throw new TransactionError("Transaction failed", "0xabcdef", 400, { tx: "data" }, { error: "Gas limit exceeded" });
  } catch (err) {
    if (err.txHash !== "0xabcdef") throw new Error("TransactionError txHash mismatch");
  }

  console.log("  ✓ Custom SDK Errors Tests Passed.");
}

module.exports = { run };
