// tests/contract.test.js
const { AbiCodec, QContract } = require('../index');

function run() {
  console.log("▶ Running ABI Codec & QVM Contract Tests...");

  // Canonical Solidity selectors
  if (AbiCodec.functionSelector('transfer(address,uint256)') !== '0xa9059cbb') throw new Error("transfer selector mismatch");
  if (AbiCodec.functionSelector('balanceOf(address)') !== '0x70a08231') throw new Error("balanceOf selector mismatch");
  if (AbiCodec.eventTopic('Transfer(address,address,uint256)') !== '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') throw new Error("Transfer topic mismatch");

  // Encode/decode round-trip
  const types = ['uint256', 'string', 'bool'];
  const vals = [255n, 'hello', true];
  const enc = '0x' + AbiCodec._internal.bytesToHex(AbiCodec.encodeParameters(types, vals));
  const dec = AbiCodec.decodeParameters(types, enc);
  if (!(dec[0] === 255n && dec[1] === 'hello' && dec[2] === true)) throw new Error("ABI round-trip failed");

  // Negative int (two's complement)
  const e = '0x' + AbiCodec._internal.bytesToHex(AbiCodec.encodeParameters(['int256'], [-12345n]));
  if (AbiCodec.decodeParameters(['int256'], e)[0] !== -12345n) throw new Error("int256 negative failed");

  // Contract log decoding
  const abi = [
    { type: 'event', name: 'Transfer', inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ] },
  ];
  const c = new QContract(abi, '0x' + 'cc'.repeat(20), {});
  const pad = (h) => '0x' + h.replace(/^0x/, '').padStart(64, '0');
  const log = {
    topics: [AbiCodec.eventTopic('Transfer(address,address,uint256)'), pad('0x' + 'aa'.repeat(20)), pad('0x' + 'bb'.repeat(20))],
    data: '0x' + (1000n).toString(16).padStart(64, '0'),
  };
  const decoded = c.decodeLogs([log]);
  if (decoded.length !== 1 || decoded[0].name !== 'Transfer' || decoded[0].args.value !== 1000n) {
    throw new Error("event log decoding failed");
  }

  console.log("  ✓ ABI Codec & QVM Contract Tests Passed.");
}

module.exports = { run };
