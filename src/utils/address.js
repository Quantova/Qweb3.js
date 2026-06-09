// src/utils/address.js

const { hexToU8a } = require('@quantova/util');
const { keccakAsHex } = require('@quantova/util-crypto');
const { sha3_256 } = require('./sha3');
const { encodeAddress, decodeAddress, decodePublicKey } = require('./keys');

// A Quantova account address is Bech32m with prefix "q", shown all-capitals -> "Q1...".
// Case must be uniform (all-upper or all-lower); the decoder verifies the checksum.
const Q_ADDRESS_RE = /^(Q1[0-9A-Z]+|q1[0-9a-z]+)$/;
// 0x H160 — used only for QVM/Solidity contract addresses, which are intentionally left unchanged.
const CONTRACT_HEX_RE = /^0x[a-fA-F0-9]{40}$/;

class AddressUtils {
  /**
   * True if the value is a valid Quantova account address ("Q1...", case-insensitive on input) OR a 0x H160
   * contract address (Solidity/QVM addresses are unchanged).
   *
   * @param {string} value
   * @returns {boolean}
   */
  static isAddress(value) {
    if (typeof value !== 'string') return false;
    if (CONTRACT_HEX_RE.test(value)) return true; // QVM/Solidity contract address (unchanged)
    if (!Q_ADDRESS_RE.test(value)) return false;
    try {
      decodeAddress(value); // verifies the Bech32m checksum + prefix
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Derive the 20-byte account body from a post-quantum public key, exactly as the chain does:
   * SHA3-256(publicKey)[0..20] with byte[0] forced to 0x40 (the "Q" brand byte).
   *
   * @param {Uint8Array|Buffer|string} publicKey - raw public-key bytes or a hex string
   * @returns {Uint8Array} 20-byte account body
   */
  static accountBodyFromPublicKey(publicKey) {
    let buf;
    if (typeof publicKey === 'string' && /^(QPUB1|qpub1)/.test(publicKey)) {
      buf = decodePublicKey(publicKey);
    } else if (typeof publicKey === 'string') {
      buf = hexToU8a(publicKey.startsWith('0x') ? publicKey : `0x${publicKey}`);
    } else if (publicKey instanceof Uint8Array || Buffer.isBuffer(publicKey)) {
      buf = Uint8Array.from(publicKey);
    } else {
      throw new Error('Invalid publicKey: expected Uint8Array, Buffer, or hex string');
    }
    const body = sha3_256(buf).slice(0, 20);
    body[0] = 0x40; // "Q" brand byte (matches the chain)
    return body;
  }

  /**
   * Derive the Quantova account address ("Q1...") from a post-quantum public key.
   *
   * @param {Uint8Array|Buffer|string} publicKey
   * @returns {string} address, e.g. "Q1GZD3AGFY5U..."
   */
  static deriveAddressFromPublicKey(publicKey) {
    return encodeAddress(this.accountBodyFromPublicKey(publicKey));
  }

  /**
   * Decode a canonical "Q1..." (case-insensitive on input) address back to its 20-byte account body.
   *
   * @param {string} address
   * @returns {Uint8Array} 20 bytes
   */
  static addressToBytes(address) {
    return decodeAddress(address);
  }

  /**
   * Normalise an address for display: Q-addresses are returned all-capitals (the canonical
   * capital-Q form); 0x contract addresses are lower-cased.
   *
   * @param {string} address
   * @returns {string}
   */
  static formatAddress(address) {
    if (!this.isAddress(address)) {
      throw new Error('Invalid address');
    }
    if (address.startsWith('0x')) {
      return address.toLowerCase();
    }
    return address.toUpperCase();
  }

  // --- 0x contract-address helpers (EVM/Solidity — intentionally unchanged) -------------------

  /**
   * EIP-55 checksum for a 0x contract address. Q-addresses carry their own (Bech32m) checksum and
   * are returned unchanged.
   */
  static toChecksumAddress(address) {
    if (!this.isAddress(address)) {
      throw new Error('Invalid address');
    }
    if (!address.startsWith('0x')) {
      return address; // Q-address — already checksummed by Bech32m
    }

    const clean = address.toLowerCase().slice(2);
    const addressHash = keccakAsHex(clean).replace('0x', '');
    let checksumAddress = '0x';

    for (let i = 0; i < clean.length; i++) {
      const char = clean[i];
      const hashChar = parseInt(addressHash[i], 16);
      checksumAddress += hashChar > 7 ? char.toUpperCase() : char.toLowerCase();
    }

    return checksumAddress;
  }

  /**
   * Validates the checksum of a 0x contract address.
   */
  static validateChecksum(address) {
    return address === this.toChecksumAddress(address);
  }

  /**
   * Helper to check if a string matches standard Substrate SS58 address format.
   */
  static isValidSS58Address(address) {
    if (typeof address !== 'string') return false;
    return /^5[A-Za-z0-9]{47,48}$/.test(address);
  }
}

module.exports = AddressUtils;
