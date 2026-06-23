// src/wallet/index.js

const { u8aToHex } = require('@quantova/util');
const { mnemonicGenerate, mnemonicValidate, mnemonicToMiniSecret } = require('@quantova/util-crypto');
const { ApiPromise, WsProvider } = require('@quantova/api');
const { Keyring } = require('@quantova/keyring');
const QuantumSigner = require('../signer');
const AddressUtils = require('../utils/address');
const { encodePrivateKey, decodePrivateKey, encodePublicKey } = require('../utils/keys');

// Account secrets live in a MODULE-PRIVATE WeakMap, not on the account object and not exported, so
// they cannot be reached via JSON.stringify, console.log/inspect, Object.keys/getOwnPropertyNames,
// spreads, structuredClone, or by importing a symbol. Only prototype getters / signing read them.
const _accountSecrets = new WeakMap();

class QuantumAccount {
  constructor(address, publicKey, scheme, seed, mnemonic) {
    this.address = address;     // Q1...
    this.publicKey = publicKey; // QPUB1...
    this.scheme = scheme;
    _accountSecrets.set(this, {
      seed: Uint8Array.from(seed),
      privateKey: encodePrivateKey(seed), // QSEC1...
      mnemonic: mnemonic || null,
    });
  }
  get privateKey() { const s = _accountSecrets.get(this); return s ? s.privateKey : undefined; }
  get mnemonic() { const s = _accountSecrets.get(this); return s ? s.mnemonic : null; }
  get _seed() { const s = _accountSecrets.get(this); return s ? s.seed : undefined; }
  toJSON() { return { address: this.address, publicKey: this.publicKey, scheme: this.scheme }; }
  [Symbol.for('nodejs.util.inspect.custom')]() {
    return `QuantumAccount { address: '${this.address}', publicKey: '${this.publicKey}', scheme: '${this.scheme}' }`;
  }
}

// One cached ApiPromise per node URL (native QVM extrinsic assembly + submission).
const _apiByUrl = new Map();
function _wsUrl(url) {
  if (!url) return 'ws://127.0.0.1:9944';
  return url.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');
}
async function _getApi(url) {
  const ws = _wsUrl(url);
  let p = _apiByUrl.get(ws);
  if (!p) { p = ApiPromise.create({ provider: new WsProvider(ws) }); _apiByUrl.set(ws, p); }
  return p;
}

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
      // [QW3-001] Legacy hex seed: require EXACTLY 64 hex chars (optionally 0x-prefixed) before
      // decoding. Buffer.from(..., 'hex') silently drops trailing non-hex / odd nibbles, which
      // would yield a short, attacker-influenced seed; validate first, then assert 32 bytes.
      if (!/^(0x)?[0-9a-fA-F]{64}$/.test(privateKey)) {
        throw new Error('Invalid private key: expected a 64-hex-char (32-byte) seed or a "QSEC1..." key');
      }
      const hex = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
      seed = Uint8Array.from(Buffer.from(hex, 'hex')); // legacy hex seed
      if (seed.length !== 32) {
        throw new Error('Invalid private key: decoded seed must be exactly 32 bytes');
      }
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
    // Secrets are held in the module-private WeakMap (see QuantumAccount); the object itself exposes
    // only address/publicKey/scheme, so no serialization/inspection/own-property path can leak them. (QW3-KEY-001)
    const account = new QuantumAccount(
      AddressUtils.deriveAddressFromPublicKey(keypair.publicKey),
      encodePublicKey(keypair.publicKey),
      scheme,
      seed,
      mnemonic,
    );

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

  /**
   * Build, post-quantum-sign and SUBMIT a QVM contract write (state-changing call)
   * as a native `revive.call` extrinsic, and resolve with the transaction hash once
   * it is in a block. This is the post-quantum write path: the caller is the wallet's
   * own native PQ account (Falcon/Dilithium/SPHINCS+), not an Ethereum/eth-mapped
   * account — so it actually executes (eth-format q_sendRawTransaction does not run
   * for native accounts). Generous fixed weight + storage-deposit are used because the
   * node's gas dry-run intermittently under-reports and the call would silently revert.
   *
   * @param {Object} p
   * @param {string} p.rpcUrl   - node URL (http/ws); converted to ws for submission
   * @param {string} p.from     - Q1… signing address (must be in this wallet)
   * @param {string} p.to       - 0x… QVM contract address
   * @param {string} p.data     - ABI-encoded calldata (0x… or bare hex)
   * @param {string|bigint} [p.value='0'] - native TQTOV (plancks) to send (msg.value)
   * @param {Object} [p.gas]    - { refTime, proofSize } weight override
   * @param {string|bigint} [p.storageDepositLimit] - plancks; default 100 TQTOV
   * @returns {Promise<string>} the transaction hash (0x…)
   */
  async signAndSendContractTx({ rpcUrl, from, to, data, value = '0', gas, storageDepositLimit }) {
    const account = from ? this._accountsByAddress.get(from) : this.accounts[0];
    if (!account) throw new Error(`signing account ${from || ''} not found in this wallet`);
    const seed = account._seed || decodePrivateKey(account.privateKey);
    const pair = new Keyring({ type: account.scheme }).addFromSeed(Uint8Array.from(seed));

    const api = await _getApi(rpcUrl);
    const weight = api.createType('Weight', gas || { refTime: '8000000000', proofSize: '800000' });
    const sd = (storageDepositLimit != null ? BigInt(storageDepositLimit) : 100n * 10n ** 18n).toString();
    const callData = String(data).startsWith('0x') ? data : '0x' + data;
    const val = (typeof value === 'bigint' ? value : BigInt(value || 0)).toString();

    return new Promise((resolve, reject) => {
      api.tx.revive.call(to, val, weight, sd, callData)
        .signAndSend(pair, ({ status, dispatchError, txHash }) => {
          if (!status.isInBlock && !status.isFinalized) return;
          if (dispatchError) {
            let m = dispatchError.toString();
            if (dispatchError.isModule) { try { const d = api.registry.findMetaError(dispatchError.asModule); m = `${d.section}.${d.name}`; } catch (e) { /* keep raw */ } }
            reject(new Error('contract write failed: ' + m));
          } else {
            resolve(txHash.toHex());
          }
        })
        .catch(reject);
    });
  }
}

module.exports = QuantumWallet;
