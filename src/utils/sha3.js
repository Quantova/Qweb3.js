// src/utils/sha3.js
//
// FIPS-202 SHA3-256 (NOT Keccak-256). This is the exact hash the Quantova chain uses to turn a
// public key into an account: address = SHA3-256(publicKey)[0..20], with byte[0] set to 0x40 ("Q").
// Matching this byte-for-byte is what makes a wallet's "Q1..." address line up with the chain.
//
// Self-contained Keccak-f[1600] implementation over BigInt lanes. Verified against the official
// vectors: SHA3-256("") = a7ffc6f8...434a and SHA3-256("abc") = 3a985da7...1532.

const MASK = (1n << 64n) - 1n;

const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

// Rho rotation offsets, lane index = x + 5*y.
const ROT = [
  0, 1, 62, 28, 27,
  36, 44, 6, 55, 20,
  3, 10, 43, 25, 39,
  41, 45, 15, 21, 8,
  18, 2, 61, 56, 14,
];

function rotl(x, n) {
  const b = BigInt(n);
  return ((x << b) | (x >> (64n - b))) & MASK;
}

function keccakF(A) {
  for (let round = 0; round < 24; round++) {
    // theta
    const C = new Array(5);
    for (let x = 0; x < 5; x++) C[x] = A[x] ^ A[x + 5] ^ A[x + 10] ^ A[x + 15] ^ A[x + 20];
    const D = new Array(5);
    for (let x = 0; x < 5; x++) D[x] = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) A[x + 5 * y] ^= D[x];

    // rho + pi
    const B = new Array(25).fill(0n);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(A[x + 5 * y], ROT[x + 5 * y]);
      }
    }

    // chi
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        A[x + 5 * y] = B[x + 5 * y] ^ ((~B[((x + 1) % 5) + 5 * y] & MASK) & B[((x + 2) % 5) + 5 * y]);
      }
    }

    // iota
    A[0] ^= RC[round];
  }
}

/**
 * SHA3-256 (FIPS-202) of a byte array.
 * @param {Uint8Array|Buffer|number[]} input
 * @returns {Uint8Array} 32-byte digest
 */
function sha3_256(input) {
  const msg = Uint8Array.from(input);
  const rate = 136; // 1088-bit rate for SHA3-256
  // pad10*1 with the SHA3 domain byte 0x06
  const padLen = rate - (msg.length % rate);
  const padded = new Uint8Array(msg.length + padLen);
  padded.set(msg, 0);
  padded[msg.length] ^= 0x06; // domain separation (0x06 = SHA3; Keccak would be 0x01)
  padded[padded.length - 1] ^= 0x80;

  const A = new Array(25).fill(0n);
  for (let off = 0; off < padded.length; off += rate) {
    // absorb one rate-sized block (little-endian 64-bit lanes)
    for (let i = 0; i < rate / 8; i++) {
      let lane = 0n;
      for (let b = 0; b < 8; b++) lane |= BigInt(padded[off + i * 8 + b]) << (8n * BigInt(b));
      A[i] ^= lane;
    }
    keccakF(A);
  }

  // squeeze 32 bytes
  const out = new Uint8Array(32);
  for (let i = 0; i < 4; i++) {
    let lane = A[i];
    for (let b = 0; b < 8; b++) {
      out[i * 8 + b] = Number(lane & 0xffn);
      lane >>= 8n;
    }
  }
  return out;
}

module.exports = { sha3_256 };
