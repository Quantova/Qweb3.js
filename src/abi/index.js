// src/abi/index.js
//
// ABI Encoder & Decoder for the Quantova Virtual Machine (QVM).
//
// The QVM runs Solidity compiled to PolkaVM via pallet-revive, and speaks the
// standard Ethereum/Solidity ABI at the contract-call boundary: keccak-256
// 4-byte function selectors and 32-byte word ("head/tail") argument encoding.
// This module compiles method arguments into hex calldata and decodes return
// data and event topics/-data back into JavaScript values.
//
// Note on hashing: contract *selectors* use keccak-256 (Solidity ABI). This is
// distinct from Quantova's transaction/state hashing, which uses SHA3-256 — the
// signing layer (src/signer) handles that and is unaffected by this module.
//
// The keccak implementation is taken from @quantova/util-crypto by default, and
// can be overridden via setKeccak() (used by the test-suite to inject a
// dependency-free keccak so the codec can be validated offline).

'use strict';

let _keccakAsU8a = null;

/** Lazily load keccak-256 from @quantova/util-crypto (overridable via setKeccak). */
function keccak256(bytes) {
  if (_keccakAsU8a) return _keccakAsU8a(bytes);
  // Lazy require so the module loads even if the package is absent until first use.
  const { keccakAsU8a } = require('@quantova/util-crypto');
  _keccakAsU8a = keccakAsU8a;
  return _keccakAsU8a(bytes);
}

/**
 * Override the keccak-256 implementation. `fn` takes a Uint8Array and returns a
 * 32-byte Uint8Array. Primarily for testing / custom crypto backends.
 */
function setKeccak(fn) {
  _keccakAsU8a = fn;
}

// ---------------------------------------------------------------------------
// Low-level hex/byte helpers (self-contained; no external deps)
// ---------------------------------------------------------------------------

function stripHex(h) {
  return h.startsWith('0x') || h.startsWith('0X') ? h.slice(2) : h;
}
function hexToBytes(h) {
  const s = stripHex(h);
  if (s.length % 2 !== 0) throw new Error(`invalid hex length: ${h}`);
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
  return out;
}
function bytesToHex(b) {
  let s = '';
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
  return s;
}
function utf8ToBytes(str) {
  return new Uint8Array(Buffer.from(str, 'utf-8'));
}

// Two's-complement encoding of a (possibly negative) BigInt into 32 bytes.
function bigIntToWord(value, signed) {
  let v = BigInt(value);
  const mod = 1n << 256n;
  if (v < 0n) {
    if (!signed) throw new Error('negative value for unsigned type');
    v = (mod + (v % mod)) % mod;
  }
  if (v >= mod) throw new Error('value exceeds 256 bits');
  return hexToBytes(v.toString(16).padStart(64, '0'));
}
function wordToBigInt(word, signed) {
  let v = BigInt('0x' + bytesToHex(word));
  if (signed && v >= 1n << 255n) v -= 1n << 256n;
  return v;
}

// ---------------------------------------------------------------------------
// Type parsing
// ---------------------------------------------------------------------------

// Parse a Solidity type string into a descriptor. Supports the common set:
// uint<M>, int<M>, address, bool, bytes, bytes<N>, string, and one level of
// dynamic (T[]) or fixed (T[k]) arrays of those.
function parseType(type) {
  const arr = type.match(/^(.*)\[(\d*)\]$/);
  if (arr) {
    const base = parseType(arr[1]);
    const fixed = arr[2] !== '' ? parseInt(arr[2], 10) : null;
    return { kind: 'array', base, length: fixed, dynamic: fixed === null || base.dynamic };
  }
  if (type === 'address') return { kind: 'address', dynamic: false };
  if (type === 'bool') return { kind: 'bool', dynamic: false };
  if (type === 'string') return { kind: 'string', dynamic: true };
  if (type === 'bytes') return { kind: 'bytes', dynamic: true };
  let m = type.match(/^bytes(\d+)$/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n < 1 || n > 32) throw new Error(`invalid fixed bytes size: ${type}`);
    return { kind: 'fbytes', size: n, dynamic: false };
  }
  m = type.match(/^uint(\d*)$/);
  if (m) return { kind: 'uint', bits: m[1] ? parseInt(m[1], 10) : 256, dynamic: false };
  m = type.match(/^int(\d*)$/);
  if (m) return { kind: 'int', bits: m[1] ? parseInt(m[1], 10) : 256, dynamic: false };
  throw new Error(`unsupported ABI type: ${type}`);
}

// Canonical type string (for selector/signature hashing).
function canonicalType(type) {
  const t = parseType(type);
  return canonicalFromDescriptor(t);
}
function canonicalFromDescriptor(t) {
  switch (t.kind) {
    case 'array':
      return canonicalFromDescriptor(t.base) + '[' + (t.length === null ? '' : t.length) + ']';
    case 'uint':
      return 'uint' + t.bits;
    case 'int':
      return 'int' + t.bits;
    case 'fbytes':
      return 'bytes' + t.size;
    default:
      return t.kind === 'fbytes' ? 'bytes' + t.size : t.kind === 'address' ? 'address' : t.kind === 'bool' ? 'bool' : t.kind === 'string' ? 'string' : 'bytes';
  }
}

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

