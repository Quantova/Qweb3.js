// src/utils/number.js

class NumberUtils {
  /**
   * Converts a number to its hexadecimal representation.
   * 
   * @param {number|string|BigInt} value - The value to convert to hex.
   * @returns {string} - The hexadecimal representation of the value.
   * @throws {Error} - Throws an error if the value cannot be converted to a number.
   */
  static toHex(value) {
    const numValue = this.toNumber(value);
    return `0x${numValue.toString(16)}`;
  }

  /**
   * Converts a value to a number.
   * Supports string, number, and BigInt values.
   * 
   * @param {number|string|BigInt} value - The value to convert to a number.
   * @returns {number} - The number representation of the value.
   * @throws {Error} - Throws an error if the value cannot be converted to a number.
   */
  static toNumber(value) {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const parsedValue = parseFloat(value);
      if (isNaN(parsedValue)) {
        throw new Error('Invalid string value for conversion to number');
      }
      return parsedValue;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    throw new Error('Invalid input: value cannot be converted to number');
  }

  /**
   * Rounds a number to the specified number of decimal places.
   * 
   * @param {number|string|BigInt} value - The value to round.
   * @param {number} decimals - The number of decimal places to round to.
   * @returns {string} - The rounded number as a string.
   * @throws {Error} - Throws an error if the value cannot be converted to a number.
   */
  static round(value, decimals) {
    const numValue = this.toNumber(value);
    if (isNaN(decimals) || decimals < 0) {
      throw new Error('Invalid number of decimal places');
    }
    return numValue.toFixed(decimals);
  }

  /**
   * Converts a number to a percentage string with specified decimal precision.
   * 
   * @param {number|string|BigInt} value - The value to convert to a percentage.
   * @param {number} decimals - The number of decimal places for the percentage.
   * @returns {string} - The percentage string (e.g., "25.00%").
   * @throws {Error} - Throws an error if the value cannot be converted to a number.
   */
  static toPercentage(value, decimals = 2) {
    const numValue = this.toNumber(value);
    if (isNaN(decimals) || decimals < 0) {
      throw new Error('Invalid number of decimal places');
    }
    return (numValue * 100).toFixed(decimals) + '%';
  }

  /**
   * Converts a percentage string to its decimal equivalent.
   * 
   * @param {string} percentage - The percentage string (e.g., "25%").
   * @returns {number} - The decimal equivalent of the percentage.
   * @throws {Error} - Throws an error if the percentage string is invalid.
   */
  static percentageToDecimal(percentage) {
    if (typeof percentage !== 'string' || !percentage.endsWith('%')) {
      throw new Error('Invalid percentage string');
    }
    const decimalValue = parseFloat(percentage.slice(0, -1)) / 100;
    if (isNaN(decimalValue)) {
      throw new Error('Invalid percentage value');
    }
    return decimalValue;
  }

  /**
   * Returns the maximum of two values.
   * 
   * @param {number|string|BigInt} a - The first value.
   * @param {number|string|BigInt} b - The second value.
   * @returns {number} - The larger of the two values.
   */
  static max(a, b) {
    const numA = this.toNumber(a);
    const numB = this.toNumber(b);
    return numA > numB ? numA : numB;
  }

  /**
   * Returns the minimum of two values.
   * 
   * @param {number|string|BigInt} a - The first value.
   * @param {number|string|BigInt} b - The second value.
   * @returns {number} - The smaller of the two values.
   */
  static min(a, b) {
    const numA = this.toNumber(a);
    const numB = this.toNumber(b);
    return numA < numB ? numA : numB;
  }

  /**
   * Converts a number to a fixed-point number with a specified precision.
   * 
   * @param {number|string|BigInt} value - The value to convert.
   * @param {number} precision - The number of decimal places for the fixed-point number.
   * @returns {number} - The fixed-point representation of the number.
   * @throws {Error} - Throws an error if the value cannot be converted to a number.
   */
  static toFixed(value, precision) {
    const numValue = this.toNumber(value);
    if (isNaN(precision) || precision < 0) {
      throw new Error('Invalid precision');
    }
    return parseFloat(numValue.toFixed(precision));
  }
}

// Export the NumberUtils class
module.exports = NumberUtils;

