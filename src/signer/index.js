// src/signer/index.js

const { hexToU8a, u8aToHex } = require('@quantova/util');
const wasm = require('@quantova/falcon-wasm/generated-node/quantova_falcon_wasm.js');
const { decodePrivateKey, decodePublicKey } = require('../utils/keys');

// Accept a 32-byte seed as "QSEC1..." (Bech32m), a hex string, or raw bytes.
function toSeedBytes(seed) {
  if (typeof seed === 'string') {
    if (/^(QSEC1|qsec1)/.test(seed)) return decodePrivateKey(seed);
    // [QW3-001] Legacy hex seed: require EXACTLY 64 hex chars (optionally 0x-prefixed) before
    // decoding, and assert the result is 32 bytes. hexToU8a is lenient about length/odd nibbles,
    // which would otherwise let a short or malformed seed through.
    if (!/^(0x)?[0-9a-fA-F]{64}$/.test(seed)) {
      throw new Error('Invalid seed: expected a 64-hex-char (32-byte) seed or a "QSEC1..." key');
    }
    const bytes = hexToU8a(seed.startsWith('0x') ? seed : `0x${seed}`);
    if (bytes.length !== 32) {
      throw new Error('Invalid seed: decoded seed must be exactly 32 bytes');
    }
    return bytes;
  }
  return seed;
}

// Accept a public key as "QPUB1..." (Bech32m), a hex string, or raw bytes.
function toPublicKeyBytes(publicKey) {
  if (typeof publicKey === 'string') {
    if (/^(QPUB1|qpub1)/.test(publicKey)) return decodePublicKey(publicKey);
    return hexToU8a(publicKey.startsWith('0x') ? publicKey : `0x${publicKey}`);
  }
  return publicKey;
}

// Resolve the wasm function for (scheme, op), rejecting any unknown scheme so an unrecognized
// value can never silently fall through to a different algorithm. (QWEB3-VAL-002)
const SCHEME_OPS = { falcon: 'falcon', dilithium: 'dilithium', sphincsp: 'sphincsp' };
function wasmFn(scheme, op) {
  const s = SCHEME_OPS[scheme];
  if (!s) throw new Error(`unknown signature scheme: ${scheme} (expected falcon, dilithium, or sphincsp)`);
  return wasm[`${s}_${op}`];
}

class QuantumSigner {
  /**
   * Generates a post-quantum keypair from a seed.
   * 
   * @param {Uint8Array|string} seed - The 32-byte seed.
   * @param {string} scheme - 'sphincsp', 'falcon', or 'dilithium'.
   * @returns {Object} - { publicKey: Uint8Array, secretKey: Uint8Array }
   */
  static generatePair(seed, scheme = 'falcon') {
    const seedU8a = toSeedBytes(seed);
    const pair = wasmFn(scheme, 'pair_from_seed')(seedU8a);
    return {
      publicKey: pair.public_key,
      secretKey: seedU8a
    };
  }

  /**
   * Signs a message using the selected signature scheme.
   * 
   * @param {Uint8Array|string} message - The message to sign.
   * @param {Uint8Array|string} seed - The 32-byte seed/secret key.
   * @param {string} scheme - 'sphincsp', 'falcon', or 'dilithium'.
   * @returns {Uint8Array} - The signature bytes.
   */
  static sign(message, seed, scheme = 'falcon') {
    const seedU8a = toSeedBytes(seed);
    const msgU8a = typeof message === 'string' ? Buffer.from(message, 'utf-8') : message;

    const pair = this.generatePair(seedU8a, scheme);
    return wasmFn(scheme, 'sign')(seedU8a, pair.publicKey, msgU8a);
  }

  /**
   * Verifies a post-quantum signature.
   * 
   * @param {Uint8Array|string} message - The original message.
   * @param {Uint8Array|string} signature - The signature bytes.
   * @param {Uint8Array|string} publicKey - The public key.
   * @param {string} scheme - 'sphincsp', 'falcon', or 'dilithium'.
   * @returns {boolean} - True if valid, false otherwise.
   */
  static verify(message, signature, publicKey, scheme = 'falcon') {
    // verify() on untrusted input must be TOTAL: a malformed signature/public key, or an unknown
    // scheme, yields false rather than throwing, so a caller cannot be crashed by a crafted
    // signature. (QWEB3-VAL-002)
    try {
      const msgU8a = typeof message === 'string' ? Buffer.from(message, 'utf-8') : message;
      const sigU8a = typeof signature === 'string' ? hexToU8a(signature.startsWith('0x') ? signature : `0x${signature}`) : signature;
      const pubU8a = toPublicKeyBytes(publicKey);
      return wasmFn(scheme, 'verify')(pubU8a, msgU8a, sigU8a) === true;
    } catch (_e) {
      return false;
    }
  }
}

module.exports = QuantumSigner;
