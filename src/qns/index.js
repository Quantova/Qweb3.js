// src/qns/index.js
//
// QNS Name Registrar & Resolver.
//
// Resolves post-quantum `.q` domains to Quantova addresses through a QVM
// registry contract (Solidity-on-QVM), using the ABI codec + QContract wrapper.
// Reads go via JSON-RPC q_call with REST fallback; registration builds a signed
// transaction through the wallet.
//
//   const qns = new QNS({ registryAddress, rpc, wallet, restClient });
//   const addr  = await qns.resolve('alice.q');     // -> '0x...'/Base64 address
//   const name  = await qns.reverse('0x...');        // -> 'alice.q' or null
//   const owner = await qns.owner('alice.q');
//
// The registry ABI below is a conventional ENS-style resolver/registrar surface
// (namehash node keys). If your deployed registry uses different method names,
// pass a custom `abi` in the options — everything else (namehash, encoding,
// transport, fallback) stays the same.

'use strict';

const abiCodec = require('../abi');
const QContract = require('../contract');

// keccak override hook mirrors the ABI module so tests can inject offline keccak.
let _keccakAsU8a = null;
function keccak256(bytes) {
  if (_keccakAsU8a) return _keccakAsU8a(bytes);
  const { keccakAsU8a } = require('@quantova/util-crypto');
  _keccakAsU8a = keccakAsU8a;
  return _keccakAsU8a(bytes);
}
function setKeccak(fn) {
  _keccakAsU8a = fn;
  abiCodec.setKeccak(fn);
}

