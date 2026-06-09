// src/wallet/index.js

const { u8aToHex } = require('@quantova/util');
const { mnemonicGenerate, mnemonicValidate, mnemonicToMiniSecret } = require('@quantova/util-crypto');
const QuantumSigner = require('../signer');
const AddressUtils = require('../utils/address');
const { encodePrivateKey, decodePrivateKey, encodePublicKey } = require('../utils/keys');

class QuantumWallet {
  constructor() {
    this.accounts = []; // List of active account objects
    this._accountsByAddress = new Map();
  }

  /**
   * Creates a new post-quantum account with a fresh 24-word recovery phrase and adds it.
   *
   * @param {string} scheme - 'sphincsp', 'falcon', or 'dilithium'.
   * @returns {Object} account: { address (Q1...), mnemonic (24 words), publicKey (QPUB1...),
   *                              privateKey (QSEC1...), scheme }
   */
  create(scheme = 'falcon') {
    const mnemonic = mnemonicGenerate(24);
    return this.importMnemonic(mnemonic, scheme);
  }

  /**
   * Imports an account from a 24-word recovery phrase (BIP-39).
   *
   * @param {string} mnemonic - the recovery phrase.
   * @param {string} scheme - 'sphincsp', 'falcon', or 'dilithium'.
   * @returns {Object} the imported account.
   */
  importMnemonic(mnemonic, scheme = 'falcon') {
    if (!mnemonicValidate(mnemonic)) {
      throw new Error('Invalid recovery phrase');
    }
    const seed = mnemonicToMiniSecret(mnemonic); // 32-byte seed
    return this._addFromSeed(seed, scheme, mnemonic);
  }

  /**
   * Imports an account from a "QSEC1..." private key (or, during migration, a legacy 0x / bare-hex
   * 32-byte seed). Accounts imported this way have no recovery phrase.
   *
   * @param {string} privateKey - "QSEC1..." (or legacy hex seed).
   * @param {string} scheme - 'sphincsp', 'falcon', or 'dilithium'.
   * @returns {Object} the imported account.
   */
  importPrivateKey(privateKey, scheme = 'falcon') {
    let seed;
    if (typeof privateKey === 'string' && /^(QSEC1|qsec1)/.test(privateKey)) {
      seed = decodePrivateKey(privateKey); // Bech32m -> 32-byte seed
    } else if (typeof privateKey === 'string') {
      const hex = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
      seed = Uint8Array.from(Buffer.from(hex, 'hex')); // legacy hex seed
    } else {
      throw new Error('Invalid private key');
    }
    return this._addFromSeed(seed, scheme, null);
  }

  /**
   * Internal: build and register an account object from a 32-byte seed.
   * The raw seed is kept (non-enumerable) for signing; only the Q-branded forms are displayed.
   */
  _addFromSeed(seed, scheme, mnemonic) {
    const keypair = QuantumSigner.generatePair(seed, scheme);
    const account = {
      address: AddressUtils.deriveAddressFromPublicKey(keypair.publicKey), // Q1...
      mnemonic: mnemonic || null, // 24 words (null if imported by private key)
      publicKey: encodePublicKey(keypair.publicKey), // QPUB1...
      privateKey: encodePrivateKey(seed), // QSEC1...
      scheme,
    };
    // Raw seed for signing — not shown in normal serialisation.
    Object.defineProperty(account, '_seed', { value: Uint8Array.from(seed), enumerable: false });

    this.add(account);
    return account;
  }

  /**
   * Adds an account object directly to the wallet.
   */
  add(account) {
    if (!account.address || !account.privateKey || !account.scheme) {
      throw new Error('Invalid account structure. Must include address, privateKey, and scheme.');
    }
    if (this._accountsByAddress.has(account.address)) {
      return; // Already added
    }
    this.accounts.push(account);
    this._accountsByAddress.set(account.address, account);
  }

  /**
   * Removes an account by address.
   */
  remove(address) {
    if (!this._accountsByAddress.has(address)) {
      return false;
    }
    this._accountsByAddress.delete(address);
    this.accounts = this.accounts.filter((acc) => acc.address !== address);
    return true;
  }

  /**
   * Returns a list of active addresses.
   */
  getAddresses() {
    return Array.from(this._accountsByAddress.keys());
  }

  /**
   * Signs a transaction's raw payload using the specified account's key.
   *
   * @param {string|Uint8Array} rawTx - The transaction payload.
   * @param {string} address - The signing account address ("Q1...").
   * @returns {string} - Hex signature.
   */
  signTransaction(rawTx, address) {
    const account = this._accountsByAddress.get(address);
    if (!account) {
      throw new Error(`Account with address ${address} not found in this wallet.`);
    }
    const seed = account._seed || decodePrivateKey(account.privateKey);
    const signature = QuantumSigner.sign(rawTx, seed, account.scheme);
    return u8aToHex(signature);
  }
}

module.exports = QuantumWallet;
