// src/utils/hex.js

class HexUtils {
  /**
   * Converts a string to its hexadecimal representation.
   * 
   * @param {string} str - The string to convert to hex.
   * @returns {string} - The hexadecimal representation of the string.
   */
  static stringToHex(str) {
    let hex = '';
    for (let i = 0; i < str.length; i++) {
      hex += `0${str.charCodeAt(i).toString(16)}`.slice(-2);
    }
    return `0x${hex}`;
  }

  /**
   * Converts a hexadecimal string to a normal string.
   * 
   * @param {string} hex - The hexadecimal string to convert to a normal string.
   * @returns {string} - The decoded string.
   * @throws {Error} - Throws an error if the input is not a valid hex string.
   */
  static hexToString(hex) {
    if (!/^0x[0-9a-fA-F]+$/.test(hex)) {
      throw new Error('Invalid hex string');
    }
    let str = '';
    for (let i = 2; i < hex.length; i += 2) {
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
  }

  /**
   * Converts a number to its hexadecimal representation.
   * 
   * @param {number} num - The number to convert to hex.
   * @returns {string} - The hexadecimal representation of the number.
   */
  static numberToHex(num) {
    if (typeof num !== 'number') {
      throw new Error('Input must be a number');
    }
    return `0x${num.toString(16)}`;
  }

  /**
   * Converts a BigInt to its hexadecimal representation.
   * 
   * @param {BigInt|string|number} value - The value to convert to hex.
   * @returns {string} - The hexadecimal representation of the BigInt value.
   * @throws {Error} - Throws an error if the value cannot be converted to BigInt.
   */
  static bigIntToHex(value) {
    const bigIntValue = this.toBigInt(value);
    return `0x${bigIntValue.toString(16)}`;
  }

  /**
   * Converts a hexadecimal string to a BigInt.
   * 
   * @param {string} hex - The hexadecimal string to convert to BigInt.
   * @returns {BigInt} - The corresponding BigInt value.
   * @throws {Error} - Throws an error if the hex string is invalid.
   */
  static hexToBigInt(hex) {
    if (!/^0x[0-9a-fA-F]+$/.test(hex)) {
      throw new Error('Invalid hex string');
    }
    return BigInt(hex);
  }

  /**
   * Checks if a string is a valid hexadecimal string.
   * 
   * @param {string} value - The string to check.
   * @returns {boolean} - Returns true if the string is a valid hex string.
   */
  static isHex(value) {
    return /^0x[0-9a-fA-F]+$/.test(value);
  }

  /**
   * Adds leading zeros to a hex string to make it a certain length.
   * 
   * @param {string} hex - The hexadecimal string to pad.
   * @param {number} length - The desired length of the hex string.
   * @returns {string} - The padded hexadecimal string.
   * @throws {Error} - Throws an error if the input is not a valid hex string.
   */
  static padHex(hex, length) {
    if (!this.isHex(hex)) {
      throw new Error('Invalid hex string');
    }
    let paddedHex = hex.slice(2); // Remove the '0x' prefix
    while (paddedHex.length < length) {
      paddedHex = '0' + paddedHex;
    }
    return `0x${paddedHex}`;
  }

  /**
   * Removes the '0x' prefix from a hexadecimal string.
   * 
   * @param {string} hex - The hexadecimal string to clean.
   * @returns {string} - The hexadecimal string without the '0x' prefix.
   * @throws {Error} - Throws an error if the input is not a valid hex string.
   */
  static removePrefix(hex) {
    if (!this.isHex(hex)) {
      throw new Error('Invalid hex string');
    }
    return hex.slice(2);
  }

  /**
   * Converts a BigInt to a hexadecimal string without leading zeros (without '0x' prefix).
   * 
   * @param {BigInt|string|number} value - The value to convert to hex.
   * @returns {string} - The hexadecimal representation of the BigInt value.
   * @throws {Error} - Throws an error if the value cannot be converted to BigInt.
   */
  static toBigInt(value) {
    if (typeof value === 'bigint') {
      return value; // Return BigInt if it's already a BigInt
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return BigInt(value);
    }
    throw new Error('Invalid input: value cannot be converted to BigInt');
  }
}

// Export the HexUtils class
module.exports = HexUtils;