// Default ENS-style registry ABI (the common resolver/registrar shape).
const DEFAULT_REGISTRY_ABI = [
  { type: 'function', name: 'resolver', stateMutability: 'view', inputs: [{ name: 'node', type: 'bytes32' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [{ name: 'node', type: 'bytes32' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'addr', stateMutability: 'view', inputs: [{ name: 'node', type: 'bytes32' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [{ name: 'node', type: 'bytes32' }], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'setAddr', stateMutability: 'nonpayable', inputs: [{ name: 'node', type: 'bytes32' }, { name: 'addr', type: 'address' }], outputs: [] },
  { type: 'function', name: 'register', stateMutability: 'nonpayable', inputs: [{ name: 'label', type: 'bytes32' }, { name: 'owner', type: 'address' }], outputs: [] },
];

class QNS {
  /**
   * @param {Object} opts
   * @param {string} opts.registryAddress - QVM address of the QNS registry contract.
   * @param {Object} [opts.rpc]           - QRpcClient (primary transport).
   * @param {Object} [opts.wallet]        - QuantumWallet (for register/setAddr).
   * @param {Object} [opts.restClient]    - QRestClient (fallback).
   * @param {Array}  [opts.abi]           - Custom registry ABI (defaults to ENS-style).
   * @param {string} [opts.tld='q']       - Top-level domain.
   */
  constructor(opts = {}) {
    if (!opts.registryAddress) throw new Error('QNS requires a registryAddress (QVM registry contract)');
    this.registryAddress = opts.registryAddress;
    this.tld = opts.tld || 'q';
    this.abi = opts.abi || DEFAULT_REGISTRY_ABI;
    this.registry = new QContract(this.abi, this.registryAddress, {
      rpc: opts.rpc,
      wallet: opts.wallet,
      restClient: opts.restClient,
    });
  }

  /** Validate a `.q` name (lowercase letters, digits, hyphen labels). */
  isValidName(name) {
    if (typeof name !== 'string') return false;
    return new RegExp(`^([a-z0-9-]+\\.)*[a-z0-9-]+\\.${this.tld}$`).test(name);
  }

  /**
   * Compute the namehash (ENS algorithm) of a domain, as a 0x32-byte string.
   * namehash('') = 0x00..00; namehash('a.b') = keccak(namehash('b') ++ keccak('a')).
   */
  namehash(name) {
    let node = new Uint8Array(32); // 32 zero bytes
    if (name && name.length) {
      const labels = name.toLowerCase().split('.');
      for (let i = labels.length - 1; i >= 0; i--) {
        const labelHash = keccak256(Buffer.from(labels[i], 'utf-8'));
        const combined = new Uint8Array(64);
        combined.set(node, 0);
        combined.set(labelHash, 32);
        node = keccak256(combined);
      }
    }
    return '0x' + Buffer.from(node).toString('hex');
  }

  /** keccak of a single label (for registrars that key on label hashes). */
  labelhash(label) {
    return '0x' + Buffer.from(keccak256(Buffer.from(label.toLowerCase(), 'utf-8'))).toString('hex');
  }

  /**
   * Resolve a `.q` name to an address.
   * Looks up the resolver for the node, then calls addr(node) on it. Falls back
   * to calling addr(node) directly on the registry if no separate resolver.
   * Returns the address string, or null if unresolved / zero address.
   */
  async resolve(name) {
    if (!this.isValidName(name)) throw new Error(`invalid QNS name: ${name}`);
    const node = this.namehash(name);

    let resolverAddr = null;
    try {
      resolverAddr = await this.registry.call('resolver', [node]);
    } catch (e) {
      resolverAddr = null;
    }

    if (resolverAddr && !this._isZeroAddress(resolverAddr)) {
      const resolver = new QContract(this.abi, resolverAddr, {
        rpc: this.registry.rpc,
        wallet: this.registry.wallet,
        restClient: this.registry.restClient,
      });
      const addr = await resolver.call('addr', [node]);
      return this._isZeroAddress(addr) ? null : addr;
    }

    // Fallback: registry exposes addr() directly.
    const addr = await this.registry.call('addr', [node]);
    return this._isZeroAddress(addr) ? null : addr;
  }

  /** Owner of a name (registry.owner(node)). */
  async owner(name) {
    if (!this.isValidName(name)) throw new Error(`invalid QNS name: ${name}`);
    const node = this.namehash(name);
    const owner = await this.registry.call('owner', [node]);
    return this._isZeroAddress(owner) ? null : owner;
  }

  /**
   * Reverse-resolve an address to its primary name via the standard reverse
   * node `<addr-hex-no-0x>.addr.reverse`. Returns the name string or null.
   */
  async reverse(address) {
    const { toNodeAddress } = require('../utils/keys');
    // Accept a "Q1..." account address or a 0x contract address; the reverse node uses the hex body.
    const hexAddr = toNodeAddress(address).replace(/^0x/, '').toLowerCase();
    const reverseName = `${hexAddr}.addr.reverse`;
    const node = this.namehash(reverseName);
    try {
      const name = await this.registry.call('name', [node]);
      return name && name.length ? name : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Register a label under the TLD. Requires a wallet. Returns the tx hash.
   * (Uses register(labelhash, owner); override the ABI for custom registrars.)
   */
  async register(name, ownerAddress, overrides = {}) {
    if (!this.isValidName(name)) throw new Error(`invalid QNS name: ${name}`);
    if (!this.registry.wallet) throw new Error('register() requires a wallet');
    const label = name.split('.')[0];
    return this.registry.send('register', [this.labelhash(label), ownerAddress], {
      from: overrides.from || ownerAddress,
      ...overrides,
    });
  }

  /**
   * Set the address record for a name. Requires a wallet. Returns the tx hash.
   */
  async setAddr(name, targetAddress, overrides = {}) {
    if (!this.isValidName(name)) throw new Error(`invalid QNS name: ${name}`);
    if (!this.registry.wallet) throw new Error('setAddr() requires a wallet');
    const node = this.namehash(name);
    return this.registry.send('setAddr', [node, targetAddress], overrides);
  }

  _isZeroAddress(addr) {
    if (addr == null) return true;
    const s = String(addr).toLowerCase().replace(/^0x/, '');
    return s.length === 0 || /^0+$/.test(s);
  }
}

QNS.setKeccak = setKeccak;
QNS.DEFAULT_REGISTRY_ABI = DEFAULT_REGISTRY_ABI;
module.exports = QNS;
