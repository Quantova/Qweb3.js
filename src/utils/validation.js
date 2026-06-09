// src/utils/validation.js

const AddressUtils = require('./address');
const { decodePrivateKey } = require('./keys');

class ValidationUtils {
  /**
   * Validates if a string is a valid address: a Quantova account address ("Q1...") or a 0x H160
   * contract address. Delegates to AddressUtils so there is a single source of truth.
   *
   * @param {string} address - The address to validate.
   * @returns {boolean} - True if the address is valid, otherwise false.
   */
  static isAddress(address) {
    return AddressUtils.isAddress(address);
  }

  /**
   * Validates a Quantova private key: a "QSEC1..." Bech32m key (or, during migration, a legacy
   * 64-hex seed with or without 0x).
   *
   * @param {string} privateKey - The private key to validate.
   * @returns {boolean} - Returns true if the private key is valid, otherwise false.
   */
  static isPrivateKey(privateKey) {
    if (typeof privateKey !== 'string') return false;
    if (/^(QSEC1|qsec1)/.test(privateKey)) {
      try {
        decodePrivateKey(privateKey);
        return true;
      } catch {
        return false;
      }
    }
    return /^0x[0-9a-fA-F]{64}$/.test(privateKey) || /^[0-9a-fA-F]{64}$/.test(privateKey);
  }

  /**
   * Validates if a string is a valid Quantova transaction hash (32-byte hexadecimal string with 0x prefix).
   * 
   * @param {string} txHash - The transaction hash to validate.
   * @returns {boolean} - Returns true if the transaction hash is valid, otherwise false.
   */
  static isTxHash(txHash) {
    if (typeof txHash !== 'string') return false;
    return /^0x[0-9a-fA-F]{64}$/.test(txHash);
  }

  /**
   * Validates if a value is a valid number (integer or float).
   * 
   * @param {any} value - The value to validate.
   * @returns {boolean} - Returns true if the value is a valid number, otherwise false.
   */
  static isNumber(value) {
    return !isNaN(value) && isFinite(value);
  }

  /**
   * Validates if a string is a valid hexadecimal string (with 0x prefix).
   * 
   * @param {string} hex - The string to validate.
   * @returns {boolean} - Returns true if the string is valid hex, otherwise false.
   */
  static isHex(hex) {
    if (typeof hex !== 'string') return false;
    return /^0x[0-9a-fA-F]+$/.test(hex);
  }

  /**
   * Validates if a string is a valid Quantova QNS name (ends with .q).
   * 
   * @param {string} qnsName - The QNS name to validate.
   * @returns {boolean} - Returns true if the QNS name is valid, otherwise false.
   */
  static isQNSName(qnsName) {
    if (typeof qnsName !== 'string') return false;
    return /^[a-z0-9-]+\.q$/.test(qnsName);
  }



  /**
   * Validates if a string is a valid hexadecimal number (i.e., hex without `0x` prefix).
   * 
   * @param {string} hex - The hex number to validate.
   * @returns {boolean} - Returns true if the string is valid hex, otherwise false.
   */
  static isValidHexNumber(hex) {
    if (typeof hex !== 'string') return false;
    return /^[0-9a-fA-F]+$/.test(hex);
  }

  /**
   * Validates if a string is a valid Quantova gas price (integer, no decimals).
   * 
   * @param {string} gasPrice - The gas price to validate.
   * @returns {boolean} - Returns true if the gas price is valid, otherwise false.
   */
  static isGasPrice(gasPrice) {
    if (typeof gasPrice !== 'string') return false;
    return /^[0-9]+$/.test(gasPrice); // Gas price must be a positive integer
  }
}

module.exports = ValidationUtils;
