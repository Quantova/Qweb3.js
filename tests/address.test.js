// tests/address.test.js
const { AddressUtils, ValidationUtils } = require('../index');

function run() {
  console.log("▶ Running Address and QNS Validation Tests...");

  const legacyAddress = '0x32Be343B94f860124dC4fEe278FDCBD38C102D88';
  const pqAddress = 'QOuhXUELsRC0/zow/Vjwft8hNP8=';
  const invalidAddress = '0x12345';

  if (!AddressUtils.isAddress(legacyAddress)) throw new Error("Legacy address check failed");
  if (!AddressUtils.isAddress(pqAddress)) throw new Error("PQ address check failed");
  if (AddressUtils.isAddress(invalidAddress)) throw new Error("Invalid address check failed");

  if (!ValidationUtils.isAddress(legacyAddress)) throw new Error("ValidationUtils legacy check failed");
  if (!ValidationUtils.isAddress(pqAddress)) throw new Error("ValidationUtils PQ check failed");

  const validQNS = 'alice-quantum.q';
  const invalidQNS = 'alice.eth';
  if (!ValidationUtils.isQNSName(validQNS)) throw new Error("Valid QNS check failed");
  if (ValidationUtils.isQNSName(invalidQNS)) throw new Error("Invalid QNS check failed");

  console.log("  ✓ Address and QNS Validation Tests Passed.");
}

module.exports = { run };
