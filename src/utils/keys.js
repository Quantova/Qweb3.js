// src/utils/keys.js
//
// Q-branded Bech32m encoding for Quantova addresses and keys. All outputs are ALL-CAPITALS
// (so they start with a capital "Q"); decoding accepts upper- or lower-case input.
//
//   Address      "Q1..."     Bech32m of the 20-byte account body
//   Private key  "QSEC1..."  Bech32m of the 32-byte seed
//   Public key   "QPUB1..."  Bech32m of the raw public-key bytes

const { encode, decode } = require('./bech32');

const HRP = { ADDRESS: 'q', SECRET: 'qsec', PUBLIC: 'qpub' };

// "Q" brand byte (matches the chain): a valid 20-byte account body always starts with 0x40.
const Q_BRAND_BYTE = 0x40;
const ACCOUNT_BODY_LEN = 20;

const up = (s) => s.toUpperCase();

/** Encode a 20-byte account body as a "Q1..." address. */
function encodeAddress(bytes20) {
  return up(encode(HRP.ADDRESS, bytes20));
}
/**
 * Decode a canonical "Q1..." (case-insensitive on input) address back to its 20 bytes.
 *
 * [QWEB3-TX-005] A well-formed checksum is not sufficient: enforce that the decoded body is
 * exactly 20 bytes AND its first byte is the 0x40 "Q" brand byte, matching the chain. This
 * rejects strings that pass the Bech32m checksum but do not encode a real account body.
 */
function decodeAddress(str) {
  const body = decode(HRP.ADDRESS, str);
  if (body.length !== ACCOUNT_BODY_LEN || body[0] !== Q_BRAND_BYTE) {
    throw new Error('invalid Quantova address: body must be 20 bytes starting with 0x40');
  }
  return body;
}

/** Encode a 32-byte seed as a "QSEC1..." private key. */
function encodePrivateKey(seed32) {
  return up(encode(HRP.SECRET, seed32));
}
/** Decode a "QSEC1..." private key back to its 32-byte seed. */
function decodePrivateKey(str) {
  return decode(HRP.SECRET, str);
}

/** Encode raw public-key bytes as a "QPUB1..." public key. */
function encodePublicKey(pubBytes) {
  return up(encode(HRP.PUBLIC, pubBytes));
}
/** Decode a "QPUB1..." public key back to its raw bytes. */
function decodePublicKey(str) {
  return decode(HRP.PUBLIC, str);
}

/**
 * Translate a user-facing address into the form the node's q_* RPC expects. A "Q1..." account
 * address is decoded to its 20-byte body and returned as 0x-hex (the canonical H160 form an
 * H160-based RPC accepts); a 0x contract address (or anything else) is passed through unchanged.
 *
 * NOTE: the node's exact accepted parameter form should be confirmed against a live testnet node;
 * this boundary keeps the chain unchanged while users only ever see "Q1...".
 *
 * @param {string} address
 * @returns {string}
 */
function toNodeAddress(address) {
  if (typeof address === 'string' && /^(Q1|q1)/.test(address)) {
    return '0x' + Buffer.from(decodeAddress(address)).toString('hex');
  }
  return address;
}

module.exports = {
  HRP,
  Q_BRAND_BYTE,
  ACCOUNT_BODY_LEN,
  encodeAddress,
  decodeAddress,
  encodePrivateKey,
  decodePrivateKey,
  encodePublicKey,
  decodePublicKey,
  toNodeAddress,
};
