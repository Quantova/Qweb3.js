// tests/address.test.js
const { AddressUtils, ValidationUtils } = require('../index');

function run() {
  console.log("▶ Running Address and QNS Validation Tests...");

  // A 0x H160 contract address (Solidity/QVM) — still valid, unchanged.
  const contractAddress = '0x32Be343B94f860124dC4fEe278FDCBD38C102D88';
  // A Quantova account address in the new Q-branded Bech32m form.
  const qAddress = 'Q1GZD3AGFY5U426V9NX6UNE06ZC4YVKNK3GU9L3C';
  // A Quantova private key (Bech32m of the 32-byte seed).
  const qPrivateKey = 'QSEC1R73ZT2PT4CCMGDA68HQY83JFE38AY4WCT00XRER8AFKLQULK087QNEMZJR';
  const invalidAddress = '0x12345';
  // The retired Base64 form must no longer validate.
  const oldBase64Address = 'QOuhXUELsRC0/zow/Vjwft8hNP8=';

  if (!AddressUtils.isAddress(contractAddress)) throw new Error("Contract (0x) address check failed");
  if (!AddressUtils.isAddress(qAddress)) throw new Error("Q-address check failed");
  if (AddressUtils.isAddress(invalidAddress)) throw new Error("Invalid address wrongly accepted");
  if (AddressUtils.isAddress(oldBase64Address)) throw new Error("Retired Base64 address wrongly accepted");

  if (!ValidationUtils.isAddress(contractAddress)) throw new Error("ValidationUtils contract check failed");
  if (!ValidationUtils.isAddress(qAddress)) throw new Error("ValidationUtils Q-address check failed");
  if (!ValidationUtils.isPrivateKey(qPrivateKey)) throw new Error("ValidationUtils QSEC1 private-key check failed");

  // Q-addresses round-trip back to their 20-byte body.
  const bytes = AddressUtils.addressToBytes(qAddress);
  if (bytes.length !== 20) throw new Error("Q-address did not decode to 20 bytes");

  const validQNS = 'alice-quantum.q';
  const invalidQNS = 'alice.eth';
  if (!ValidationUtils.isQNSName(validQNS)) throw new Error("Valid QNS check failed");
  if (ValidationUtils.isQNSName(invalidQNS)) throw new Error("Invalid QNS check failed");

  console.log("  ✓ Address and QNS Validation Tests Passed.");
}

module.exports = { run };