function isDynamic(t) {
  if (t.kind === 'string' || t.kind === 'bytes') return true;
  if (t.kind === 'array') return t.length === null || t.base.dynamic;
  return false;
}

// Encode a single value, returning { head, tail, dynamic }.
// `head` is the inline 32-byte content for static types; for dynamic types the
// head is an offset placeholder filled in by the tuple encoder.
function encodeValue(t, value) {
  switch (t.kind) {
    case 'uint':
      return { bytes: bigIntToWord(value, false), dynamic: false };
    case 'int':
      return { bytes: bigIntToWord(value, true), dynamic: false };
    case 'bool':
      return { bytes: bigIntToWord(value ? 1 : 0, false), dynamic: false };
    case 'address': {
      const b = typeof value === 'string' ? hexToBytes(value) : value;
      if (b.length !== 20) throw new Error('address must be 20 bytes');
      const word = new Uint8Array(32);
      word.set(b, 12);
      return { bytes: word, dynamic: false };
    }
    case 'fbytes': {
      const b = typeof value === 'string' ? hexToBytes(value) : value;
      if (b.length !== t.size) throw new Error(`bytes${t.size} must be ${t.size} bytes`);
      const word = new Uint8Array(32);
      word.set(b, 0);
      return { bytes: word, dynamic: false };
    }
    case 'bytes':
    case 'string': {
      const data = t.kind === 'string' ? utf8ToBytes(value) : typeof value === 'string' ? hexToBytes(value) : value;
      const len = bigIntToWord(data.length, false);
      const padded = new Uint8Array(Math.ceil(data.length / 32) * 32);
      padded.set(data, 0);
      return { bytes: concat([len, padded]), dynamic: true };
    }
    case 'array': {
      if (!Array.isArray(value)) throw new Error('expected array value');
      if (t.length !== null && value.length !== t.length) {
        throw new Error(`fixed array expected ${t.length} items, got ${value.length}`);
      }
      const parts = value.map((v) => encodeValue(t.base, v));
      const body = encodeTuplePacked(t.base, parts);
      if (t.length === null) {
        // dynamic: prefix with element count
        return { bytes: concat([bigIntToWord(value.length, false), body]), dynamic: true };
      }
      // fixed length: dynamic only if base is dynamic
      return { bytes: body, dynamic: t.base.dynamic };
    }
    default:
      throw new Error(`cannot encode kind ${t.kind}`);
  }
}

// Lay out an array of encoded items (all of the same type `t`) using head/tail.
function encodeTuplePacked(t, parts) {
  const dyn = isDynamic(t);
  if (!dyn) {
    return concat(parts.map((p) => p.bytes));
  }
  // dynamic items: heads are offsets, tails are the bodies
  const heads = [];
  const tails = [];
  let offset = parts.length * 32;
  for (const p of parts) {
    heads.push(bigIntToWord(offset, false));
    tails.push(p.bytes);
    offset += p.bytes.length;
  }
  return concat([...heads, ...tails]);
}

// Encode a list of (type, value) pairs as a standard ABI tuple (calldata args).
function encodeParameters(types, values) {
  if (types.length !== values.length) {
    throw new Error(`type/value count mismatch: ${types.length} vs ${values.length}`);
  }
  const descs = types.map(parseType);
  const parts = descs.map((t, i) => encodeValue(t, values[i]));

  const heads = [];
  const tails = [];
  let offset = descs.reduce((acc, t) => acc + (isDynamic(t) ? 32 : t.kind === 'array' && t.length ? t.length * 32 : 32), 0);
  // For non-dynamic fixed arrays the head is the inline body (length*32). Recompute precisely:
  offset = 0;
  for (const t of descs) offset += headSize(t);

  for (let i = 0; i < descs.length; i++) {
    const t = descs[i];
    const p = parts[i];
    if (isDynamic(t)) {
      heads.push(bigIntToWord(offset, false));
      tails.push(p.bytes);
      offset += p.bytes.length;
    } else {
      heads.push(p.bytes);
    }
  }
  return concat([...heads, ...tails]);
}

function headSize(t) {
  if (isDynamic(t)) return 32;
  if (t.kind === 'array' && t.length !== null) return t.length * headSize(t.base);
  return 32;
}

/**
 * Compute the 4-byte function selector for a signature like
 * "transfer(address,uint256)".
 */
function functionSelector(signature) {
  const hash = keccak256(utf8ToBytes(signature));
  return '0x' + bytesToHex(hash.subarray(0, 4));
}

/** Build a canonical signature string from a name + ABI input descriptors. */
function buildSignature(name, inputs) {
  const types = (inputs || []).map((i) => canonicalType(i.type));
  return `${name}(${types.join(',')})`;
}

/**
 * Encode a full function call: selector ++ encoded args. Returns 0x-hex calldata.
 */
