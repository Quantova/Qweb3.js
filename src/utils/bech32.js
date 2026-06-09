// src/utils/bech32.js
//
// Bech32m encoder/decoder (BIP-350) for Quantova's Q-branded address/key strings.
// Output uses only lowercase letters + digits (no symbols); callers uppercase it for the
// capital-"Q" display form. Self-contained: no third-party dependency.

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const BECH32M_CONST = 0x2bc830a3; // BIP-350 checksum constant

function polymod(values) {
  let chk = 1;
  for (let p = 0; p < values.length; ++p) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ values[p];
    for (let i = 0; i < 5; ++i) {
      if ((top >> i) & 1) chk ^= GENERATOR[i];
    }
  }
  return chk >>> 0;
}

function hrpExpand(hrp) {
  const ret = [];
  for (let i = 0; i < hrp.length; ++i) ret.push(hrp.charCodeAt(i) >> 5);
  ret.push(0);
  for (let i = 0; i < hrp.length; ++i) ret.push(hrp.charCodeAt(i) & 31);
  return ret;
}

function createChecksum(hrp, data) {
  const values = hrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
  const mod = polymod(values) ^ BECH32M_CONST;
  const ret = [];
  for (let i = 0; i < 6; ++i) ret.push((mod >> (5 * (5 - i))) & 31);
  return ret;
}

function verifyChecksum(hrp, data) {
  return polymod(hrpExpand(hrp).concat(data)) === BECH32M_CONST;
}

// Regroup a byte/word stream between bit widths (8<->5). `pad` controls trailing padding.
function convertBits(data, fromBits, toBits, pad) {
  let acc = 0;
  let bits = 0;
  const ret = [];
  const maxv = (1 << toBits) - 1;
  for (const value of data) {
    if (value < 0 || value >> fromBits !== 0) return null;
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits > 0) ret.push((acc << (toBits - bits)) & maxv);
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) {
    return null;
  }
  return ret;
}

/**
 * Encode raw bytes as a Bech32m string with the given human-readable prefix (HRP).
 * Returns the raw BIP-350 form (lowercase per spec); the Quantova helpers in keys.js
 * display-encode it UPPER-CASE as the canonical "Q1..."/"QSEC1..."/"QPUB1..." form.
 *
 * @param {string} hrp - prefix, e.g. 'q' | 'qsec' | 'qpub'
 * @param {Uint8Array|Buffer|number[]} bytes - payload
 * @returns {string}
 */
function encode(hrp, bytes) {
  const data = convertBits(Array.from(bytes), 8, 5, true);
  if (data === null) throw new Error('bech32: cannot convert payload to 5-bit groups');
  const combined = data.concat(createChecksum(hrp, data));
  let out = hrp + '1';
  for (const d of combined) out += CHARSET.charAt(d);
  return out;
}

/**
 * Decode a Bech32m string, verifying the prefix and checksum. Accepts all-lowercase or
 * all-uppercase input (rejects mixed case); returns the raw payload bytes.
 *
 * @param {string} expectedHrp - the HRP the string must have
 * @param {string} str - the Bech32m string (canonical "Q1...", upper- or lower-case accepted)
 * @returns {Uint8Array}
 */
function decode(expectedHrp, str) {
  if (typeof str !== 'string') throw new Error('bech32: input is not a string');
  const lower = str.toLowerCase();
  const upper = str.toUpperCase();
  if (str !== lower && str !== upper) throw new Error('bech32: mixed-case string');
  const s = lower;
  const pos = s.lastIndexOf('1');
  if (pos < 1 || pos + 7 > s.length) throw new Error('bech32: invalid separator position');
  const hrp = s.substring(0, pos);
  if (hrp !== expectedHrp) throw new Error(`bech32: expected prefix "${expectedHrp}", got "${hrp}"`);
  const data = [];
  for (let i = pos + 1; i < s.length; ++i) {
    const d = CHARSET.indexOf(s.charAt(i));
    if (d === -1) throw new Error('bech32: invalid character');
    data.push(d);
  }
  if (!verifyChecksum(hrp, data)) throw new Error('bech32: bad checksum');
  const bytes = convertBits(data.slice(0, data.length - 6), 5, 8, false);
  if (bytes === null) throw new Error('bech32: invalid padding');
  return Uint8Array.from(bytes);
}

module.exports = { encode, decode };
