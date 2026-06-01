// tests/wallet.test.js
const { QuantumWallet, QuantumSigner } = require('../index');

function run() {
  console.log("▶ Running Post-Quantum Wallet and Signer Tests...");

  const wallet = new QuantumWallet();

  // Falcon
  const falconAcc = wallet.create('falcon');
  if (!falconAcc.address || falconAcc.scheme !== 'falcon') throw new Error("Falcon account creation failed");
  console.log(`  - Falcon Address: ${falconAcc.address}`);

  // Dilithium
  const dilithiumAcc = wallet.create('dilithium');
  if (!dilithiumAcc.address || dilithiumAcc.scheme !== 'dilithium') throw new Error("Dilithium account creation failed");
  console.log(`  - Dilithium Address: ${dilithiumAcc.address}`);

  // SPHINCS+
  const sphincspAcc = wallet.create('sphincsp');
  if (!sphincspAcc.address || sphincspAcc.scheme !== 'sphincsp') throw new Error("SPHINCS+ account creation failed");
  console.log(`  - SPHINCS+ Address: ${sphincspAcc.address}`);

  // Sign & Verify
  const msg = "Quantova Secure Enterprise L1 Post-Quantum Extrinsic Signature";
  const signatureHex = wallet.signTransaction(msg, falconAcc.address);
  if (!signatureHex) throw new Error("Falcon transaction signing failed");

  const isVerified = QuantumSigner.verify(msg, signatureHex, falconAcc.publicKey, 'falcon');
  if (!isVerified) throw new Error("Falcon signature verification failed");

  console.log("  ✓ Post-Quantum Wallet and Signer Tests Passed.");
}

module.exports = { run };