function encodeFunctionCall(fnAbi, args) {
  const signature = buildSignature(fnAbi.name, fnAbi.inputs);
  const selector = functionSelector(signature);
  const types = (fnAbi.inputs || []).map((i) => i.type);
  const encoded = encodeParameters(types, args || []);
  return selector + bytesToHex(encoded);
}

/** keccak-256 topic hash of an event signature, e.g. Transfer(address,address,uint256). */
function eventTopic(signature) {
  return '0x' + bytesToHex(keccak256(utf8ToBytes(signature)));
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

function decodeValue(t, view, base) {
  // Returns { value, consumed } where consumed is the head size in bytes.
  switch (t.kind) {
    case 'uint':
      return { value: wordToBigInt(view.slice(base, base + 32), false), consumed: 32 };
    case 'int':
      return { value: wordToBigInt(view.slice(base, base + 32), true), consumed: 32 };
    case 'bool':
      return { value: wordToBigInt(view.slice(base, base + 32), false) !== 0n, consumed: 32 };
    case 'address': {
      const word = view.slice(base, base + 32);
      return { value: '0x' + bytesToHex(word.slice(12, 32)), consumed: 32 };
    }
    case 'fbytes': {
      const word = view.slice(base, base + 32);
      return { value: '0x' + bytesToHex(word.slice(0, t.size)), consumed: 32 };
    }
    case 'string':
    case 'bytes': {
      const offset = Number(wordToBigInt(view.slice(base, base + 32), false));
      const len = Number(wordToBigInt(view.slice(offset, offset + 32), false));
      const data = view.slice(offset + 32, offset + 32 + len);
      return { value: t.kind === 'string' ? Buffer.from(data).toString('utf-8') : '0x' + bytesToHex(data), consumed: 32 };
    }
    case 'array': {
      if (isDynamic(t)) {
        const offset = Number(wordToBigInt(view.slice(base, base + 32), false));
        const out = decodeArrayAt(t, view, offset);
        return { value: out, consumed: 32 };
      }
      // fixed, static base: inline
      const out = [];
      let cur = base;
      for (let i = 0; i < t.length; i++) {
        const r = decodeValue(t.base, view, cur);
        out.push(r.value);
        cur += headSize(t.base);
      }
      return { value: out, consumed: t.length * headSize(t.base) };
    }
    default:
      throw new Error(`cannot decode kind ${t.kind}`);
  }
}

function decodeArrayAt(t, view, offset) {
  if (t.length === null) {
    const count = Number(wordToBigInt(view.slice(offset, offset + 32), false));
    const body = view.slice(offset + 32);
    return decodeItems(t.base, body, count);
  }
  const body = view.slice(offset);
  return decodeItems(t.base, body, t.length);
}

function decodeItems(baseT, body, count) {
  const out = [];
  if (isDynamic(baseT)) {
    for (let i = 0; i < count; i++) {
      const itemOffset = Number(wordToBigInt(body.slice(i * 32, i * 32 + 32), false));
      // Each item's own data is offset-relative to the start of `body`.
      const r = decodeValueAbsolute(baseT, body, itemOffset);
      out.push(r);
    }
  } else {
    let cur = 0;
    for (let i = 0; i < count; i++) {
      const r = decodeValue(baseT, body, cur);
      out.push(r.value);
      cur += headSize(baseT);
    }
  }
  return out;
}

// Decode a dynamic value whose body starts at `start` within `view`.
function decodeValueAbsolute(t, view, start) {
  if (t.kind === 'string' || t.kind === 'bytes') {
    const len = Number(wordToBigInt(view.slice(start, start + 32), false));
    const data = view.slice(start + 32, start + 32 + len);
    return t.kind === 'string' ? Buffer.from(data).toString('utf-8') : '0x' + bytesToHex(data);
  }
  if (t.kind === 'array') {
    return decodeArrayAt(t, view, start);
  }
  // static inside dynamic context
  return decodeValue(t, view, start).value;
}

/**
 * Decode ABI-encoded return data given a list of type strings. Returns an array
 * of decoded values (single value returned directly when there is exactly one).
 */
function decodeParameters(types, data) {
  const view = hexToBytes(data);
  const descs = types.map(parseType);
  const out = [];
  let head = 0;
  for (const t of descs) {
    const r = decodeValue(t, view, head);
    out.push(r.value);
    head += headSize(t);
  }
  return out;
}

/**
 * Decode a function's return data using its outputs ABI.
 */
function decodeFunctionResult(fnAbi, data) {
  const types = (fnAbi.outputs || []).map((o) => o.type);
  if (types.length === 0) return null;
  const decoded = decodeParameters(types, data);
  return decoded.length === 1 ? decoded[0] : decoded;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function concat(arrays) {
  let total = 0;
  for (const a of arrays) total += a.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

module.exports = {
  // selectors & signatures
  functionSelector,
  buildSignature,
  eventTopic,
  // encode
  encodeParameters,
  encodeFunctionCall,
  // decode
  decodeParameters,
  decodeFunctionResult,
  // type utilities
  parseType,
  canonicalType,
  // crypto injection
  setKeccak,
  // low-level (exported for reuse/testing)
  _internal: { hexToBytes, bytesToHex, bigIntToWord, wordToBigInt, concat },
};
