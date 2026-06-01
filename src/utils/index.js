// src/utils/index.js

// Import all utility classes
const AddressUtils = require('./address');
const BigIntUtils = require('./bigInt');
const FormatUtils = require('./format');
const HexUtils = require('./hex');
const NumberUtils = require('./number');
const ValidationUtils = require('./validation');

// Export all utility classes in a single object
module.exports = {
  AddressUtils,
  BigIntUtils,
  FormatUtils,
  HexUtils,
  NumberUtils,
  ValidationUtils,
};

