// src/utils/address.js

const { hexToU8a, u8aToHex } = require('@quantova/util');
const { keccakAsHex } = require('@quantova/util-crypto');

class AddressUtils {
  /**
   * Checks if a given value is a valid address.
   * Supports both legacy EVM hex (0x...) and post-quantum Quantova Base64 H160 addresses.
   * 
   * @param {string} value - The value to check.
   * @returns {boolean} - True if valid.
   */
  static isAddress(value) {
    if (typeof value !== 'string') return false;
    // Legacy EVM address
    if (/^0x[a-fA-F0-9]{40}$/.test(value)) return true;
    // Post-quantum base64 H160 address
    return /^[A-Za-z0-9+/]{27}=$/.test(value);
  }

  /**
   * Formats an address to lowercase (if legacy EVM hex).
   * 
   * @param {string} address - The address to format.
   * @returns {string} - The formatted address.
   */
  static formatAddress(address) {
    if (!this.isAddress(address)) {
      throw new Error('Invalid address');
    }
    if (address.startsWith('0x')) {
      return address.toLowerCase();
    }
    return address; // Base64 is case-sensitive, return unmodified
  }

  /**
   * Converts a legacy address to a checksummed address.
   * 
   * @param {string} address - The address.
   * @returns {string} - Checksummed address.
   */
  static toChecksumAddress(address) {
    if (!this.isAddress(address)) {
      throw new Error('Invalid address');
    }
    if (!address.startsWith('0x')) {
      return address; // Base64 is not checksummed in EVM style
    }

    const clean = address.toLowerCase().slice(2);
    const addressHash = keccakAsHex(clean).replace('0x', '');
    let checksumAddress = '0x';

    for (let i = 0; i < clean.length; i++) {
      const char = clean[i];
      const hashChar = parseInt(addressHash[i], 16);

      if (hashChar > 7) {
        checksumAddress += char.toUpperCase();
      } else {
        checksumAddress += char.toLowerCase();
      }
    }

    return checksumAddress;
  }

  /**
   * Validates the checksum of an address.
   */
  static validateChecksum(address) {
    return address === this.toChecksumAddress(address);
  }

  /**
   * Formats a public key / account ID to the standard Quantova H160 Base64 address.
   * 
   * @param {Uint8Array|string} accountId - The raw public key (32 bytes) or hex string.
   * @returns {string} - The Base64 H160 address.
   */
  static h160Base64FromAccountId(accountId) {
    let buf;
    if (typeof accountId === 'string') {
      buf = hexToU8a(accountId.startsWith('0x') ? accountId : `0x${accountId}`);
    } else if (accountId instanceof Uint8Array || Buffer.isBuffer(accountId)) {
      buf = accountId;
    } else {
      throw new Error('Invalid accountId format: expected Uint8Array, Buffer, or hex string');
    }

    // Take the first 20 bytes and encode as base64
    return Buffer.from(buf.subarray(0, 20)).toString('base64');
  }

  /**
   * Derives a Quantova Base64 H160 address from a raw public key.
   */
  static deriveAddressFromPublicKey(publicKey) {
    return this.h160Base64FromAccountId(publicKey);
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
