// src/utils/bigInt.js

class BigIntUtils {
  /**
   * Converts a given value to a BigInt.
   * Supports strings, numbers, and BigInt values.
   * 
   * @param {string|number|BigInt} value - The value to convert to BigInt.
   * @returns {BigInt} - The value as a BigInt.
   * @throws {Error} - Throws an error if the value cannot be converted to BigInt.
   */
  static toBigInt(value) {
    // If value is already a BigInt, return it as is
    if (typeof value === 'bigint') {
      return value;
    }

    // If value is a string or number, convert it to BigInt
    if (typeof value === 'number' || typeof value === 'string') {
      return BigInt(value);
    }

    throw new Error('Invalid input: value cannot be converted to BigInt');
  }

  /**
   * Checks if a given value is a valid BigInt.
   * 
   * @param {any} value - The value to check.
   * @returns {boolean} - Returns true if the value is a BigInt, otherwise false.
   */
  static isBigInt(value) {
    return typeof value === 'bigint';
  }

  /**
   * Converts a BigInt to its hexadecimal representation.
   * 
   * @param {BigInt|string|number} value - The value to convert to hexadecimal.
   * @returns {string} - The hexadecimal representation of the value.
   * @throws {Error} - Throws an error if the value cannot be converted to BigInt.
   */
  static toHex(value) {
    const bigIntValue = this.toBigInt(value);
    return `0x${bigIntValue.toString(16)}`;
  }

  /**
   * Converts a hexadecimal string to a BigInt.
   * 
   * @param {string} hex - The hexadecimal string to convert to BigInt.
   * @returns {BigInt} - The corresponding BigInt value.
   * @throws {Error} - Throws an error if the hexadecimal string is invalid.
   */
  static fromHex(hex) {
    if (!/^0x[0-9a-fA-F]+$/.test(hex)) {
      throw new Error('Invalid hex string');
    }
    return BigInt(hex);
  }

  /**
   * Adds two BigInt values.
   * 
   * @param {BigInt|string|number} a - The first value to add.
   * @param {BigInt|string|number} b - The second value to add.
   * @returns {BigInt} - The sum of the two values.
   */
  static add(a, b) {
    return this.toBigInt(a) + this.toBigInt(b);
  }

  /**
   * Subtracts two BigInt values.
   * 
   * @param {BigInt|string|number} a - The value to subtract from.
   * @param {BigInt|string|number} b - The value to subtract.
   * @returns {BigInt} - The result of the subtraction.
   */
  static subtract(a, b) {
    return this.toBigInt(a) - this.toBigInt(b);
  }

  /**
   * Multiplies two BigInt values.
   * 
   * @param {BigInt|string|number} a - The first value to multiply.
   * @param {BigInt|string|number} b - The second value to multiply.
   * @returns {BigInt} - The result of the multiplication.
   */
  static multiply(a, b) {
    return this.toBigInt(a) * this.toBigInt(b);
  }

  /**
   * Divides two BigInt values.
   * 
   * @param {BigInt|string|number} a - The dividend.
   * @param {BigInt|string|number} b - The divisor.
   * @returns {BigInt} - The result of the division.
   */
  static divide(a, b) {
    const bigA = this.toBigInt(a);
    const bigB = this.toBigInt(b);

    if (bigB === BigInt(0)) {
      throw new Error('Division by zero');
    }

    return bigA / bigB;
  }

  /**
   * Computes the modulus (remainder) of two BigInt values.
   * 
   * @param {BigInt|string|number} a - The dividend.
   * @param {BigInt|string|number} b - The divisor.
   * @returns {BigInt} - The modulus (remainder).
   */
  static mod(a, b) {
    return this.toBigInt(a) % this.toBigInt(b);
  }

  /**
   * Returns the minimum of two BigInt values.
   * 
   * @param {BigInt|string|number} a - The first value to compare.
   * @param {BigInt|string|number} b - The second value to compare.
   * @returns {BigInt} - The smaller of the two values.
   */
  static min(a, b) {
    return this.toBigInt(a) < this.toBigInt(b) ? this.toBigInt(a) : this.toBigInt(b);
  }

  /**
   * Returns the maximum of two BigInt values.
   * 
   * @param {BigInt|string|number} a - The first value to compare.
   * @param {BigInt|string|number} b - The second value to compare.
   * @returns {BigInt} - The larger of the two values.
   */
  static max(a, b) {
    return this.toBigInt(a) > this.toBigInt(b) ? this.toBigInt(a) : this.toBigInt(b);
  }

  /**
   * Converts a BigInt value to a human-readable string (with commas).
   * 
   * @param {BigInt|string|number} value - The BigInt value to format.
   * @returns {string} - The formatted string.
   */
  static formatBigInt(value) {
    const bigIntValue = this.toBigInt(value);
    return bigIntValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
}

// Export the BigIntUtils class
module.exports = BigIntUtils;

