// src/signer/index.js

const { hexToU8a, u8aToHex } = require('@quantova/util');
const wasm = require('@quantova/falcon-wasm/generated-node/quantova_falcon_wasm.js');

class QuantumSigner {
  /**
   * Generates a post-quantum keypair from a seed.
   * 
   * @param {Uint8Array|string} seed - The 32-byte seed.
   * @param {string} scheme - 'sphincsp', 'falcon', or 'dilithium'.
   * @returns {Object} - { publicKey: Uint8Array, secretKey: Uint8Array }
   */
  static generatePair(seed, scheme = 'falcon') {
    const seedU8a = typeof seed === 'string' ? hexToU8a(seed.startsWith('0x') ? seed : `0x${seed}`) : seed;

    let pair;
    if (scheme === 'sphincsp') {
      pair = wasm.sphincsp_pair_from_seed(seedU8a);
    } else if (scheme === 'dilithium') {
      pair = wasm.dilithium_pair_from_seed(seedU8a);
    } else {
      pair = wasm.falcon_pair_from_seed(seedU8a);
    }

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
    const seedU8a = typeof seed === 'string' ? hexToU8a(seed.startsWith('0x') ? seed : `0x${seed}`) : seed;
    const msgU8a = typeof message === 'string' ? Buffer.from(message, 'utf-8') : message;

    const pair = this.generatePair(seedU8a, scheme);

    if (scheme === 'sphincsp') {
      return wasm.sphincsp_sign(seedU8a, pair.publicKey, msgU8a);
    } else if (scheme === 'dilithium') {
      return wasm.dilithium_sign(seedU8a, pair.publicKey, msgU8a);
    } else {
      return wasm.falcon_sign(seedU8a, pair.publicKey, msgU8a);
    }
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
    const msgU8a = typeof message === 'string' ? Buffer.from(message, 'utf-8') : message;
    const sigU8a = typeof signature === 'string' ? hexToU8a(signature.startsWith('0x') ? signature : `0x${signature}`) : signature;
    const pubU8a = typeof publicKey === 'string' ? hexToU8a(publicKey.startsWith('0x') ? publicKey : `0x${publicKey}`) : publicKey;

    if (scheme === 'sphincsp') {
      return wasm.sphincsp_verify(pubU8a, msgU8a, sigU8a);
    } else if (scheme === 'dilithium') {
      return wasm.dilithium_verify(pubU8a, msgU8a, sigU8a);
    } else {
      return wasm.falcon_verify(pubU8a, msgU8a, sigU8a);
    }
  }
}

module.exports = QuantumSigner;
