// src/wallet/index.js

const { hexToU8a, u8aToHex } = require('@quantova/util');
const QuantumSigner = require('../signer');
const AddressUtils = require('../utils/address');

class QuantumWallet {
  constructor() {
    this.accounts = []; // List of active account objects
    this._accountsByAddress = new Map();
  }

  /**
   * Helper to generate a random 32-byte seed as a hex string.
   */
  _generateRandomSeed() {
    const bytes = require('crypto').randomBytes(32);
    return '0x' + bytes.toString('hex');
  }

  /**
   * Creates a new random post-quantum account and adds it to the wallet.
   * 
   * @param {string} scheme - 'sphincsp', 'falcon', or 'dilithium'.
   * @returns {Object} - The created account object.
   */
  create(scheme = 'falcon') {
    const seedHex = this._generateRandomSeed();
    return this.importPrivateKey(seedHex, scheme);
  }

  /**
   * Imports a post-quantum account from a private key (32-byte hex seed).
   * 
   * @param {string} privateKey - 32-byte hex seed.
   * @param {string} scheme - 'sphincsp', 'falcon', or 'dilithium'.
   * @returns {Object} - The imported account object.
   */
  importPrivateKey(privateKey, scheme = 'falcon') {
    const seedU8a = hexToU8a(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
    const keypair = QuantumSigner.generatePair(seedU8a, scheme);
    const address = AddressUtils.h160Base64FromAccountId(keypair.publicKey);

    const account = {
      address: address,
      publicKey: u8aToHex(keypair.publicKey),
      privateKey: privateKey,
      scheme: scheme
    };

    this.add(account);
    return account;
  }

  /**
   * Imports an account from a standard mnemonic seed phrase.
   * Note: In a production-grade Substrate setup, mnemonic seed phrase derivation is typically handled 
   * via sub-package mnemonic generation, but here we can derive a stable 32-byte seed via standard pbkdf2 or 
   * a simplified cryptographic hash of the mnemonic to allow seamless testing.
   * 
   * @param {string} mnemonic - The mnemonic phrase.
   * @param {string} scheme - 'sphincsp', 'falcon', or 'dilithium'.
   * @returns {Object} - The imported account object.
   */
  importMnemonic(mnemonic, scheme = 'falcon') {
    const crypto = require('crypto');
    // Derive a standard 32-byte seed from the mnemonic
    const hash = crypto.createHash('sha256').update(mnemonic).digest('hex');
    return this.importPrivateKey('0x' + hash, scheme);
  }

  /**
   * Adds an account object directly to the wallet.
   * 
   * @param {Object} account - The account object.
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
   * 
   * @param {string} address - The Base64 H160 address.
   * @returns {boolean} - True if removed.
   */
  remove(address) {
    if (!this._accountsByAddress.has(address)) {
      return false;
    }

    this._accountsByAddress.delete(address);
    this.accounts = this.accounts.filter(acc => acc.address !== address);
    return true;
  }

  /**
   * Returns a list of active addresses.
   * 
   * @returns {Array<string>}
   */
  getAddresses() {
    return Array.from(this._accountsByAddress.keys());
  }

  /**
   * Signs a transaction's raw payload using the specified account's private key.
   * 
   * @param {string|Uint8Array} rawTx - The transaction payload.
   * @param {string} address - The signing account address.
   * @returns {string} - Hex signature.
   */
  signTransaction(rawTx, address) {
    const account = this._accountsByAddress.get(address);
    if (!account) {
      throw new Error(`Account with address ${address} not found in this wallet.`);
    }

    const signature = QuantumSigner.sign(rawTx, account.privateKey, account.scheme);
    return u8aToHex(signature);
  }
}

module.exports = QuantumWallet;
