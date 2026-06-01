// src/utils/format.js

const BigIntUtils = require('./bigInt'); // Import BigInt utilities for formatting BigInt values

class FormatUtils {
  /**
   * Converts a base-unit (wei, 18 decimals) value to whole QTOV.
   * QTOV is Quantova's native asset; 1 QTOV = 10^18 base units.
   * Returns a decimal string (does not truncate the fractional part).
   *
   * @param {BigInt|string|number} wei - The base-unit value.
   * @returns {string} - The value in QTOV as a decimal string.
   */
  static weiToQtov(wei) {
    const value = BigIntUtils.toBigInt(wei);
    const base = 10n ** 18n;
    const neg = value < 0n;
    const abs = neg ? -value : value;
    const whole = abs / base;
    const frac = abs % base;
    let out = whole.toString();
    if (frac > 0n) {
      out += '.' + frac.toString().padStart(18, '0').replace(/0+$/, '');
    }
    return (neg ? '-' : '') + out;
  }

  /**
   * Converts a QTOV amount (decimal string/number) to base units (wei, 18 dp).
   *
   * @param {string|number} qtov - The QTOV amount.
   * @returns {BigInt} - The value in base units.
   */
  static qtovToWei(qtov) {
    const s = String(qtov).trim();
    const neg = s.startsWith('-');
    const [whole, frac = ''] = (neg ? s.slice(1) : s).split('.');
    if (frac.length > 18) throw new Error('QTOV supports at most 18 decimal places');
    const fracPadded = (frac + '0'.repeat(18)).slice(0, 18);
    const value = BigInt(whole || '0') * 10n ** 18n + BigInt(fracPadded || '0');
    return neg ? -value : value;
  }

  /**
   * Converts a base-unit (wei) value to whole QTOV (integer part only).
   * Retained under the prior name for backward compatibility; prefer weiToQtov.
   *
   * @param {BigInt|string|number} wei - The base-unit value.
   * @returns {string} - The whole-QTOV value as a string.
   */
  static weiToEther(wei) {
    const weiValue = BigIntUtils.toBigInt(wei);
    const etherValue = weiValue / (10n ** 18n);
    return etherValue.toString();
  }

  /**
   * Converts a number to a human-readable string (with commas for large numbers).
   * 
   * @param {BigInt|string|number} value - The value to format.
   * @returns {string} - The formatted string.
   * @throws {Error} - Throws an error if the value cannot be converted to BigInt.
   */
  static formatNumber(value) {
    const bigIntValue = BigIntUtils.toBigInt(value);
    return bigIntValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * Formats a date to a readable string (YYYY-MM-DD HH:mm:ss).
   * 
   * @param {Date|string} date - The date to format. Can be a Date object or a date string.
   * @returns {string} - The formatted date string.
   */
  static formatDate(date) {
    const dateObj = new Date(date);
    
    if (isNaN(dateObj)) {
      throw new Error('Invalid date');
    }
    
    const year = dateObj.getFullYear();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const day = dateObj.getDate().toString().padStart(2, '0');
    const hours = dateObj.getHours().toString().padStart(2, '0');
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    const seconds = dateObj.getSeconds().toString().padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Formats a number to a string with a specified number of decimal places.
   * 
   * @param {number|string} value - The value to format.
   * @param {number} decimals - The number of decimal places to show.
   * @returns {string} - The formatted string with specified decimals.
   * @throws {Error} - Throws an error if the value is not a number or cannot be converted.
   */
  static formatDecimals(value, decimals) {
    const numValue = parseFloat(value);

    if (isNaN(numValue)) {
      throw new Error('Invalid number');
    }

    return numValue.toFixed(decimals);
  }

  /**
   * Converts a number to its percentage representation.
   * 
   * @param {number|string} value - The value to convert to a percentage.
   * @param {number} decimals - The number of decimal places for the percentage.
   * @returns {string} - The value as a percentage (e.g., 25.00%).
   */
  static toPercentage(value, decimals = 2) {
    const numValue = parseFloat(value);

    if (isNaN(numValue)) {
      throw new Error('Invalid number');
    }

    return (numValue * 100).toFixed(decimals) + '%';
  }

  /**
   * Converts a Unix timestamp to a formatted date string.
   * 
   * @param {number|string} timestamp - The Unix timestamp (in seconds).
   * @returns {string} - The formatted date string.
   */
  static timestampToDate(timestamp) {
    const dateObj = new Date(timestamp * 1000);
    return this.formatDate(dateObj);
  }
}

// Export the FormatUtils class
module.exports = FormatUtils;

